"use client";

import { Character, Persona } from "@/types";
import { X, Tag } from "lucide-react";
import { replacePlaceholders } from "@/utils/placeholders";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface CharacterProfileProps {
	character: Character;
	persona?: Persona | null;
	onClose: () => void;
}

export default function CharacterProfile({ character, persona, onClose }: CharacterProfileProps) {
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[80vh] overflow-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Character Profile</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col gap-6">
					{/* Header */}
					<div className="flex items-center gap-4">
						<Avatar className="object-cover">
							{character.avatar.startsWith("http") || character.avatar.startsWith("data:") ? <AvatarImage className="object-cover" src={character.avatar} /> : null}
							<AvatarFallback>{!character.avatar.startsWith("http") && !character.avatar.startsWith("data:") && character.avatar}</AvatarFallback>
						</Avatar>
						<div className="space-y-1">
							<div className="text-2xl font-semibold">{character.name}</div>
							{character.creator ? <div className="text-muted-foreground">Created by {character.creator}</div> : null}
							<div className="flex flex-wrap gap-1">
								{character.tags.map((tag) => (
									<Badge key={tag} variant="secondary" className="inline-flex items-center gap-1">
										<Tag className="h-3 w-3" /> {tag}
									</Badge>
								))}
							</div>
						</div>
					</div>

					<Separator />

					{/* Details */}
					<div className="space-y-4">
						<div>
							<div className="mb-1 text-sm font-medium">Description</div>
							<div className="text-sm text-muted-foreground">{replacePlaceholders(character.description, character, persona)}</div>
						</div>
						<div>
							<div className="mb-1 text-sm font-medium">Personality</div>
							<div className="text-sm text-muted-foreground">{replacePlaceholders(character.personality, character, persona)}</div>
						</div>
						{character.scenario ? (
							<div>
								<div className="mb-1 text-sm font-medium">Scenario</div>
								<div className="text-sm text-muted-foreground">{replacePlaceholders(character.scenario, character, persona)}</div>
							</div>
						) : null}

						<div>
							<div className="mb-1 text-sm font-medium">First Message</div>
							<Card>
								<CardContent>
									<div className="text-sm">{replacePlaceholders(character.first_mes, character, persona)}</div>
								</CardContent>
							</Card>
						</div>

						{character.example_dialogue ? (
							<div>
								<div className="mb-1 text-sm font-medium">Example Dialogue</div>
								<Card>
									<CardContent>
										<div className="whitespace-pre-wrap font-mono text-sm">{replacePlaceholders(character.example_dialogue, character, persona)}</div>
									</CardContent>
								</Card>
							</div>
						) : null}

						{character.creator_notes ? (
							<div>
								<div className="mb-1 text-sm font-medium">Creator Notes</div>
								<Card>
									<CardContent>
										<div className="whitespace-pre-wrap text-sm">{replacePlaceholders(character.creator_notes, character, persona)}</div>
									</CardContent>
								</Card>
							</div>
						) : null}

						{character.alternate_greetings && character.alternate_greetings.length > 0 ? (
							<div>
								<div className="mb-1 text-sm font-medium">Alternate Greetings</div>
								<div className="space-y-2">
									{character.alternate_greetings
										.filter((greeting) => greeting.trim())
										.map((greeting, index) => (
											<Card key={index}>
												<CardContent>
													<div className="text-sm">{replacePlaceholders(greeting, character, persona)}</div>
												</CardContent>
											</Card>
										))}
								</div>
							</div>
						) : null}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
