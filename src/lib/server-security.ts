import { isIP } from "node:net";
import { z } from "zod";

export class RequestError extends Error {
	status: number;

	constructor(message: string, status = 400) {
		super(message);
		this.status = status;
	}
}

// Check the bytes actually received, including chunked requests without Content-Length.
export async function readJsonBody(request: Request, maxBytes = 5 * 1024 * 1024): Promise<unknown> {
	if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
		throw new RequestError("Content-Type must be application/json.", 415);
	}
	const declaredLength = Number(request.headers.get("content-length"));
	if (declaredLength > maxBytes) throw new RequestError("Request body is too large.", 413);
	if (!request.body) throw new RequestError("A JSON request body is required.");

	const reader = request.body.getReader();
	const decoder = new TextDecoder();
	let bytes = 0;
	let body = "";
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			bytes += value.byteLength;
			if (bytes > maxBytes) {
				await reader.cancel();
				throw new RequestError("Request body is too large.", 413);
			}
			body += decoder.decode(value, { stream: true });
		}
		body += decoder.decode();
	} finally {
		reader.releaseLock();
	}
	try {
		return JSON.parse(body);
	} catch {
		throw new RequestError("The request body must contain valid JSON.");
	}
}

const promptText = z.string().max(100_000);
const optionalPromptText = promptText.optional();
const settingsSchema = z.object({
	model: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/).default("cosmosrp"),
	temperature: z.number().min(0).max(2).default(0.7),
	max_tokens: z.number().int().min(1).max(4000).default(1000),
	top_p: z.number().min(0).max(1).optional(),
	frequency_penalty: z.number().min(-2).max(2).optional(),
	presence_penalty: z.number().min(-2).max(2).optional(),
	streaming: z.boolean().default(false),
});

export const chatRequestSchema = z.object({
	messages: z.array(z.object({
		role: z.enum(["user", "assistant", "system"]),
		content: promptText,
		image: z.string().max(4 * 1024 * 1024).refine((value) => {
			if (/^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return true;
			try {
				const url = new URL(value);
				return url.protocol === "https:" && !url.username && !url.password;
			} catch {
				return false;
			}
		}, "Use an HTTPS image URL or an encoded PNG, JPEG, GIF, or WebP image.").optional(),
	})).min(1).max(500),
	character: z.object({
		name: z.string().max(500),
		personality: optionalPromptText,
		scenario: optionalPromptText,
		depth_prompt: optionalPromptText,
		example_dialogue: optionalPromptText,
		system_prompt: optionalPromptText,
		post_history_instructions: optionalPromptText,
	}).nullish(),
	persona: z.object({
		name: z.string().max(500),
		age: z.number().int().min(0).max(1000).optional(),
		gender: optionalPromptText,
		appearance: optionalPromptText,
		traits: optionalPromptText,
		background: optionalPromptText,
	}).nullish(),
	settings: settingsSchema.optional().transform((settings) => settings ?? settingsSchema.parse({})),
});

export function isAllowedOrigin(origin: string | null | undefined, host: string | null | undefined, configuredOrigin = process.env.APP_ORIGIN): boolean {
	if (!origin || origin === "null") return false;
	try {
		const url = new URL(origin);
		if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin) return false;
		return configuredOrigin ? url.origin === new URL(configuredOrigin).origin : url.host === host;
	} catch {
		return false;
	}
}

export function assertSameOrigin(request: Request): void {
	const origin = request.headers.get("origin");
	if (request.headers.get("sec-fetch-site") === "cross-site" || (origin !== null && !isAllowedOrigin(origin, request.headers.get("host")))) {
		throw new RequestError("Cross-origin requests are not allowed.", 403);
	}
}

export function clientRateLimitKey(headers: Headers, trustedHeader = process.env.TRUSTED_PROXY_IP_HEADER): string {
	// Request headers are user-controlled unless a trusted proxy explicitly overwrites one.
	// A single IP is required: never choose an attacker-controlled entry from an XFF list.
	const candidate = trustedHeader ? headers.get(trustedHeader)?.trim() : undefined;
	if (!candidate || !isIP(candidate)) return "shared";
	const normalized = candidate.includes(":") ? new URL(`http://[${candidate}]/`).hostname.toLowerCase() : candidate;
	return `ip:${normalized}`;
}

type Counter = { expiresAt: number; count: number };

export class RateLimiter {
	private counters = new Map<string, Counter>();
	private maxEntries: number;
	private nextCleanup = 0;

	constructor(maxEntries = 10_000) {
		this.maxEntries = maxEntries;
	}

	consume(key: string, limit: number, windowMs: number, now = Date.now()) {
		if (now >= this.nextCleanup) {
			for (const [entryKey, counter] of this.counters) {
				if (counter.expiresAt <= now) this.counters.delete(entryKey);
			}
			this.nextCleanup = now + 60_000;
		}
		let counter = this.counters.get(key);
		if (!counter || counter.expiresAt <= now) {
			if (!counter && this.counters.size >= this.maxEntries) {
				return { allowed: false, remaining: 0, retryAfter: 60 };
			}
			counter = { count: 0, expiresAt: now + windowMs };
			this.counters.set(key, counter);
		}
		const retryAfter = Math.max(1, Math.ceil((counter.expiresAt - now) / 1000));
		if (counter.count >= limit) return { allowed: false, remaining: 0, retryAfter };
		counter.count += 1;
		return { allowed: true, remaining: limit - counter.count, retryAfter };
	}
}

// Use a finite set of buckets so arbitrary model names cannot create fresh quotas.
export function modelQuota(model: string): { bucket: string; limit: number } {
	const id = model.toLowerCase();
	if (id.includes("gpt-oss")) return { bucket: "gpt-oss", limit: 50 };
	if (id.includes("cosmosrp-3.0")) return { bucket: "cosmosrp-3.0", limit: 3 };
	if (id.includes("cosmosrp-3.5")) return { bucket: "cosmosrp-3.5", limit: 3 };
	if (id.includes("cosmosrp")) return { bucket: "cosmosrp", limit: 25 };
	return { bucket: "other", limit: 0 };
}

const rateLimitGlobal = globalThis as typeof globalThis & { __chatRateLimiter?: RateLimiter };
export const chatRateLimiter = rateLimitGlobal.__chatRateLimiter ??= new RateLimiter();
