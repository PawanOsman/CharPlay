export interface Message {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	image?: string;
	timestamp: number;
	variants?: string[];
	currentVariant?: number;
}

export interface Character {
	id: string;
	name: string;
	description: string;
	avatar: string; // Can be emoji or URL
	tags: string[];
	personality: string;
	first_mes: string;
	scenario: string;
	depth_prompt?: string;
	example_dialogue?: string;
	creator?: string;
	creator_notes?: string;
	alternate_greetings?: string[];
	character_version?: string;
	mes_example?: string;
	post_history_instructions?: string;
	system_prompt?: string;
}

// Character Card v2 format (standard format used by character.ai, SillyTavern, etc.)
export interface CharacterCardV2 {
	data: {
		avatar: string;
		name: string;
		first_mes: string;
		tags: string[];
		description: string;
		creator?: string;
		creator_notes?: string;
		alternate_greetings?: string[];
		character_version?: string;
		mes_example?: string;
		post_history_instructions?: string;
		system_prompt?: string;
		scenario?: string;
		personality?: string;
		extensions?: {
			depth_prompt?: {
				prompt?: string;
			};
		};
	};
	spec: string;
	spec_version: string;
}

export interface Persona {
	name: string;
	traits: string;
	background: string;
	/** Minimum 18 */
	age?: number;
	gender?: string;
	appearance?: string;
	/** Emoji or image URL */
	avatar?: string;
}

export interface ConversationSettings {
	provider?: "pawan" | "openai";
	/** Used when provider is "openai" to point to an OpenAI-compatible API (e.g., https://api.openai.com/v1) */
	apiBaseUrl?: string;
	/** Used when provider is "openai"; stored locally in the conversation settings */
	apiKey?: string;
	/** When provider is "pawan", allows users to use their own Pawan.Krd API key directly from the browser. Stored locally only. */
	pawanApiKey?: string;
	model: string;
	temperature: number;
	top_p: number;
	top_k: number;
	min_p: number;
	frequency_penalty: number;
	presence_penalty: number;
	max_tokens: number;
	repetition_penalty: number;
	italicColor: string;
	streaming: boolean;
}

export interface Conversation {
	id: string;
	title: string;
	characterId: string;
	messages: Message[];
	settings: ConversationSettings;
	createdAt: number;
	updatedAt: number;
}

export interface ChatSession {
	id: string;
	characterId: string;
	messages: Message[];
	persona: Persona;
	createdAt: number;
	updatedAt: number;
}
