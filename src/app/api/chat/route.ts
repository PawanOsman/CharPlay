import { NextRequest, NextResponse } from "next/server";
import type OpenAI from "openai";
import { createPawanClient } from "@/lib/pawan";
import { assertSameOrigin, chatRateLimiter, chatRequestSchema, clientRateLimitKey, modelQuota, readJsonBody, RequestError } from "@/lib/server-security";

export const runtime = "nodejs";

function rateLimitResponse(limit: number, retryAfter: number) {
	return NextResponse.json(
		{ error: { message: "Request limit reached. Please try again later.", type: "rate_limit_exceeded", code: 429 } },
		{ status: 429, headers: { "X-RateLimit-Limit": String(limit), "X-RateLimit-Remaining": "0", "Retry-After": String(retryAfter), "Cache-Control": "no-store" } }
	);
}

export async function POST(request: NextRequest) {
	try {
		assertSameOrigin(request);
		const clientKey = clientRateLimitKey(request.headers);
		const burst = chatRateLimiter.consume(`burst:${clientKey}`, 30, 60_000);
		if (!burst.allowed) return rateLimitResponse(30, burst.retryAfter);

		const parsed = chatRequestSchema.safeParse(await readJsonBody(request));
		if (!parsed.success) throw new RequestError("Invalid chat request. Check messages and generation settings.");
		const { messages, character, persona, settings: modelSettings } = parsed.data;
		const modelId = modelSettings.model.toLowerCase();
		const { bucket, limit } = modelQuota(modelId);
		if (!limit) throw new RequestError("This model requires your own API key.", 403);

		const openai = createPawanClient(modelId.includes("cosmosrp-it") ? "free-it" : modelId.includes("cosmosrp") ? "free" : "pro");
		if (!openai) throw new RequestError("The chat provider is not configured.", 503);

		const now = Date.now();
		const dayMs = 24 * 60 * 60 * 1000;
		const daily = chatRateLimiter.consume(`daily:${clientKey}:${bucket}`, limit, dayMs - (now % dayMs), now);
		if (!daily.allowed) return rateLimitResponse(limit, daily.retryAfter);
		const responseHeaders = {
			"X-RateLimit-Limit": String(limit),
			"X-RateLimit-Remaining": String(daily.remaining),
			"Cache-Control": "no-store",
		};

		// Build system prompt
		let systemPrompt = "";

		if (character) {
			systemPrompt += `You are ${character.name}. ${character.personality}\n\n`;

			if (character.scenario) {
				systemPrompt += `Scenario: ${character.scenario}\n\n`;
			}
			if (character.depth_prompt) {
				systemPrompt += `${character.depth_prompt}\n\n`;
			}
			if (character.example_dialogue) {
				systemPrompt += `Example dialogue:\n${character.example_dialogue}\n\n`;
			}
			if (character.system_prompt) {
				systemPrompt += `${character.system_prompt}\n\n`;
			}
			if (character.post_history_instructions) {
				systemPrompt += `Additional instructions: ${character.post_history_instructions}\n\n`;
			}
		}

		if (persona) {
			systemPrompt += `You are talking to ${persona.name}, ${persona.age} years old, ${persona.gender}, ${persona.appearance}, ${persona.traits}, ${persona.background}\n\n`;
		}

		systemPrompt += "Respond in character and maintain the personality and speaking style described above.";

		const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...messages.map((message): OpenAI.Chat.Completions.ChatCompletionMessageParam => {
				if (message.role === "system") return { role: "system", content: message.content };
				if (message.role === "assistant") return { role: "assistant", content: message.content };
				return {
					role: "user",
					content: message.image ? [
						{ type: "text", text: message.content },
						{ type: "image_url", image_url: { url: message.image } },
					] : message.content,
				};
			}),
		];
		const completionSettings = {
			model: modelSettings.model,
			messages: openaiMessages,
			max_tokens: modelSettings.max_tokens,
			temperature: modelSettings.temperature,
			top_p: modelSettings.top_p,
			frequency_penalty: modelSettings.frequency_penalty,
			presence_penalty: modelSettings.presence_penalty,
		};

		if (modelSettings.streaming) {
			const abortController = new AbortController();
			const signal = AbortSignal.any([request.signal, abortController.signal]);
			const completion = await openai.chat.completions.create({ ...completionSettings, stream: true }, { signal });
			const iterator = completion[Symbol.asyncIterator]();
			const encoder = new TextEncoder();
			const stream = new ReadableStream<Uint8Array>({
				async pull(controller) {
					try {
						while (true) {
							const { done, value } = await iterator.next();
							if (done) {
								controller.enqueue(encoder.encode("data: [DONE]\n\n"));
								controller.close();
								return;
							}
							const content = value.choices[0]?.delta?.content;
							if (content) {
								controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
								return;
							}
						}
					} catch {
						abortController.abort();
						controller.error(new Error("The response stream was interrupted."));
					}
				},
				async cancel() {
					abortController.abort();
					await iterator.return?.();
				},
			});
			return new Response(stream, {
				headers: { ...responseHeaders, "Content-Type": "text/stream; charset=utf-8", "X-Accel-Buffering": "no" },
			});
		}

		const completion = await openai.chat.completions.create({ ...completionSettings, stream: false }, { signal: request.signal });
		return NextResponse.json(
			{ message: completion.choices[0]?.message?.content || "I apologize, but I couldn't generate a response." },
			{ headers: responseHeaders }
		);
	} catch (error) {
		// Provider errors can contain credentials, request contents, or internal details.
		const status = error instanceof RequestError ? error.status : 502;
		const message = error instanceof RequestError ? error.message : "The chat provider could not complete the request. Please try again.";
		return NextResponse.json({ error: { message, type: status < 500 ? "invalid_request_error" : "server_error", code: status } }, { status, headers: { "Cache-Control": "no-store" } });
	}
}
