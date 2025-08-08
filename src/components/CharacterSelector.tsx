"use client";

import { Character, CharacterCardV2 } from "@/types";
import { predefinedCharacters } from "@/data/characters";
import { useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface CharacterSelectorProps {
	selectedCharacter: Character | null;
	onCharacterSelect: (character: Character) => void;
	onClose: () => void;
	isStartupMode?: boolean;
}

export default function CharacterSelector({ selectedCharacter, onCharacterSelect, onClose, isStartupMode = false }: CharacterSelectorProps) {
	const [uploadedCharacters, setUploadedCharacters] = useState<Character[]>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem("uploaded-characters");
				return saved ? JSON.parse(saved) : [];
			} catch {
				return [];
			}
		}
		return [];
	});

	const parseCharacterFile = (characterData: any): Character => {
		// Check if it's a Character Card v2 format
		if (characterData.spec && characterData.data) {
			const cardData = characterData as CharacterCardV2;
			return {
				id: `character-${Date.now()}`,
				name: cardData.data.name || "Unknown",
				description: cardData.data.description || "",
				avatar: cardData.data.avatar || "👤",
				tags: cardData.data.tags || [],
				personality: cardData.data.personality || "",
				first_mes: cardData.data.first_mes || "Hello!",
				scenario: cardData.data.scenario || "",
				depth_prompt: cardData.data.extensions?.depth_prompt?.prompt || "",
				example_dialogue: cardData.data.mes_example || "",
				creator: cardData.data.creator,
				creator_notes: cardData.data.creator_notes,
				alternate_greetings: cardData.data.alternate_greetings,
				character_version: cardData.data.character_version,
				mes_example: cardData.data.mes_example,
				post_history_instructions: cardData.data.post_history_instructions,
				system_prompt: cardData.data.system_prompt,
			};
		}

		// Legacy format or basic format
		return {
			id: characterData.id || `custom-${Date.now()}`,
			name: characterData.name || characterData.char_name || "Unknown",
			description: characterData.description || characterData.char_persona || "",
			avatar: characterData.avatar || "👤",
			tags: characterData.tags || [],
			personality: characterData.personality || characterData.char_persona || "",
			first_mes: characterData.first_mes || characterData.char_greeting || "Hello!",
			scenario: characterData.scenario || characterData.world_scenario || "",
			depth_prompt: characterData.depth_prompt || "",
			example_dialogue: characterData.example_dialogue || characterData.mes_example || "",
		};
	};

	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const content = e.target?.result as string;
					const characterData = JSON.parse(content);
					const character = parseCharacterFile(characterData);

					const newCharacters = [...uploadedCharacters, character];
					setUploadedCharacters(newCharacters);
					localStorage.setItem("uploaded-characters", JSON.stringify(newCharacters));
					onCharacterSelect(character);
				} catch (error) {
					console.error("Error parsing character file:", error);
					alert("Error parsing character file. Please check the format.");
				}
			};
			reader.readAsText(file);
		}
	};

	const allCharacters = [...predefinedCharacters, ...uploadedCharacters];

	if (isStartupMode) {
		return (
			<div className="mx-auto w-full max-w-6xl p-4">
				<Card>
					<div className="border-b p-6">
						<div className="space-y-1">
							<div className="text-2xl font-semibold">Select Character</div>
							<div className="text-muted-foreground">Choose a character to start your conversation</div>
						</div>
					</div>
					<div className="space-y-6 p-6">
						<div>
							<Button asChild variant="outline" className="w-full border-dashed">
								<label className="cursor-pointer py-6">
									<span className="inline-flex items-center gap-2">
										<Upload className="h-4 w-4" /> Upload Character JSON
									</span>
									<input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
								</label>
							</Button>
						</div>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
							{allCharacters.map((character) => (
								<Card key={character.id} onClick={() => onCharacterSelect(character)} className={`transition hover:-translate-y-0.5 hover:shadow ${selectedCharacter?.id === character.id ? "ring-1 ring-primary" : ""}`}>
									<CardContent className="p-4 text-center">
										<div className="mb-2 flex justify-center">
											<Avatar className="size-16 object-cover">
												{character.avatar.startsWith("http") || character.avatar.startsWith("data:") ? <AvatarImage className="object-cover" src={character.avatar} /> : null}
												<AvatarFallback className="text-xl">{!character.avatar.startsWith("http") && !character.avatar.startsWith("data:") && character.avatar}</AvatarFallback>
											</Avatar>
										</div>
										<div className="space-y-1">
											<div className="font-medium">{character.name}</div>
											{character.creator ? <div className="text-muted-foreground text-xs">by {character.creator}</div> : null}
											<div className="my-1 flex flex-wrap justify-center gap-1">
												{character.tags.slice(0, 2).map((tag) => (
													<Badge key={tag} variant="secondary" className="px-2 py-0.5 text-[10px]">
														{tag}
													</Badge>
												))}
											</div>
											<div className="line-clamp-3 text-xs text-muted-foreground">{character.description}</div>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</div>
				</Card>
			</div>
		);
	}

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[80vh] w-[90vw] max-w-5xl overflow-auto">
				<DialogHeader>
					<DialogTitle>Select Character</DialogTitle>
					<DialogDescription>Choose a character to start your conversation</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<Button asChild variant="outline" className="w-full border-dashed">
						<label className="cursor-pointer py-4">
							<span className="inline-flex items-center gap-2">
								<Upload className="h-4 w-4" /> Upload Character JSON
							</span>
							<input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
						</label>
					</Button>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
						{allCharacters.map((character) => (
							<Card key={character.id} onClick={() => onCharacterSelect(character)} className={`transition hover:-translate-y-0.5 hover:shadow ${selectedCharacter?.id === character.id ? "ring-1 ring-primary" : ""}`}>
								<CardContent className="p-3 text-center">
									<div className="mb-2 flex justify-center">
										<Avatar className="size-12 object-cover">
											{character.avatar.startsWith("http") ? <AvatarImage className="object-cover" src={character.avatar} /> : null}
											<AvatarFallback className="text-lg">{!character.avatar.startsWith("http") && character.avatar}</AvatarFallback>
										</Avatar>
									</div>
									<div className="space-y-1">
										<div className="text-sm font-medium">{character.name}</div>
										{character.creator ? <div className="text-muted-foreground text-[11px]">by {character.creator}</div> : null}
										<div className="my-1 flex flex-wrap justify-center gap-1">
											{character.tags.slice(0, 2).map((tag) => (
												<Badge key={tag} variant="secondary" className="px-2 py-0.5 text-[10px]">
													{tag}
												</Badge>
											))}
										</div>
										<div className="line-clamp-2 text-[12px] text-muted-foreground">{character.description}</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
