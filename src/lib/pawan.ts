import OpenAI from "openai";

export function createPawanClient(tier: "pro" | "free" | "free-it") {
	const apiKey = process.env.PAWANKRD_API_KEY;
	if (!apiKey) return null;
	const baseURL = tier === "pro" ? "https://api.pawan.krd/v1/" : tier === "free-it" ? "https://api.pawan.krd/cosmosrp-it/v1/" : "https://api.pawan.krd/cosmosrp/v1/";
	return new OpenAI({ apiKey, baseURL, timeout: 60_000, maxRetries: 0 });
}
