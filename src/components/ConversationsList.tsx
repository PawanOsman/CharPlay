"use client";

import { useState } from "react";
import { Conversation, Character } from "@/types";
import { MessageSquare, Plus, Trash2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ConversationsListProps {
	character: Character;
	conversations: Conversation[];
	activeConversationId: string | null;
	onConversationSelect: (conversation: Conversation) => void;
	onNewConversation: () => void;
	onDeleteConversation: (conversationId: string) => void;
	onRenameConversation: (conversationId: string, newTitle: string) => void;
	onBackToHome: () => void;
}

export default function ConversationsList({ character, conversations, activeConversationId, onConversationSelect, onNewConversation, onDeleteConversation, onRenameConversation, onBackToHome }: ConversationsListProps) {
	const [deleteConfirmConversationId, setDeleteConfirmConversationId] = useState<string | null>(null);
	const [renamingConversation, setRenamingConversation] = useState<{
		id: string;
		title: string;
	} | null>(null);

	const handleDeleteConversation = (conversationId: string) => {
		onDeleteConversation(conversationId);
		setDeleteConfirmConversationId(null);
	};

	const handleRenameConversation = (conversationId: string, currentTitle: string) => {
		setRenamingConversation({ id: conversationId, title: currentTitle });
	};

	const handleSaveRename = () => {
		if (renamingConversation && renamingConversation.title.trim()) {
			onRenameConversation(renamingConversation.id, renamingConversation.title.trim());
			setRenamingConversation(null);
		}
	};

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="border-b bg-background/80 p-3 backdrop-blur">
				<div className="flex flex-col items-center gap-2 py-2">
					<Avatar className="h-16 w-16 overflow-hidden rounded-lg">
						{character.avatar.startsWith("http") || character.avatar.startsWith("data:") ? <AvatarImage className="h-full w-full object-cover" src={character.avatar} /> : null}
						<AvatarFallback className="rounded-lg text-xl">{!character.avatar.startsWith("http") && !character.avatar.startsWith("data:") && character.avatar}</AvatarFallback>
					</Avatar>
					<div className="text-center">
						<div className="mx-auto max-w-[180px] truncate text-sm font-medium leading-tight">{character.name}</div>
					</div>
				</div>

				<div className="flex justify-center gap-2 pt-2">
					<Button onClick={onBackToHome}>← Back</Button>
					<Button onClick={onNewConversation}>
						<Plus className="mr-1 h-4 w-4" /> New Conversation
					</Button>
				</div>
			</div>

			{/* List */}
			<div className="flex-1 overflow-y-auto p-2">
				{conversations.length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center gap-2 text-center">
						<MessageSquare className="h-10 w-10 text-muted-foreground" />
						<p className="text-muted-foreground text-sm">No conversations yet. Start your first chat!</p>
					</div>
				) : (
					<ul className="space-y-1">
						{[...conversations]
							.sort((a, b) => b.updatedAt - a.updatedAt)
							.map((conversation) => (
								<li key={conversation.id}>
									<button className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${activeConversationId === conversation.id ? "border-l-4 border-primary bg-muted/40" : "hover:bg-muted/30"}`} onClick={() => onConversationSelect(conversation)}>
										<div className="flex items-center justify-between gap-2">
											<div className="min-w-0">
												<div className="truncate font-medium">{conversation.title}</div>
												<div className="text-muted-foreground flex items-center gap-2 text-xs">
													<span>{conversation.messages.length} messages</span>
													<span>{new Date(conversation.updatedAt).toLocaleDateString()}</span>
												</div>
											</div>
											<div className="flex items-center gap-1">
												<Button
													variant="ghost"
													size="icon"
													onClick={(e) => {
														e.stopPropagation();
														handleRenameConversation(conversation.id, conversation.title);
													}}
													title="Rename conversation"
												>
													<Edit3 className="h-4 w-4" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													onClick={(e) => {
														e.stopPropagation();
														setDeleteConfirmConversationId(conversation.id);
													}}
													title="Delete conversation"
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</div>
									</button>
								</li>
							))}
					</ul>
				)}
			</div>

			<Dialog open={!!deleteConfirmConversationId} onOpenChange={(open) => !open && setDeleteConfirmConversationId(null)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete Conversation</DialogTitle>
						<DialogDescription>Are you sure you want to delete this conversation? All messages will be lost.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteConfirmConversationId(null)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={() => deleteConfirmConversationId && handleDeleteConversation(deleteConfirmConversationId)}>
							Delete Conversation
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={!!renamingConversation} onOpenChange={(open) => !open && setRenamingConversation(null)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Rename Conversation</DialogTitle>
					</DialogHeader>
					<div>
						<Input value={renamingConversation?.title || ""} onChange={(e) => setRenamingConversation((prev) => (prev ? { ...prev, title: e.target.value } : null))} placeholder="Enter conversation title..." autoFocus />
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setRenamingConversation(null)}>
							Cancel
						</Button>
						<Button onClick={handleSaveRename} disabled={!renamingConversation?.title.trim()}>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
