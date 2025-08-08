import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai_pro = new OpenAI({
	baseURL: "https://api.pawan.krd/v1/",
	apiKey: process.env.PAWANKRD_API_KEY,
});

const openai_free = new OpenAI({
	baseURL: "https://api.pawan.krd/cosmosrp/v1/",
	apiKey: process.env.PAWANKRD_API_KEY,
});

const openai_free_it = new OpenAI({
	baseURL: "https://api.pawan.krd/cosmosrp-it/v1/",
	apiKey: process.env.PAWANKRD_API_KEY,
});

export async function POST(request: NextRequest) {
	try {
		const { messages, character, persona, settings } = await request.json();

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

		// Prepare messages for OpenAI without placeholder replacement
		const openaiMessages = [
			{ role: "system" as const, content: systemPrompt },
			...messages.map((msg: any) => ({
				role: msg.role as "user" | "assistant",
				content: msg.image
					? [
							{ type: "text", text: msg.content },
							{ type: "image_url", image_url: { url: msg.image } },
					  ]
					: msg.content,
			})),
		];

		// Use settings from conversation or defaults
		const modelSettings = settings || {
			model: "cosmosrp",
			temperature: 0.7,
			max_tokens: 1000,
		};

		// Rate limiting per IP per model per day (in-memory)
		const getClientIp = (): string => {
			// Cloudflare specific headers
			const cfConnectingIp = request.headers.get("cf-connecting-ip");
			if (cfConnectingIp && cfConnectingIp.trim()) return cfConnectingIp.trim();
			const trueClientIp = request.headers.get("true-client-ip");
			if (trueClientIp && trueClientIp.trim()) return trueClientIp.trim();

			// Standard proxy headers
			const xff = request.headers.get("x-forwarded-for");
			if (xff) {
				const first = xff.split(",")[0]?.trim();
				if (first) return first;
			}
			const xreal = request.headers.get("x-real-ip");
			if (xreal && xreal.trim()) return xreal.trim();

			// Next.js runtime may expose ip
			// @ts-ignore
			return (request as any).ip || "unknown";
		};

		const getToday = (): string => new Date().toISOString().slice(0, 10);

		type Counter = { date: string; count: number };
		const counters: Map<string, Counter> = (global as any).__ip_model_counters__ || new Map<string, Counter>();
		(global as any).__ip_model_counters__ = counters;

		const normalizeModel = (m: string): string => String(m || "").toLowerCase();
		const modelId = normalizeModel(modelSettings.model);

		const getDailyLimitForModel = (m: string): number => {
			const id = normalizeModel(m);
			if (id.includes("cosmosrp-3.5")) return 3; // daily limit for cosmosrp-it
			if (id.includes("cosmosrp")) return 25; // daily limit for cosmosrp-it
			return 0; // default for pro and others
		};

		const ip = getClientIp();

		if (!ip || ip === "unknown") {
			return NextResponse.json({ error: { message: "We couldn't verify your browser, please try again or visit discord.gg/pawan to create your own key.", type: "ip_not_found", code: 400 } }, { status: 400 });
		}

		const key = `${ip}::${modelId}`;
		const today = getToday();
		const limit = getDailyLimitForModel(modelId);
		const current = counters.get(key);
		if (!current || current.date !== today) {
			counters.set(key, { date: today, count: 0 });
		}
		const fresh = counters.get(key)!;
		if (fresh.count >= limit) {
			const headers = new Headers({
				"Content-Type": "application/json",
				"X-RateLimit-Limit": String(limit),
				"X-RateLimit-Remaining": "0",
			});
			return new NextResponse(
				JSON.stringify({
					error: { message: "Daily limit reached for this model.", type: "rate_limit_exceeded", code: 429 },
				}),
				{ status: 429, headers }
			);
		}
		// Count this attempt
		fresh.count += 1;
		const remainingAfter = Math.max(0, limit - fresh.count);

		// Select base client by model name
		const openai = modelId.includes("cosmosrp-it") ? openai_free_it : modelId.includes("cosmosrp") ? openai_free : openai_pro;

		const completion = await openai.chat.completions.create({
			model: modelSettings.model,
			messages: openaiMessages,
			max_tokens: modelSettings.max_tokens,
			temperature: modelSettings.temperature,
			top_p: modelSettings.top_p,
			frequency_penalty: modelSettings.frequency_penalty,
			presence_penalty: modelSettings.presence_penalty,
			stream: modelSettings.streaming || false,
		});

		if (modelSettings.streaming) {
			// Return streaming response
			const stream = new ReadableStream({
				async start(controller) {
					try {
						for await (const chunk of completion as any) {
							const content = chunk.choices[0]?.delta?.content || "";
							if (content) {
								controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
							}
						}
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
						controller.close();
					} catch (error) {
						controller.error(error);
					}
				},
			});

			return new Response(stream, {
				headers: {
					"Content-Type": "text/stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
					"X-RateLimit-Limit": String(limit),
					"X-RateLimit-Remaining": String(remainingAfter),
				},
			});
		} else {
			// Return regular JSON response
			const responseMessage = completion.choices[0]?.message?.content || "I apologize, but I couldn't generate a response.";
			const headers = new Headers({
				"X-RateLimit-Limit": String(limit),
				"X-RateLimit-Remaining": String(remainingAfter),
			});
			return NextResponse.json({ message: responseMessage }, { headers });
		}
	} catch (error) {
		console.error("OpenAI API error:", error);
		return NextResponse.json(
			{
				error: {
					message: (error as any)?.error?.message || (error as any)?.message || "Failed to generate response",
					type: (error as any)?.error?.type || "server_error",
					code: (error as any)?.error?.code || undefined,
				},
			},
			{ status: 500 }
		);
	}
}
