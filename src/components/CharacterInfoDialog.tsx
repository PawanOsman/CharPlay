"use client";

import { Character } from "@/types";
import { replacePlaceholders } from "@/utils/placeholders";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as React from "react";

export interface CharacterInfoDialogProps {
	character: Character;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onOverlayPointerDown?: () => void;
	italicColor?: string;
}

export default function CharacterInfoDialog({ character, open, onOpenChange, onOverlayPointerDown, italicColor }: CharacterInfoDialogProps) {
	const effectiveItalicColor = italicColor || "hsl(var(--muted-foreground))";
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="w-[100vw] h-[100dvh] max-w-[100vw] rounded-none m-0 p-4 overflow-y-auto sm:max-w-lg sm:max-h-[80vh] sm:h-auto sm:rounded-lg sm:m-auto sm:p-6"
				onPointerDownOutside={() => {
					onOverlayPointerDown?.();
				}}
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-3">
						<Avatar className="size-10 rounded-lg border">
							{character.avatar.startsWith("http") || character.avatar.startsWith("data:") ? <AvatarImage className="object-cover" src={character.avatar} alt={character.name} /> : null}
							<AvatarFallback className="rounded-lg">{character.avatar}</AvatarFallback>
						</Avatar>
						<span>{character.name}</span>
					</DialogTitle>
					{character.creator ? <DialogDescription>by {character.creator}</DialogDescription> : null}
				</DialogHeader>

				{character.tags?.length ? (
					<div className="flex flex-wrap gap-1">
						{character.tags.map((tag) => (
							<Badge key={tag} variant="secondary" className="px-2 py-0.5 text-[10px] sm:text-xs">
								{tag}
							</Badge>
						))}
					</div>
				) : null}

				{character.description ? <div className="mt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{replacePlaceholders(character.description, character)}</div> : null}

				{character.personality ? (
					<div className="mt-4">
						<div className="text-sm font-medium">Personality</div>
						<div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{character.personality}</div>
					</div>
				) : null}

				{character.scenario ? (
					<div className="mt-4">
						<div className="text-sm font-medium">Scenario</div>
						<div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{character.scenario}</div>
					</div>
				) : null}

				{character.first_mes ? (
					<div className="mt-4">
						<div className="text-sm font-medium">Greeting</div>
						<div className="mt-1 text-sm text-muted-foreground prose prose-sm max-w-none whitespace-pre-wrap">
							<ReactMarkdown
								remarkPlugins={[remarkGfm]}
								components={{
									em: ({ node, ...props }) => <em style={{ color: effectiveItalicColor }} {...props} />,
									i: ({ node, ...props }) => <i style={{ color: effectiveItalicColor }} {...props} />,
								}}
							>
								{character.first_mes}
							</ReactMarkdown>
						</div>
					</div>
				) : null}

				{character.example_dialogue ? (
					<div className="mt-4">
						<div className="text-sm font-medium">Example Dialogue</div>
						<div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{character.example_dialogue}</div>
					</div>
				) : null}

				{character.creator_notes ? (
					<div className="mt-4">
						<div className="text-sm font-medium">Creator Notes</div>
						<div className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{character.creator_notes}</div>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	);
}


