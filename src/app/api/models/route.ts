import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai_pro = new OpenAI({
	baseURL: "https://api.pawan.krd/v1/",
	apiKey: process.env.PAWANKRD_API_KEY,
});

const openai_free = new OpenAI({
	baseURL: "https://api.pawan.krd/cosmosrp/v1/",
	apiKey: process.env.PAWANKRD_API_KEY,
});

export async function GET() {
	try {
		const models_free = await openai_free.models.list();
		const models_pro = await openai_pro.models.list();

		const models: any = [...models_free.data, ...models_pro.data];

		// Filter for chat completion models and format them
		const chatModels = models
			.map((model: any) => ({
				id: model.id,
				name: model.name,
				owner: model.owned_by,
				description: model.description,
				order: model.order,
			}))
			.sort((a: any, b: any) => a.name.localeCompare(b.name));

        return NextResponse.json(chatModels);
	} catch (error) {
		console.error("Error fetching models:", error);
        return NextResponse.json(
            {
                error: {
                    message: (error as any)?.error?.message || (error as any)?.message || "Failed to fetch models",
                    type: (error as any)?.error?.type || "server_error",
                    code: (error as any)?.error?.code || undefined,
                },
            },
            { status: 500 }
        );
	}
}
