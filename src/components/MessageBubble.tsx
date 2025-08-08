"use client";

import React from "react";
import { Message, ConversationSettings, Character, Persona } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RotateCcw, Trash2, User as UserIcon, ChevronLeft, ChevronRight, Edit3, MoreVertical } from "lucide-react";
import { replacePlaceholders } from "@/utils/placeholders";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface MessageBubbleProps {
	message: Message;
	onRegenerate?: () => void;
	onDelete?: () => void;
	onDeleteGeneration?: () => void;
	onDeleteFromHere?: () => void;
	onEdit?: (currentContent: string) => void;
	onSwitchVariant?: (variantIndex: number) => void;
	onSwitchGreeting?: (greetingIndex: number) => void;
	isLoading?: boolean;
	characterAvatar?: string;
	characterName?: string;
	character?: Character;
	persona?: Persona | null;
	settings?: ConversationSettings;
	isFirstMessage?: boolean;
	onRetry?: () => void;
}

export default function MessageBubble({ message, onRegenerate, onDelete, onDeleteGeneration, onDeleteFromHere, onEdit, onSwitchVariant, onSwitchGreeting, isLoading = false, characterAvatar = "🤖", characterName = "AI", character, persona, settings, isFirstMessage = false, onRetry }: MessageBubbleProps) {
	const isUser = message.role === "user";
	const hasVariants = message.variants && message.variants.length > 1;
	const currentVariant = message.currentVariant ?? 0;

	// First message greeting logic
	const allGreetings = isFirstMessage && character ? [character.first_mes, ...(character.alternate_greetings || [])] : [];
	const hasMultipleGreetings = allGreetings.length > 1;

	// Find current greeting index based on message content
	const currentGreetingIndex = isFirstMessage && character ? allGreetings.findIndex((greeting) => greeting === message.content) : -1;

	// Apply placeholder replacement to message content if character is available
	const displayContent = character ? replacePlaceholders(message.content, character, persona) : message.content;

	// Custom components for ReactMarkdown to apply italic color
	const markdownComponents = {
		em: ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) => (
			<em {...props} style={{ ...props.style, color: settings?.italicColor || "#8b5cf6" }}>
				{children}
			</em>
		),
	};

	return (
		<div className="w-full flex justify-center gap-3 px-2 py-1">
			{/* Avatar */}
			<Avatar className="mt-1 object-cover rounded-lg">
				{isUser ? (
					<>
						{persona?.avatar && (persona.avatar.startsWith("http") || persona.avatar.startsWith("data:")) ? <AvatarImage className="object-cover" src={persona.avatar} alt="You" /> : null}
						<AvatarFallback delayMs={0} className="rounded-lg">
							{persona?.avatar && !(persona.avatar.startsWith("http") || persona.avatar.startsWith("data:")) ? persona.avatar : persona?.name?.trim() ? persona.name.trim().charAt(0).toUpperCase() : <UserIcon className="h-4 w-4" />}
						</AvatarFallback>
					</>
				) : characterAvatar?.startsWith("http") || characterAvatar?.startsWith("data:") ? (
					<AvatarImage className="object-cover" src={characterAvatar} alt={characterName || "Character"} />
				) : (
					<AvatarFallback className="rounded-lg">{characterAvatar}</AvatarFallback>
				)}
			</Avatar>

			{/* Message */}
			<div className="flex w-full max-w-full flex-1 flex-col items-start">
				<div className="mb-1 text-xs font-medium text-muted-foreground">
					{isUser ? (persona?.name && persona.name.trim() ? `${persona.name} (You)` : "You") : characterName} - {new Date(message.timestamp).toLocaleTimeString()}
				</div>
				<Card className="w-full bg-card">
					<CardContent className="w-full text-left px-2 py-1 sm:px-3 sm:py-1.5">
						{message.image && (
							<div className="mb-2">
								<img src={message.image} alt="User uploaded" className="h-auto max-w-full rounded-md" />
							</div>
						)}
						<div className="prose prose-invert max-w-none text-sm [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
							<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
								{displayContent}
							</ReactMarkdown>
						</div>
						{isLoading && (
							<div className="mt-2 flex items-center gap-2 opacity-70">
								<div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
								<span className="text-xs">{characterName} is replying...</span>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Action buttons */}
				{!isUser && !isFirstMessage && (onRegenerate || onEdit || onDelete || onDeleteGeneration || onDeleteFromHere || hasVariants) && (
					<div className="mt-2 flex w-full items-center justify-between">
						<div className="flex items-center gap-1">
							{onRegenerate ? (
								<Button variant="ghost" size="icon" onClick={onRegenerate} title="Regenerate response">
									<RotateCcw className="h-4 w-4" />
								</Button>
							) : null}
							{onEdit ? (
								<Button variant="ghost" size="icon" onClick={() => onEdit(message.content)} title="Edit message">
									<Edit3 className="h-4 w-4" />
								</Button>
							) : null}
							{onDelete || onDeleteGeneration || onDeleteFromHere ? (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="icon">
											<MoreVertical className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start">
										{onDeleteGeneration && hasVariants ? (
											<DropdownMenuItem onClick={onDeleteGeneration}>
												<Trash2 className="mr-2 h-4 w-4" /> Delete generation
											</DropdownMenuItem>
										) : null}
										{onDelete ? (
											<DropdownMenuItem onClick={onDelete}>
												<Trash2 className="mr-2 h-4 w-4" /> Delete message
											</DropdownMenuItem>
										) : null}
										{onDeleteFromHere ? (
											<DropdownMenuItem onClick={onDeleteFromHere}>
												<Trash2 className="mr-2 h-4 w-4" /> Delete from here
											</DropdownMenuItem>
										) : null}
									</DropdownMenuContent>
								</DropdownMenu>
							) : null}
						</div>

						{hasVariants && onSwitchVariant ? (
							<div className="flex items-center gap-1">
								<Button variant="ghost" size="icon" onClick={() => onSwitchVariant(Math.max(0, currentVariant - 1))} disabled={currentVariant === 0} title="Previous variant">
									<ChevronLeft className="h-4 w-4" />
								</Button>
								<Button variant="outline" disabled className="h-8 min-w-12 px-3">
									{currentVariant + 1}/{message.variants!.length}
								</Button>
								<Button variant="ghost" size="icon" onClick={() => onSwitchVariant(Math.min(message.variants!.length - 1, currentVariant + 1))} disabled={currentVariant === message.variants!.length - 1} title="Next variant">
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						) : null}
					</div>
				)}

				{/* First message greeting switcher */}
				{!isUser && isFirstMessage && hasMultipleGreetings && onSwitchGreeting && currentGreetingIndex !== -1 ? (
					<div className="mt-2 flex w-full items-center justify-center">
						<div className="flex items-center gap-1">
							<Button variant="ghost" size="icon" onClick={() => onSwitchGreeting(Math.max(0, currentGreetingIndex - 1))} disabled={currentGreetingIndex === 0} title="Previous greeting">
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<Button variant="outline" disabled className="h-8 min-w-16 px-3">
								{currentGreetingIndex + 1}/{allGreetings.length}
							</Button>
							<Button variant="ghost" size="icon" onClick={() => onSwitchGreeting(Math.min(allGreetings.length - 1, currentGreetingIndex + 1))} disabled={currentGreetingIndex === allGreetings.length - 1} title="Next greeting">
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</div>
				) : null}

				{/* User actions: edit and dropdown delete menu; optional retry */}
				{isUser && (onEdit || onDelete || onDeleteFromHere || onRetry) ? (
					<div className="mt-2 flex w-full items-center justify-between">
						<div className="flex items-center gap-1">
							{onEdit ? (
								<Button variant="ghost" size="icon" onClick={() => onEdit(message.content)} title="Edit message">
									<Edit3 className="h-4 w-4" />
								</Button>
							) : null}
							{onDelete || onDeleteFromHere ? (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="icon">
											<MoreVertical className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										{onDelete ? (
											<DropdownMenuItem onClick={onDelete}>
												<Trash2 className="mr-2 h-4 w-4" /> Delete message
											</DropdownMenuItem>
										) : null}
										{onDeleteFromHere ? (
											<DropdownMenuItem onClick={onDeleteFromHere}>
												<Trash2 className="mr-2 h-4 w-4" /> Delete from here
											</DropdownMenuItem>
										) : null}
									</DropdownMenuContent>
								</DropdownMenu>
							) : null}
						</div>
						{onRetry ? (
							<Button variant="outline" size="sm" onClick={onRetry} title="Retry">
								<RotateCcw className="mr-2 h-4 w-4" /> Retry
							</Button>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}
