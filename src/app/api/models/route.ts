import { NextRequest, NextResponse } from "next/server";
import { createPawanClient } from "@/lib/pawan";
import { assertSameOrigin, RequestError } from "@/lib/server-security";

export const runtime = "nodejs";

type ModelOption = { id: string; name: string; owner: string; description?: string; order?: number };
let cache: { expiresAt: number; models: ModelOption[] } | undefined;
let pending: Promise<ModelOption[]> | undefined;

async function loadModels(): Promise<ModelOption[]> {
	const free = createPawanClient("free");
	const pro = createPawanClient("pro");
	if (!free || !pro) throw new RequestError("The chat provider is not configured.", 503);
	const responses = await Promise.all([free.models.list(), pro.models.list()]);
	return responses.flatMap((response) => response.data).map((model) => {
		const details = model as typeof model & { name?: unknown; description?: unknown; order?: unknown };
		return {
			id: model.id,
			name: typeof details.name === "string" ? details.name : model.id,
			owner: model.owned_by,
			description: typeof details.description === "string" ? details.description : undefined,
			order: typeof details.order === "number" ? details.order : undefined,
		};
	}).sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET(request: NextRequest) {
	try {
		assertSameOrigin(request);
		if (!cache || cache.expiresAt <= Date.now()) {
			// Coalesce simultaneous public requests instead of multiplying credentialed upstream calls.
			pending ??= loadModels().then((models) => {
				cache = { models, expiresAt: Date.now() + 5 * 60_000 };
				return models;
			}).finally(() => { pending = undefined; });
			await pending;
		}
		return NextResponse.json(cache!.models, { headers: { "Cache-Control": "public, max-age=60" } });
	} catch (error) {
		const status = error instanceof RequestError ? error.status : 502;
		const message = error instanceof RequestError ? error.message : "Unable to load models. Please try again.";
		return NextResponse.json({ error: { message, type: "server_error", code: status } }, { status, headers: { "Cache-Control": "no-store" } });
	}
}
