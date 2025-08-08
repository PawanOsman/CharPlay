import { Character, Persona } from "@/types";

/**
 * Replace placeholder variables in text with actual values
 * @param text - Text containing {{char}} and {{user}} placeholders
 * @param character - Character object to replace {{char}} with
 * @param persona - Persona object to replace {{user}} with (optional)
 * @returns Text with placeholders replaced
 */
export function replacePlaceholders(text: string, character: Character, persona?: Persona | null): string {
	if (!text) return text;

	let result = text;

	// Replace {{char}} with character name
	result = result.replace(/\{\{char\}\}/gi, character.name);

	// Replace {{user}} with persona name (if available) or "User"
	const userName = persona?.name || "User";
	result = result.replace(/\{\{user\}\}/gi, userName);

	return result;
}

/**
 * Apply placeholder replacement to all text fields in a character object
 * @param character - Character object to process
 * @param persona - Persona object for {{user}} replacement (optional)
 * @returns Character object with placeholders replaced
 */
export function replaceCharacterPlaceholders(character: Character, persona?: Persona | null): Character {
	return {
		...character,
		description: replacePlaceholders(character.description, character, persona),
		personality: replacePlaceholders(character.personality, character, persona),
		first_mes: replacePlaceholders(character.first_mes, character, persona),
		scenario: replacePlaceholders(character.scenario, character, persona),
		depth_prompt: character.depth_prompt ? replacePlaceholders(character.depth_prompt, character, persona) : character.depth_prompt,
		example_dialogue: character.example_dialogue ? replacePlaceholders(character.example_dialogue, character, persona) : character.example_dialogue,
		system_prompt: character.system_prompt ? replacePlaceholders(character.system_prompt, character, persona) : character.system_prompt,
		post_history_instructions: character.post_history_instructions ? replacePlaceholders(character.post_history_instructions, character, persona) : character.post_history_instructions,
		creator_notes: character.creator_notes ? replacePlaceholders(character.creator_notes, character, persona) : character.creator_notes,
		alternate_greetings: character.alternate_greetings?.map((greeting) => replacePlaceholders(greeting, character, persona)),
		mes_example: character.mes_example ? replacePlaceholders(character.mes_example, character, persona) : character.mes_example,
	};
}
