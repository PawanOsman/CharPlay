"use client";

import { Character } from "@/types";
import { replacePlaceholders } from "@/utils/placeholders";
import { Trash2, Info, BadgeCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogDescription } from "@/components/ui/dialog";
import CharacterInfoDialog from "@/components/CharacterInfoDialog";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import * as React from "react";

interface CharacterCardProps {
	character: Character;
	onClick: () => void;
	onDelete?: () => void;
	isUploadedCharacter?: boolean;
}

export default function CharacterCard({ character, onClick, onDelete, isUploadedCharacter = false }: CharacterCardProps) {
	const [infoOpen, setInfoOpen] = React.useState(false);
	const ignoreNextCardClickRef = React.useRef(false);
	const [globalSettings] = useLocalStorage<{ italicColor?: string }>("global-conversation-settings", { italicColor: "#8b5cf6" });

	const handleCardClick = () => {
		if (infoOpen || ignoreNextCardClickRef.current) {
			// Reset the flag so only the immediate next click is ignored
			ignoreNextCardClickRef.current = false;
			return;
		}
		onClick();
	};

	return (
		<Card onClick={handleCardClick} className="group relative h-full cursor-pointer border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md">
			{/* Info button top-left */}
			<Button
				variant="ghost"
				size="icon"
				className="absolute left-2 top-2 z-10 text-muted-foreground hover:text-foreground cursor-pointer"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					setInfoOpen(true);
				}}
				title="View info"
			>
				<Info className="h-4 w-4" />
			</Button>
			{isUploadedCharacter && onDelete && (
				<Button
					variant="ghost"
					size="icon"
					className="absolute right-2 top-2 z-10 text-destructive hover:text-destructive"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onDelete();
					}}
					title="Delete character"
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			)}

			{/* Verified badge for default (predefined) characters */}
			{!isUploadedCharacter && (
				<div className="pointer-events-none absolute right-2 top-2 z-10 text-green-500" aria-label="Verified">
					<BadgeCheck className="h-4 w-4" />
				</div>
			)}

			<CardContent className="flex flex-col items-center gap-3 p-4 text-center sm:p-6">
				<div className="mb-1 flex justify-center">
					<Avatar className="size-20 rounded-xl object-cover border">
						{character.avatar.startsWith("http") || character.avatar.startsWith("data:") ? <AvatarImage className="object-cover" src={character.avatar} alt={character.name} /> : null}
						<AvatarFallback className="rounded-xl text-xl sm:text-2xl">{character.avatar}</AvatarFallback>
					</Avatar>
				</div>

				<div className="flex min-h-0 flex-1 flex-col items-center gap-1">
					<div className="text-base font-semibold sm:text-lg">{character.name}</div>
					{character.creator ? <div className="text-muted-foreground text-xs sm:text-sm">by {character.creator}</div> : null}

					{character.tags.length > 0 ? (
						<div className="my-1 flex min-h-6 flex-wrap justify-center gap-1">
							{character.tags.slice(0, 3).map((tag) => (
								<Badge key={tag} variant="secondary" className="px-2 py-0.5 text-[10px] sm:text-xs">
									{tag}
								</Badge>
							))}
						</div>
					) : null}

					<p className="line-clamp-3 flex-1 text-center text-sm text-muted-foreground">{replacePlaceholders(character.description, character)}</p>
				</div>
			</CardContent>

			<CharacterInfoDialog
				character={character}
				open={infoOpen}
				onOpenChange={setInfoOpen}
				italicColor={globalSettings?.italicColor}
				onOverlayPointerDown={() => {
					ignoreNextCardClickRef.current = true;
				}}
			/>
		</Card>
	);
}
