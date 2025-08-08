"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Character, Persona, Conversation, ConversationSettings } from "@/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import ConversationsList from "./ConversationsList";
import ConversationComponent from "./Conversation";
import { Menu } from "lucide-react";

interface ChatInterfaceProps {
	character: Character;
	onBackToHome: () => void;
	initialConversationId?: string;
}

const DEFAULT_SETTINGS: ConversationSettings = {
	provider: "pawan",
	apiBaseUrl: "https://api.openai.com/v1",
	apiKey: "",
	pawanApiKey: "",
	model: "cosmosrp",
	temperature: 0.7,
	top_p: 1,
	top_k: 0,
	min_p: 0.1,
	frequency_penalty: 0,
	presence_penalty: 0,
	max_tokens: 1000,
	repetition_penalty: 1,
	italicColor: "#8b5cf6",
	streaming: true,
};

export default function ChatInterface({ character, onBackToHome, initialConversationId }: ChatInterfaceProps) {
	const router = useRouter();
	const [conversations, setConversations] = useLocalStorage<Conversation[]>(`conversations-${character.id}`, []);
	const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId || null);
	const [persona, setPersona] = useLocalStorage<Persona | null>("user-persona", null);
	const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const [globalSettings, setGlobalSettings] = useLocalStorage<ConversationSettings>("global-conversation-settings", DEFAULT_SETTINGS);

	// Get active conversation
	const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

	// Validate initial conversation ID
	useEffect(() => {
		if (initialConversationId && conversations.length > 0) {
			const conversationExists = conversations.some((c) => c.id === initialConversationId);
			if (!conversationExists) {
				// If conversation doesn't exist, redirect to character page
				router.replace(`/character/${character.id}`);
				setActiveConversationId(null);
			}
		}
	}, [initialConversationId, conversations, character.id, router]);

	// Navigate to conversation URL instead of updating state immediately
	const handleConversationSelect = (conversation: Conversation) => {
		if (!initialConversationId) {
			// If we're on character page, navigate to conversation URL
			router.push(`/character/${character.id}/conversation/${conversation.id}`);
		} else {
			// If we're already on a conversation page, just update the state
			setActiveConversationId(conversation.id);
		}
	};

	// Auto-open latest conversation when landing on character page (no initialConversationId)
	useEffect(() => {
		if (!initialConversationId && conversations.length > 0) {
			const latest = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)[0];
			if (latest) {
				router.replace(`/character/${character.id}/conversation/${latest.id}`);
			}
		}
	}, [initialConversationId, conversations, character.id, router]);

	// Update URL when active conversation changes (only for conversation pages)
	useEffect(() => {
		if (initialConversationId && activeConversationId && activeConversationId !== initialConversationId) {
			router.replace(`/character/${character.id}/conversation/${activeConversationId}`);
		} else if (initialConversationId && !activeConversationId) {
			router.replace(`/character/${character.id}`);
		}
	}, [activeConversationId, character.id, router, initialConversationId]);

	const createNewConversation = () => {
		const newConversation: Conversation = {
			id: uuidv4().slice(0, 8),
			title: `Chat ${conversations.length + 1}`,
			characterId: character.id,
			messages: [
				{
					id: uuidv4(),
					role: "assistant",
					content: character.first_mes,
					timestamp: Date.now(),
				},
			],
			settings: { ...globalSettings },
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		setConversations((prev) => [...prev, newConversation]);

		if (!initialConversationId) {
			// If we're on character page, navigate to new conversation URL
			router.push(`/character/${character.id}/conversation/${newConversation.id}`);
		} else {
			// If we're already on a conversation page, just update the state
			setActiveConversationId(newConversation.id);
		}
	};

	const updateConversation = (conversationId: string, updates: Partial<Conversation>) => {
		setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, ...updates, updatedAt: Date.now() } : c)));
	};

	const deleteConversation = (conversationId: string) => {
		setConversations((prev) => prev.filter((c) => c.id !== conversationId));
		if (activeConversationId === conversationId) {
			// If deleting active conversation, navigate back to character page
			router.push(`/character/${character.id}`);
		}
	};

	const renameConversation = (conversationId: string, newTitle: string) => {
		setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, title: newTitle, updatedAt: Date.now() } : c)));
	};

	const handleConversationUpdate = (updates: Partial<Conversation>) => {
		if (!activeConversation) return;
		updateConversation(activeConversation.id, updates);
	};

	const handleGlobalSettingsChange = (settings: ConversationSettings) => {
		setGlobalSettings(settings);
		// propagate to all conversations so they stay in sync
		setConversations((prev) => prev.map((c) => ({ ...c, settings, updatedAt: Date.now() })));
	};

	return (
		<div className="flex h-screen flex-col bg-background">
			{/* Mobile Header */}
			<div className="flex items-center border-b p-2 md:hidden">
				<Button variant="ghost" size="icon" className="mr-2" onClick={() => setMobileDrawerOpen(true)}>
					<Menu className="h-5 w-5" />
				</Button>
				<div>
					<div className="text-sm font-semibold">{character.name}</div>
					<div className="text-muted-foreground text-xs">{activeConversation?.title || "Select a conversation"}</div>
				</div>
			</div>

			<div className="flex min-h-0 flex-1 overflow-hidden">
				{/* Desktop Sidebar */}
				<div className="hidden w-80 shrink-0 border-r md:block">
					<ConversationsList
						character={character}
						conversations={conversations}
						activeConversationId={activeConversationId}
						onConversationSelect={handleConversationSelect}
						onNewConversation={createNewConversation}
						onDeleteConversation={deleteConversation}
						onRenameConversation={renameConversation}
						onBackToHome={onBackToHome}
					/>
				</div>

				{/* Mobile Sidebar (Sheet from left) */}
				<Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
					<SheetContent side="left" className="w-72">
						<ConversationsList
							character={character}
							conversations={conversations}
							activeConversationId={activeConversationId}
							onConversationSelect={(conversation) => {
								handleConversationSelect(conversation);
								setMobileDrawerOpen(false);
							}}
							onNewConversation={() => {
								createNewConversation();
								setMobileDrawerOpen(false);
							}}
							onDeleteConversation={deleteConversation}
							onRenameConversation={renameConversation}
							onBackToHome={onBackToHome}
						/>
					</SheetContent>
				</Sheet>

				{/* Main Chat */}
				<div className="flex min-w-0 flex-1 flex-col">
					<ConversationComponent
						character={character}
						conversation={activeConversation}
						persona={persona}
						onConversationUpdate={handleConversationUpdate}
						onPersonaUpdate={setPersona}
						onCreateNewConversation={createNewConversation}
						globalSettings={globalSettings}
						onGlobalSettingsChange={handleGlobalSettingsChange}
					/>
				</div>
			</div>
		</div>
	);
}
