"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Message, Character, Persona, Conversation as ConversationType, ConversationSettings } from "@/types";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import ConvSettings from "./ConversationSettings";
import PersonaForm from "./PersonaForm";
import CharacterInfoDialog from "@/components/CharacterInfoDialog";
import { Settings, User, Info, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface ConversationProps {
	character: Character;
	conversation: ConversationType | null;
	persona: Persona | null;
	onConversationUpdate: (updates: Partial<ConversationType>) => void;
	onPersonaUpdate: (persona: Persona | null) => void;
	onCreateNewConversation: () => void;
	globalSettings: ConversationSettings;
	onGlobalSettingsChange: (settings: ConversationSettings) => void;
}

export default function Conversation({ character, conversation, persona, onConversationUpdate, onPersonaUpdate, onCreateNewConversation, globalSettings, onGlobalSettingsChange }: ConversationProps) {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
	const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);
	const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
	const [rateLimit, setRateLimit] = useState<{ limit: number; remaining: number } | null>(null);
	const [deleteConfirmation, setDeleteConfirmation] = useState<{
		messageId: string;
		type: "message" | "generation" | "fromHere";
	} | null>(null);
	const [editingMessage, setEditingMessage] = useState<{
		messageId: string;
		content: string;
	} | null>(null);
	const [showConversationSettings, setShowConversationSettings] = useState(false);
	const [showPersonaForm, setShowPersonaForm] = useState(false);
	const [showCharacterProfile, setShowCharacterProfile] = useState(false);
	const [visibleMessageCount, setVisibleMessageCount] = useState(8);
	const [showLoadMore, setShowLoadMore] = useState(false);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const messagesContainerRef = useRef<HTMLDivElement>(null);

	function buildSystemPrompt(character: Character, persona: Persona | null): string {
		let systemPrompt = "";
		if (character) {
			systemPrompt += `You are ${character.name}. ${character.personality}\n\n`;
			if (character.scenario) systemPrompt += `Scenario: ${character.scenario}\n\n`;
			if (character.depth_prompt) systemPrompt += `${character.depth_prompt}\n\n`;
			if (character.example_dialogue) systemPrompt += `Example dialogue:\n${character.example_dialogue}\n\n`;
			if (character.system_prompt) systemPrompt += `${character.system_prompt}\n\n`;
			if (character.post_history_instructions) systemPrompt += `Additional instructions: ${character.post_history_instructions}\n\n`;
		}
		if (persona) {
			systemPrompt += `You are talking to ${persona.name}, ${persona.age} years old, ${persona.gender}, ${persona.appearance}, ${persona.traits}, ${persona.background}\n\n`;
		}
		systemPrompt += "Respond in character and maintain the personality and speaking style described above.";
		return systemPrompt;
	}

	// Auto-scroll to bottom only when explicitly requested (e.g., send/regenerate)
	useEffect(() => {
		if (shouldAutoScroll) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
			setShouldAutoScroll(false);
		}
	}, [conversation?.messages, streamingMessage?.content, shouldAutoScroll]);

	// Reset rate limit indicator when selected model changes
	useEffect(() => {
		setRateLimit(null);
	}, [globalSettings.model]);

	// Reset visible message count when conversation changes
	useEffect(() => {
		if (conversation) {
			setVisibleMessageCount(8);
			setShowLoadMore(false);
			// On opening a conversation, scroll to bottom once
			setShouldAutoScroll(true);
		}
	}, [conversation?.id]);

	// Scroll detection for load more button
	useEffect(() => {
		const container = messagesContainerRef.current;
		if (!container || !conversation) return;

		const handleScroll = () => {
			const { scrollTop } = container;
			const hasMoreMessages = conversation.messages.length > visibleMessageCount;

			// Show load more button when scrolled near the top and there are more messages
			if (scrollTop < 100 && hasMoreMessages) {
				setShowLoadMore(true);
			} else if (scrollTop >= 100) {
				setShowLoadMore(false);
			}
		};

		container.addEventListener("scroll", handleScroll);
		// Initial check
		handleScroll();

		return () => container.removeEventListener("scroll", handleScroll);
	}, [conversation, visibleMessageCount]);

	// Reset pagination when sending new message
	const resetPagination = () => {
		setVisibleMessageCount(8);
		setShowLoadMore(false);
		setRegeneratingMessageId(null);
	};

	const sendMessage = async (content: string, image?: string) => {
		const showErrorToastFromResponse = async (res: Response, fallback: string) => {
			let message = fallback;
			try {
				const data = await res.json();
				message = data?.error?.message || message;
			} catch {}
			const limitHeader = res.headers.get("x-ratelimit-limit");
			const remainingHeader = res.headers.get("x-ratelimit-remaining");
			if (limitHeader && remainingHeader) {
				setRateLimit({ limit: Number(limitHeader), remaining: Number(remainingHeader) });
				message += ` (remaining ${remainingHeader}/${limitHeader})`;
			}
			toast.error(message);
		};
		if (!conversation) return;

		// Reset pagination when sending new message
		resetPagination();
		setShouldAutoScroll(true);

		const userMessage: Message = {
			id: uuidv4(),
			role: "user",
			content,
			image,
			timestamp: Date.now(),
		};

		const updatedMessages = [...conversation.messages, userMessage];
		onConversationUpdate({ messages: updatedMessages });
		setIsLoading(true);

		const assistantMessageId = uuidv4();
		const isStreaming = globalSettings.streaming;

		try {
			const useOpenAI = globalSettings.provider === "openai" && globalSettings.apiBaseUrl && globalSettings.apiKey;
			const usePawanDirect = globalSettings.provider === "pawan" && !!globalSettings.pawanApiKey;

			const getPawanBaseUrl = (modelId: string) => {
				const id = modelId.toLowerCase();
				if (id.includes("cosmosrp-it")) return "https://api.pawan.krd/cosmosrp-it/v1";
				if (id.includes("cosmosrp")) return "https://api.pawan.krd/cosmosrp/v1";
				return "https://api.pawan.krd/v1";
			};

			if (useOpenAI) {
				// Client-side call directly to OpenAI-compatible server
				const base = globalSettings.apiBaseUrl!.replace(/\/$/, "");
				const isStreaming = globalSettings.streaming;
				const systemPromptText = buildSystemPrompt(character, persona);

				if (isStreaming) {
					const res = await fetch(`${base}/chat/completions`, {
						method: "POST",
						headers: { "Content-Type": "application/json", Authorization: `Bearer ${globalSettings.apiKey}` },
						body: JSON.stringify({
							model: globalSettings.model,
							messages: [
								{ role: "system", content: systemPromptText },
								...updatedMessages.map((msg) => ({
									role: msg.role,
									content: msg.image
										? [
												{ type: "text", text: msg.content },
												{ type: "image_url", image_url: { url: msg.image } },
										  ]
										: msg.content,
								})),
							],
							max_tokens: globalSettings.max_tokens,
							temperature: globalSettings.temperature,
							top_p: globalSettings.top_p,
							frequency_penalty: globalSettings.frequency_penalty,
							presence_penalty: globalSettings.presence_penalty,
							stream: true,
						}),
					});

					if (!res.ok) {
						await showErrorToastFromResponse(res, "Failed to get response");
						setIsLoading(false);
						setStreamingMessage(null);
						return;
					}
					if (!res.body) {
						toast.error("No response body from server");
						setIsLoading(false);
						setStreamingMessage(null);
						return;
					}

					// capture ratelimit headers
					const limitHeader = res.headers.get("x-ratelimit-limit");
					const remainingHeader = res.headers.get("x-ratelimit-remaining");
					if (limitHeader && remainingHeader) {
						setRateLimit({ limit: Number(limitHeader), remaining: Number(remainingHeader) });
					}

					const reader = res.body.getReader();
					const decoder = new TextDecoder();
					setStreamingMessage({ id: assistantMessageId, role: "assistant", content: "", timestamp: Date.now() });
					setShouldAutoScroll(true);

					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						const chunk = decoder.decode(value, { stream: true });
						const lines = chunk.split("\n");
						for (const line of lines) {
							const trimmed = line.trim();
							if (!trimmed.startsWith("data:")) continue;
							const data = trimmed.slice(5).trim();
							if (data === "[DONE]") {
								const finalMessage: Message = { id: assistantMessageId, role: "assistant", content: streamingMessage?.content || "", timestamp: Date.now() };
								onConversationUpdate({ messages: [...updatedMessages, finalMessage] });
								setStreamingMessage(null);
								setIsLoading(false);
								return;
							}
							try {
								const json = JSON.parse(data);
								const delta = json.choices?.[0]?.delta?.content || "";
								if (delta) {
									setStreamingMessage((prev) => ({ ...(prev as Message), content: ((prev?.content as string) || "") + delta }));
								}
							} catch {}
						}
					}
				} else {
					const res = await fetch(`${base}/chat/completions`, {
						method: "POST",
						headers: { "Content-Type": "application/json", Authorization: `Bearer ${globalSettings.apiKey}` },
						body: JSON.stringify({
							model: globalSettings.model,
							messages: [
								{ role: "system", content: systemPromptText },
								...updatedMessages.map((msg) => ({
									role: msg.role,
									content: msg.image
										? [
												{ type: "text", text: msg.content },
												{ type: "image_url", image_url: { url: msg.image } },
										  ]
										: msg.content,
								})),
							],
							max_tokens: globalSettings.max_tokens,
							temperature: globalSettings.temperature,
							top_p: globalSettings.top_p,
							frequency_penalty: globalSettings.frequency_penalty,
							presence_penalty: globalSettings.presence_penalty,
							stream: false,
						}),
					});
					if (!res.ok) {
						await showErrorToastFromResponse(res, "Failed to get response");
						setIsLoading(false);
						return;
					}
					const limitHeader2 = res.headers.get("x-ratelimit-limit");
					const remainingHeader2 = res.headers.get("x-ratelimit-remaining");
					if (limitHeader2 && remainingHeader2) setRateLimit({ limit: Number(limitHeader2), remaining: Number(remainingHeader2) });
					const data = await res.json();
					const content = data.choices?.[0]?.message?.content || data.message || "";
					const assistantMessage: Message = { id: assistantMessageId, role: "assistant", content, timestamp: Date.now() };
					onConversationUpdate({ messages: [...updatedMessages, assistantMessage] });
				}
			} else if (usePawanDirect) {
				// Client-side call directly to Pawan.Krd using user's key
				const base = getPawanBaseUrl(globalSettings.model);
				const isStreaming = globalSettings.streaming;
				const systemPromptText = buildSystemPrompt(character, persona);

				if (isStreaming) {
					const res = await fetch(`${base}/chat/completions`, {
						method: "POST",
						headers: { "Content-Type": "application/json", Authorization: `Bearer ${globalSettings.pawanApiKey}` },
						body: JSON.stringify({
							model: globalSettings.model,
							messages: [
								{ role: "system", content: systemPromptText },
								...updatedMessages.map((msg) => ({
									role: msg.role,
									content: msg.image
										? [
												{ type: "text", text: msg.content },
												{ type: "image_url", image_url: { url: msg.image } },
										  ]
										: msg.content,
								})),
							],
							max_tokens: globalSettings.max_tokens,
							temperature: globalSettings.temperature,
							top_p: globalSettings.top_p,
							frequency_penalty: globalSettings.frequency_penalty,
							presence_penalty: globalSettings.presence_penalty,
							stream: true,
						}),
					});

					if (!res.ok) {
						await showErrorToastFromResponse(res, "Failed to get response");
						setIsLoading(false);
						setStreamingMessage(null);
						return;
					}
					if (!res.body) {
						toast.error("No response body from Pawan");
						setIsLoading(false);
						setStreamingMessage(null);
						return;
					}
					const limitHeader3 = res.headers.get("x-ratelimit-limit");
					const remainingHeader3 = res.headers.get("x-ratelimit-remaining");
					if (limitHeader3 && remainingHeader3) setRateLimit({ limit: Number(limitHeader3), remaining: Number(remainingHeader3) });

					const reader = res.body.getReader();
					const decoder = new TextDecoder();
					setStreamingMessage({ id: assistantMessageId, role: "assistant", content: "", timestamp: Date.now() });
					setShouldAutoScroll(true);

					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						const chunk = decoder.decode(value, { stream: true });
						const lines = chunk.split("\n");
						for (const line of lines) {
							const trimmed = line.trim();
							if (!trimmed.startsWith("data:")) continue;
							const data = trimmed.slice(5).trim();
							if (data === "[DONE]") {
								const finalMessage: Message = { id: assistantMessageId, role: "assistant", content: streamingMessage?.content || "", timestamp: Date.now() };
								onConversationUpdate({ messages: [...updatedMessages, finalMessage] });
								setStreamingMessage(null);
								setIsLoading(false);
								return;
							}
							try {
								const json = JSON.parse(data);
								const delta = json.choices?.[0]?.delta?.content || "";
								if (delta) {
									setStreamingMessage((prev) => ({ ...(prev as Message), content: ((prev?.content as string) || "") + delta }));
								}
							} catch {}
						}
					}
				} else {
					const res = await fetch(`${base}/chat/completions`, {
						method: "POST",
						headers: { "Content-Type": "application/json", Authorization: `Bearer ${globalSettings.pawanApiKey}` },
						body: JSON.stringify({
							model: globalSettings.model,
							messages: [
								{ role: "system", content: systemPromptText },
								...updatedMessages.map((msg) => ({
									role: msg.role,
									content: msg.image
										? [
												{ type: "text", text: msg.content },
												{ type: "image_url", image_url: { url: msg.image } },
										  ]
										: msg.content,
								})),
							],
							max_tokens: globalSettings.max_tokens,
							temperature: globalSettings.temperature,
							top_p: globalSettings.top_p,
							frequency_penalty: globalSettings.frequency_penalty,
							presence_penalty: globalSettings.presence_penalty,
							stream: false,
						}),
					});
					if (!res.ok) {
						await showErrorToastFromResponse(res, "Failed to get response");
						setIsLoading(false);
						return;
					}
					const limitHeader4 = res.headers.get("x-ratelimit-limit");
					const remainingHeader4 = res.headers.get("x-ratelimit-remaining");
					if (limitHeader4 && remainingHeader4) setRateLimit({ limit: Number(limitHeader4), remaining: Number(remainingHeader4) });
					const data = await res.json();
					const content = data.choices?.[0]?.message?.content || data.message || "";
					const assistantMessage: Message = { id: assistantMessageId, role: "assistant", content, timestamp: Date.now() };
					onConversationUpdate({ messages: [...updatedMessages, assistantMessage] });
				}
			} else {
				// Use our backend for Pawan.Krd
				const response = await fetch("/api/chat", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ messages: updatedMessages, character, persona, settings: globalSettings }),
				});

				if (!response.ok) {
					await showErrorToastFromResponse(response, "Failed to get response");
					setIsLoading(false);
					return;
				}
				const limitHeader5 = response.headers.get("x-ratelimit-limit");
				const remainingHeader5 = response.headers.get("x-ratelimit-remaining");
				if (limitHeader5 && remainingHeader5) setRateLimit({ limit: Number(limitHeader5), remaining: Number(remainingHeader5) });

				if (isStreaming && response.headers.get("content-type")?.includes("text/stream")) {
					// Handle streaming response
					const reader = response.body?.getReader();
					const decoder = new TextDecoder();
					let accumulatedContent = "";

					// Create initial streaming message
					const streamingMsg: Message = {
						id: assistantMessageId,
						role: "assistant",
						content: "",
						timestamp: Date.now(),
					};
					setStreamingMessage(streamingMsg);
					setShouldAutoScroll(true);

					if (reader) {
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;

							const chunk = decoder.decode(value);
							const lines = chunk.split("\n");

							for (const line of lines) {
								if (line.startsWith("data: ")) {
									const data = line.slice(6);
									if (data === "[DONE]") {
										// Streaming finished
										const finalMessage: Message = {
											id: assistantMessageId,
											role: "assistant",
											content: accumulatedContent,
											timestamp: Date.now(),
										};
										onConversationUpdate({
											messages: [...updatedMessages, finalMessage],
										});
										setStreamingMessage(null);
										setIsLoading(false);
										return;
									}

									try {
										const parsed = JSON.parse(data);
										if (parsed.content) {
											accumulatedContent += parsed.content;
											setStreamingMessage({
												...streamingMsg,
												content: accumulatedContent,
											});
										}
									} catch (e) {
										// Ignore invalid JSON
									}
								}
							}
						}
					}
				} else {
					// Handle regular JSON response
					const data = await response.json();
					const assistantMessage: Message = {
						id: assistantMessageId,
						role: "assistant",
						content: data.message,
						timestamp: Date.now(),
					};

					onConversationUpdate({
						messages: [...updatedMessages, assistantMessage],
					});
				}
			}
		} catch (error: any) {
			console.error("Error sending message:", error);
			toast.error(error?.message || "Error sending message");
			const errorMessage: Message = {
				id: assistantMessageId,
				role: "assistant",
				content: "Sorry, I encountered an error while processing your message. Please try again.",
				timestamp: Date.now(),
			};
			onConversationUpdate({
				messages: [...updatedMessages, errorMessage],
			});
			setStreamingMessage(null);
		}

		setIsLoading(false);
	};

	const regenerateMessage = async (messageId: string) => {
		const showErrorToastFromResponse = async (res: Response, fallback: string) => {
			let message = fallback;
			try {
				const data = await res.json();
				message = data?.error?.message || message;
			} catch {}
			const limitHeader = res.headers.get("x-ratelimit-limit");
			const remainingHeader = res.headers.get("x-ratelimit-remaining");
			if (limitHeader && remainingHeader) {
				setRateLimit({ limit: Number(limitHeader), remaining: Number(remainingHeader) });
				message += ` (remaining ${remainingHeader}/${limitHeader})`;
			}
			toast.error(message);
		};
		if (!conversation) return;

		const messageIndex = conversation.messages.findIndex((m) => m.id === messageId);
		if (messageIndex === -1) return;

		const targetMessage = conversation.messages[messageIndex];
		const messagesBeforeTarget = conversation.messages.slice(0, messageIndex);
		setRegeneratingMessageId(messageId);
		setIsLoading(true);
		setShouldAutoScroll(true);

		const isStreaming = globalSettings.streaming;

		try {
			const useOpenAI = globalSettings.provider === "openai" && globalSettings.apiBaseUrl && globalSettings.apiKey;
			const usePawanDirect = globalSettings.provider === "pawan" && !!globalSettings.pawanApiKey;

			const getPawanBaseUrl = (modelId: string) => {
				const id = modelId.toLowerCase();
				if (id === "cosmosrp-it") return "https://api.pawan.krd/cosmosrp-it/v1";
				if (id === "cosmosrp") return "https://api.pawan.krd/cosmosrp/v1";
				return "https://api.pawan.krd/v1";
			};

			if (useOpenAI) {
				const base = globalSettings.apiBaseUrl!.replace(/\/$/, "");
				const isStreaming = globalSettings.streaming;
				let newContent = "";
				if (isStreaming) {
					const res = await fetch(`${base}/chat/completions`, {
						method: "POST",
						headers: { "Content-Type": "application/json", Authorization: `Bearer ${globalSettings.apiKey}` },
						body: JSON.stringify({
							model: globalSettings.model,
							messages: [
								{ role: "system", content: buildSystemPrompt(character, persona) },
								...messagesBeforeTarget.map((msg) => ({
									role: msg.role,
									content: msg.image
										? [
												{ type: "text", text: msg.content },
												{ type: "image_url", image_url: { url: msg.image } },
										  ]
										: msg.content,
								})),
							],
							max_tokens: globalSettings.max_tokens,
							temperature: globalSettings.temperature,
							top_p: globalSettings.top_p,
							frequency_penalty: globalSettings.frequency_penalty,
							presence_penalty: globalSettings.presence_penalty,
							stream: true,
						}),
					});
					if (!res.ok) {
						await showErrorToastFromResponse(res, "Failed to regenerate response");
						setIsLoading(false);
						setRegeneratingMessageId(null);
						return;
					}
					// capture ratelimit headers
					{
						const limitHeader = res.headers.get("x-ratelimit-limit");
						const remainingHeader = res.headers.get("x-ratelimit-remaining");
						if (limitHeader && remainingHeader) setRateLimit({ limit: Number(limitHeader), remaining: Number(remainingHeader) });
					}
					if (!res.body) throw new Error("No stream");
					const reader = res.body.getReader();
					const decoder = new TextDecoder();
					const updateMessageContent = (content: string) => {
						const updatedMessage = { ...targetMessage, content };
						const updatedMessages = [...messagesBeforeTarget, updatedMessage, ...conversation.messages.slice(messageIndex + 1)];
						onConversationUpdate({ messages: updatedMessages });
					};
					updateMessageContent("");
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						const chunk = decoder.decode(value);
						const lines = chunk.split("\n");
						for (const line of lines) {
							const trimmed = line.trim();
							if (!trimmed.startsWith("data:")) continue;
							const data = trimmed.slice(5).trim();
							if (data === "[DONE]") {
								newContent = newContent;
								break;
							}
							try {
								const json = JSON.parse(data);
								const delta = json.choices?.[0]?.delta?.content || "";
								if (delta) {
									newContent += delta;
									updateMessageContent(newContent);
								}
							} catch {}
						}
						if (newContent) {
							// continue until done
						}
					}
				} else {
					const res = await fetch(`${base}/chat/completions`, {
						method: "POST",
						headers: { "Content-Type": "application/json", Authorization: `Bearer ${globalSettings.apiKey}` },
						body: JSON.stringify({
							model: globalSettings.model,
							messages: [
								{ role: "system", content: buildSystemPrompt(character, persona) },
								...messagesBeforeTarget.map((msg) => ({
									role: msg.role,
									content: msg.image
										? [
												{ type: "text", text: msg.content },
												{ type: "image_url", image_url: { url: msg.image } },
										  ]
										: msg.content,
								})),
							],
							max_tokens: globalSettings.max_tokens,
							temperature: globalSettings.temperature,
							top_p: globalSettings.top_p,
							frequency_penalty: globalSettings.frequency_penalty,
							presence_penalty: globalSettings.presence_penalty,
							stream: false,
						}),
					});
					if (!res.ok) {
						await showErrorToastFromResponse(res, "Failed to regenerate response");
						setIsLoading(false);
						setRegeneratingMessageId(null);
						return;
					}
					{
						const limitHeader = res.headers.get("x-ratelimit-limit");
						const remainingHeader = res.headers.get("x-ratelimit-remaining");
						if (limitHeader && remainingHeader) setRateLimit({ limit: Number(limitHeader), remaining: Number(remainingHeader) });
					}
					const data = await res.json();
					newContent = data.choices?.[0]?.message?.content || data.message || "";
				}
				// Add new variant to existing message
				const currentVariants = targetMessage.variants || [targetMessage.content];
				const updatedMessage: Message = { ...targetMessage, content: newContent, variants: [...currentVariants, newContent], currentVariant: currentVariants.length };
				const updatedMessages = [...messagesBeforeTarget, updatedMessage, ...conversation.messages.slice(messageIndex + 1)];
				onConversationUpdate({ messages: updatedMessages });
			} else if (usePawanDirect) {
				const base = getPawanBaseUrl(globalSettings.model);
				let newContent = "";
				if (globalSettings.streaming) {
					const res = await fetch(`${base}/chat/completions`, {
						method: "POST",
						headers: { "Content-Type": "application/json", Authorization: `Bearer ${globalSettings.pawanApiKey}` },
						body: JSON.stringify({
							model: globalSettings.model,
							messages: [
								{ role: "system", content: buildSystemPrompt(character, persona) },
								...messagesBeforeTarget.map((msg) => ({
									role: msg.role,
									content: msg.image
										? [
												{ type: "text", text: msg.content },
												{ type: "image_url", image_url: { url: msg.image } },
										  ]
										: msg.content,
								})),
							],
							max_tokens: globalSettings.max_tokens,
							temperature: globalSettings.temperature,
							top_p: globalSettings.top_p,
							frequency_penalty: globalSettings.frequency_penalty,
							presence_penalty: globalSettings.presence_penalty,
							stream: true,
						}),
					});
					if (!res.ok) {
						await showErrorToastFromResponse(res, "Failed to regenerate response");
						setIsLoading(false);
						setRegeneratingMessageId(null);
						return;
					}
					{
						const limitHeader = res.headers.get("x-ratelimit-limit");
						const remainingHeader = res.headers.get("x-ratelimit-remaining");
						if (limitHeader && remainingHeader) setRateLimit({ limit: Number(limitHeader), remaining: Number(remainingHeader) });
					}
					if (!res.body) throw new Error("No stream");
					const reader = res.body.getReader();
					const decoder = new TextDecoder();
					const updateMessageContent = (content: string) => {
						const updatedMessage = { ...targetMessage, content };
						const updatedMessages = [...messagesBeforeTarget, updatedMessage, ...conversation.messages.slice(messageIndex + 1)];
						onConversationUpdate({ messages: updatedMessages });
					};
					updateMessageContent("");
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						const chunk = decoder.decode(value);
						const lines = chunk.split("\n");
						for (const line of lines) {
							const trimmed = line.trim();
							if (!trimmed.startsWith("data:")) continue;
							const data = trimmed.slice(5).trim();
							if (data === "[DONE]") {
								break;
							}
							try {
								const json = JSON.parse(data);
								const delta = json.choices?.[0]?.delta?.content || "";
								if (delta) {
									newContent += delta;
									updateMessageContent(newContent);
								}
							} catch {}
						}
					}
				} else {
					const res = await fetch(`${base}/chat/completions`, {
						method: "POST",
						headers: { "Content-Type": "application/json", Authorization: `Bearer ${globalSettings.pawanApiKey}` },
						body: JSON.stringify({
							model: globalSettings.model,
							messages: [
								{ role: "system", content: buildSystemPrompt(character, persona) },
								...messagesBeforeTarget.map((msg) => ({
									role: msg.role,
									content: msg.image
										? [
												{ type: "text", text: msg.content },
												{ type: "image_url", image_url: { url: msg.image } },
										  ]
										: msg.content,
								})),
							],
							max_tokens: globalSettings.max_tokens,
							temperature: globalSettings.temperature,
							top_p: globalSettings.top_p,
							frequency_penalty: globalSettings.frequency_penalty,
							presence_penalty: globalSettings.presence_penalty,
							stream: false,
						}),
					});
					if (!res.ok) {
						await showErrorToastFromResponse(res, "Failed to regenerate response");
						setIsLoading(false);
						setRegeneratingMessageId(null);
						return;
					}
					{
						const limitHeader = res.headers.get("x-ratelimit-limit");
						const remainingHeader = res.headers.get("x-ratelimit-remaining");
						if (limitHeader && remainingHeader) setRateLimit({ limit: Number(limitHeader), remaining: Number(remainingHeader) });
					}
					const data = await res.json();
					newContent = data.choices?.[0]?.message?.content || data.message || "";
				}
				// Add new variant to existing message
				const currentVariants = targetMessage.variants || [targetMessage.content];
				const updatedMessage: Message = { ...targetMessage, content: newContent, variants: [...currentVariants, newContent], currentVariant: currentVariants.length };
				const updatedMessages = [...messagesBeforeTarget, updatedMessage, ...conversation.messages.slice(messageIndex + 1)];
				onConversationUpdate({ messages: updatedMessages });
			} else {
				const response = await fetch("/api/chat", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ messages: messagesBeforeTarget, character, persona, settings: globalSettings }),
				});

				if (!response.ok) {
					await showErrorToastFromResponse(response, "Failed to regenerate response");
					setIsLoading(false);
					setRegeneratingMessageId(null);
					return;
				}
				{
					const limitHeader = response.headers.get("x-ratelimit-limit");
					const remainingHeader = response.headers.get("x-ratelimit-remaining");
					if (limitHeader && remainingHeader) setRateLimit({ limit: Number(limitHeader), remaining: Number(remainingHeader) });
				}

				let newContent = "";

				if (isStreaming && response.headers.get("content-type")?.includes("text/stream")) {
					// Handle streaming response
					const reader = response.body?.getReader();
					const decoder = new TextDecoder();
					let accumulatedContent = "";

					// Update message in place during streaming
					const updateMessageContent = (content: string) => {
						const updatedMessage = { ...targetMessage, content };
						const updatedMessages = [...messagesBeforeTarget, updatedMessage, ...conversation.messages.slice(messageIndex + 1)];
						onConversationUpdate({ messages: updatedMessages });
					};

					// Start with empty content
					updateMessageContent("");

					if (reader) {
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;

							const chunk = decoder.decode(value);
							const lines = chunk.split("\n");

							for (const line of lines) {
								if (line.startsWith("data: ")) {
									const data = line.slice(6);
									if (data === "[DONE]") {
										newContent = accumulatedContent;
										break;
									}

									try {
										const parsed = JSON.parse(data);
										if (parsed.content) {
											accumulatedContent += parsed.content;
											updateMessageContent(accumulatedContent);
										}
									} catch (e) {
										// Ignore invalid JSON
									}
								}
							}

							if (newContent) break;
						}
					}
				} else {
					// Handle regular JSON response
					const data = await response.json();
					newContent = data.message;
				}

				// Add new variant to existing message
			}
		} catch (error: any) {
			console.error("Error regenerating message:", error);
			toast.error(error?.message || "Error regenerating message");
		}

		setIsLoading(false);
		setRegeneratingMessageId(null);
	};

	// Retry from a user message: send it again and produce a new assistant response
	const retryFromUserMessage = async (messageId: string) => {
		const showErrorToastFromResponse = async (res: Response, fallback: string) => {
			let message = fallback;
			try {
				const data = await res.json();
				message = data?.error?.message || message;
			} catch {}
			const limitHeader = res.headers.get("x-ratelimit-limit");
			const remainingHeader = res.headers.get("x-ratelimit-remaining");
			if (limitHeader && remainingHeader) {
				setRateLimit({ limit: Number(limitHeader), remaining: Number(remainingHeader) });
				message += ` (remaining ${remainingHeader}/${limitHeader})`;
			}
			toast.error(message);
		};
		if (!conversation) return;

		const messageIndex = conversation.messages.findIndex((m) => m.id === messageId);
		if (messageIndex === -1) return;

		const targetMessage = conversation.messages[messageIndex];
		if (targetMessage.role !== "user") return;

		const historyUpToUser = conversation.messages.slice(0, messageIndex + 1);
		setIsLoading(true);
		setShouldAutoScroll(true);

		const assistantMessageId = uuidv4();
		const isStreaming = globalSettings.streaming;

		try {
			const useOpenAI = globalSettings.provider === "openai" && globalSettings.apiBaseUrl && globalSettings.apiKey;
			const usePawanDirect = globalSettings.provider === "pawan" && !!globalSettings.pawanApiKey;

			const getPawanBaseUrl = (modelId: string) => {
				const id = modelId.toLowerCase();
				if (id.includes("cosmosrp-it")) return "https://api.pawan.krd/cosmosrp-it/v1";
				if (id.includes("cosmosrp")) return "https://api.pawan.krd/cosmosrp/v1";
				return "https://api.pawan.krd/v1";
			};

			if (useOpenAI) {
				const base = globalSettings.apiBaseUrl!.replace(/\/$/, "");
				const isStreaming = globalSettings.streaming;
				const assistantMessageId = uuidv4();
				if (isStreaming) {
					const res = await fetch(`${base}/chat/completions`, {
						method: "POST",
						headers: { "Content-Type": "application/json", Authorization: `Bearer ${globalSettings.apiKey}` },
						body: JSON.stringify({
							model: globalSettings.model,
							messages: [
								{ role: "system", content: buildSystemPrompt(character, persona) },
								...historyUpToUser.map((msg) => ({
									role: msg.role,
									content: msg.image
										? [
												{ type: "text", text: msg.content },
												{ type: "image_url", image_url: { url: msg.image } },
										  ]
										: msg.content,
								})),
							],
							max_tokens: globalSettings.max_tokens,
							temperature: globalSettings.temperature,
							top_p: globalSettings.top_p,
							frequency_penalty: globalSettings.frequency_penalty,
							presence_penalty: globalSettings.presence_penalty,
							stream: true,
						}),
					});
					if (!res.ok) {
						await showErrorToastFromResponse(res, "Failed to retry message");
						setIsLoading(false);
						return;
					}
					{
						const limitHeader = res.headers.get("x-ratelimit-limit");
						const remainingHeader = res.headers.get("x-ratelimit-remaining");
						if (limitHeader && remainingHeader) setRateLimit({ limit: Number(limitHeader), remaining: Number(remainingHeader) });
					}
					const reader = res.body?.getReader();
					const decoder = new TextDecoder();
					let accumulatedContent = "";

					const streamingMsg: Message = { id: assistantMessageId, role: "assistant", content: "", timestamp: Date.now() };
					setStreamingMessage(streamingMsg);

					if (reader) {
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;
							const chunk = decoder.decode(value);
							const lines = chunk.split("\n");
							for (const line of lines) {
								if (!line.trim().startsWith("data:")) continue;
								const data = line.slice(5).trim();
								if (data === "[DONE]") {
									const finalMessage: Message = { id: assistantMessageId, role: "assistant", content: accumulatedContent, timestamp: Date.now() };
									onConversationUpdate({ messages: [...historyUpToUser, ...conversation.messages.slice(messageIndex + 1), finalMessage] });
									setStreamingMessage(null);
									setIsLoading(false);
									return;
								}
								try {
									const parsed = JSON.parse(data);
									const delta = parsed.choices?.[0]?.delta?.content || "";
									if (delta) {
										accumulatedContent += delta;
										setStreamingMessage((prev) => ({ ...(prev as Message), content: accumulatedContent }));
									}
								} catch {}
							}
						}
					}
				} else {
					const res = await fetch(`${base}/chat/completions`, {
						method: "POST",
						headers: { "Content-Type": "application/json", Authorization: `Bearer ${globalSettings.apiKey}` },
						body: JSON.stringify({
							model: globalSettings.model,
							messages: [
								{ role: "system", content: buildSystemPrompt(character, persona) },
								...historyUpToUser.map((msg) => ({
									role: msg.role,
									content: msg.image
										? [
												{ type: "text", text: msg.content },
												{ type: "image_url", image_url: { url: msg.image } },
										  ]
										: msg.content,
								})),
							],
							max_tokens: globalSettings.max_tokens,
							temperature: globalSettings.temperature,
							top_p: globalSettings.top_p,
							frequency_penalty: globalSettings.frequency_penalty,
							presence_penalty: globalSettings.presence_penalty,
							stream: false,
						}),
					});
					if (!res.ok) {
						await showErrorToastFromResponse(res, "Failed to retry message");
						setIsLoading(false);
						return;
					}
					{
						const limitHeader = res.headers.get("x-ratelimit-limit");
						const remainingHeader = res.headers.get("x-ratelimit-remaining");
						if (limitHeader && remainingHeader) setRateLimit({ limit: Number(limitHeader), remaining: Number(remainingHeader) });
					}
					const data = await res.json();
					const assistantMessage: Message = { id: assistantMessageId, role: "assistant", content: data.choices?.[0]?.message?.content || "", timestamp: Date.now() };
					onConversationUpdate({ messages: [...historyUpToUser, ...conversation.messages.slice(messageIndex + 1), assistantMessage] });
				}
			} else if (usePawanDirect) {
				const base = getPawanBaseUrl(globalSettings.model);
				if (globalSettings.streaming) {
					const res = await fetch(`${base}/chat/completions`, {
						method: "POST",
						headers: { "Content-Type": "application/json", Authorization: `Bearer ${globalSettings.pawanApiKey}` },
						body: JSON.stringify({
							model: globalSettings.model,
							messages: [
								{ role: "system", content: buildSystemPrompt(character, persona) },
								...historyUpToUser.map((msg) => ({
									role: msg.role,
									content: msg.image
										? [
												{ type: "text", text: msg.content },
												{ type: "image_url", image_url: { url: msg.image } },
										  ]
										: msg.content,
								})),
							],
							max_tokens: globalSettings.max_tokens,
							temperature: globalSettings.temperature,
							top_p: globalSettings.top_p,
							frequency_penalty: globalSettings.frequency_penalty,
							presence_penalty: globalSettings.presence_penalty,
							stream: true,
						}),
					});
					const reader = res.body?.getReader();
					const decoder = new TextDecoder();
					let accumulatedContent = "";

					const streamingMsg: Message = { id: assistantMessageId, role: "assistant", content: "", timestamp: Date.now() };
					setStreamingMessage(streamingMsg);

					if (reader) {
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;
							const chunk = decoder.decode(value);
							const lines = chunk.split("\n");
							for (const line of lines) {
								if (!line.trim().startsWith("data:")) continue;
								const data = line.slice(5).trim();
								if (data === "[DONE]") {
									const finalMessage: Message = { id: assistantMessageId, role: "assistant", content: accumulatedContent, timestamp: Date.now() };
									onConversationUpdate({ messages: [...historyUpToUser, ...conversation.messages.slice(messageIndex + 1), finalMessage] });
									setStreamingMessage(null);
									setIsLoading(false);
									return;
								}
								try {
									const parsed = JSON.parse(data);
									const delta = parsed.choices?.[0]?.delta?.content || "";
									if (delta) {
										accumulatedContent += delta;
										setStreamingMessage((prev) => ({ ...(prev as Message), content: accumulatedContent }));
									}
								} catch {}
							}
						}
					}
				} else {
					const res = await fetch(`${base}/chat/completions`, {
						method: "POST",
						headers: { "Content-Type": "application/json", Authorization: `Bearer ${globalSettings.pawanApiKey}` },
						body: JSON.stringify({
							model: globalSettings.model,
							messages: [
								{ role: "system", content: buildSystemPrompt(character, persona) },
								...historyUpToUser.map((msg) => ({
									role: msg.role,
									content: msg.image
										? [
												{ type: "text", text: msg.content },
												{ type: "image_url", image_url: { url: msg.image } },
										  ]
										: msg.content,
								})),
							],
							max_tokens: globalSettings.max_tokens,
							temperature: globalSettings.temperature,
							top_p: globalSettings.top_p,
							frequency_penalty: globalSettings.frequency_penalty,
							presence_penalty: globalSettings.presence_penalty,
							stream: false,
						}),
					});
					const data = await res.json();
					const assistantMessage: Message = { id: assistantMessageId, role: "assistant", content: data.choices?.[0]?.message?.content || "", timestamp: Date.now() };
					onConversationUpdate({ messages: [...historyUpToUser, ...conversation.messages.slice(messageIndex + 1), assistantMessage] });
				}
			} else {
				const response = await fetch("/api/chat", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ messages: historyUpToUser, character, persona, settings: globalSettings }),
				});

				if (!response.ok) {
					await showErrorToastFromResponse(response, "Failed to retry message");
					setIsLoading(false);
					return;
				}
				{
					const limitHeader = response.headers.get("x-ratelimit-limit");
					const remainingHeader = response.headers.get("x-ratelimit-remaining");
					if (limitHeader && remainingHeader) setRateLimit({ limit: Number(limitHeader), remaining: Number(remainingHeader) });
				}

				if (isStreaming && response.headers.get("content-type")?.includes("text/stream")) {
					const reader = response.body?.getReader();
					const decoder = new TextDecoder();
					let accumulatedContent = "";

					const streamingMsg: Message = {
						id: assistantMessageId,
						role: "assistant",
						content: "",
						timestamp: Date.now(),
					};
					setStreamingMessage(streamingMsg);

					if (reader) {
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;

							const chunk = decoder.decode(value);
							const lines = chunk.split("\n");
							for (const line of lines) {
								if (line.startsWith("data: ")) {
									const data = line.slice(6);
									if (data === "[DONE]") {
										const finalMessage: Message = {
											id: assistantMessageId,
											role: "assistant",
											content: accumulatedContent,
											timestamp: Date.now(),
										};
										onConversationUpdate({ messages: [...historyUpToUser, ...conversation.messages.slice(messageIndex + 1), finalMessage] });
										setStreamingMessage(null);
										setIsLoading(false);
										return;
									}
									try {
										const parsed = JSON.parse(data);
										if (parsed.content) {
											accumulatedContent += parsed.content;
											setStreamingMessage({ ...streamingMsg, content: accumulatedContent });
										}
									} catch {}
								}
							}
						}
					}
				} else {
					const data = await response.json();
					const assistantMessage: Message = {
						id: assistantMessageId,
						role: "assistant",
						content: data.message,
						timestamp: Date.now(),
					};
					onConversationUpdate({
						messages: [...historyUpToUser, ...conversation.messages.slice(messageIndex + 1), assistantMessage],
					});
				}
			}
		} catch (e: any) {
			console.error("Error retrying user message:", e);
			toast.error(e?.message || "Error retrying message");
		}

		setIsLoading(false);
	};

	const deleteMessage = (messageId: string) => {
		if (!conversation) return;
		const filteredMessages = conversation.messages.filter((m) => m.id !== messageId);
		onConversationUpdate({ messages: filteredMessages });
		setDeleteConfirmation(null);
		setShouldAutoScroll(false);
	};

	const deleteGeneration = (messageId: string) => {
		if (!conversation) return;

		const messageIndex = conversation.messages.findIndex((m) => m.id === messageId);
		if (messageIndex === -1) return;

		const targetMessage = conversation.messages[messageIndex];
		if (!targetMessage.variants || targetMessage.variants.length <= 1) {
			// If no variants or only one variant, delete the whole message
			deleteMessage(messageId);
			return;
		}

		const currentVariant = targetMessage.currentVariant ?? 0;
		const updatedVariants = targetMessage.variants.filter((_, index) => index !== currentVariant);
		const newCurrentVariant = Math.min(currentVariant, updatedVariants.length - 1);

		const updatedMessage: Message = {
			...targetMessage,
			content: updatedVariants[newCurrentVariant],
			variants: updatedVariants,
			currentVariant: newCurrentVariant,
		};

		const updatedMessages = [...conversation.messages];
		updatedMessages[messageIndex] = updatedMessage;

		onConversationUpdate({ messages: updatedMessages });
		setDeleteConfirmation(null);
		setShouldAutoScroll(false);
	};

	const deleteFromHere = (messageId: string) => {
		if (!conversation) return;

		const messageIndex = conversation.messages.findIndex((m) => m.id === messageId);
		if (messageIndex === -1) return;

		const filteredMessages = conversation.messages.slice(0, messageIndex);
		onConversationUpdate({ messages: filteredMessages });
		setDeleteConfirmation(null);
		setShouldAutoScroll(false);
	};

	const editMessage = (messageId: string, newContent: string) => {
		if (!conversation) return;

		const messageIndex = conversation.messages.findIndex((m) => m.id === messageId);
		if (messageIndex === -1) return;

		const targetMessage = conversation.messages[messageIndex];
		const updatedMessage: Message = {
			...targetMessage,
			content: newContent,
			timestamp: Date.now(), // Update timestamp when edited
		};

		const updatedMessages = [...conversation.messages];
		updatedMessages[messageIndex] = updatedMessage;

		onConversationUpdate({ messages: updatedMessages });
		setEditingMessage(null);
		setShouldAutoScroll(false);
	};

	const handleEditMessage = (messageId: string, currentContent: string) => {
		setEditingMessage({ messageId, content: currentContent });
	};

	const handleSaveEdit = () => {
		if (editingMessage && editingMessage.content.trim()) {
			editMessage(editingMessage.messageId, editingMessage.content.trim());
		}
	};

	const handleDeleteMessage = (messageId: string) => {
		setDeleteConfirmation({ messageId, type: "message" });
	};

	const handleDeleteGeneration = (messageId: string) => {
		setDeleteConfirmation({ messageId, type: "generation" });
	};

	const handleDeleteFromHere = (messageId: string) => {
		setDeleteConfirmation({ messageId, type: "fromHere" });
	};

	const executeDelete = () => {
		if (!deleteConfirmation) return;

		switch (deleteConfirmation.type) {
			case "message":
				deleteMessage(deleteConfirmation.messageId);
				break;
			case "generation":
				deleteGeneration(deleteConfirmation.messageId);
				break;
			case "fromHere":
				deleteFromHere(deleteConfirmation.messageId);
				break;
		}
	};

	const getDeleteDialogContent = () => {
		if (!deleteConfirmation) return { title: "", content: "" };

		switch (deleteConfirmation.type) {
			case "message":
				return {
					title: "Delete Message",
					content: "Are you sure you want to delete this message? This action cannot be undone.",
				};
			case "generation":
				return {
					title: "Delete Generation",
					content: "Are you sure you want to delete this generation? The current variant will be removed and switched to another one.",
				};
			case "fromHere":
				return {
					title: "Delete From Here",
					content: "Are you sure you want to delete this message and all messages after it? This will permanently remove multiple messages and cannot be undone.",
				};
			default:
				return { title: "", content: "" };
		}
	};

	const switchVariant = (messageId: string, variantIndex: number) => {
		if (!conversation) return;

		const messageIndex = conversation.messages.findIndex((m) => m.id === messageId);
		if (messageIndex === -1) return;

		const targetMessage = conversation.messages[messageIndex];
		if (!targetMessage.variants || variantIndex < 0 || variantIndex >= targetMessage.variants.length) return;

		const updatedMessage: Message = {
			...targetMessage,
			content: targetMessage.variants[variantIndex],
			currentVariant: variantIndex,
		};

		const updatedMessages = [...conversation.messages];
		updatedMessages[messageIndex] = updatedMessage;

		onConversationUpdate({ messages: updatedMessages });
		setShouldAutoScroll(false);
	};

	const switchGreeting = (greetingIndex: number) => {
		if (!conversation || !character) return;

		const allGreetings = [character.first_mes, ...(character.alternate_greetings || [])];
		if (greetingIndex < 0 || greetingIndex >= allGreetings.length) return;

		const newGreeting = allGreetings[greetingIndex];
		const firstMessage = conversation.messages[0];

		if (!firstMessage || firstMessage.role !== "assistant") return;

		const updatedFirstMessage: Message = {
			...firstMessage,
			content: newGreeting,
		};

		const updatedMessages = [updatedFirstMessage, ...conversation.messages.slice(1)];
		onConversationUpdate({ messages: updatedMessages });
		setShouldAutoScroll(false);
	};

	const updateConversationSettings = (settings: ConversationSettings) => {
		if (!conversation) return;
		onConversationUpdate({ settings });
	};

	const loadMoreMessages = () => {
		setVisibleMessageCount((prev) => Math.min(prev + 10, conversation?.messages.length || 0));
		setShowLoadMore(false);
		setShouldAutoScroll(false);
	};

	if (!conversation) {
		return (
			<div className="flex flex-1 items-center justify-center text-center">
				<div className="flex flex-col items-center gap-3">
					<MessageSquare className="h-16 w-16 text-muted-foreground" />
					<div className="text-2xl font-semibold">No Conversation Selected</div>
					<div className="text-muted-foreground">Create a new conversation to start chatting with {character.name}</div>
					<Button onClick={onCreateNewConversation}>Start New Conversation</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Header */}
			<div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
				<div className="flex items-center gap-2">
					{rateLimit ? (
						<Badge variant="secondary" className="text-xs" title="Remaining requests today for this model">
							{rateLimit.remaining} messages left ({globalSettings.model})
						</Badge>
					) : globalSettings.provider === "pawan" ? (
						<Badge variant="secondary" className="text-xs" title="Remaining requests today for this model">
							ℹ️ Send a message to show remaining messages
						</Badge>
					) : null}
				</div>
				<div className="flex items-center gap-1">
					<Button variant="ghost" size="icon" onClick={() => setShowConversationSettings(true)} title="Conversation settings">
						<Settings className="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="icon" onClick={() => setShowCharacterProfile(true)} title="Character info">
						<Info className="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="icon" onClick={() => setShowPersonaForm(true)} title={persona ? "Edit persona" : "Create persona"}>
						<User className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Messages */}
			<div ref={messagesContainerRef} className="relative flex flex-1 min-h-0 flex-col overflow-y-auto px-2 sm:px-4">
				{showLoadMore ? (
					<div className="sticky top-0 z-10 flex justify-center py-2">
						<Button variant="outline" size="sm" onClick={loadMoreMessages}>
							Load {Math.min(10, (conversation?.messages.length || 0) - visibleMessageCount)} older messages
						</Button>
					</div>
				) : null}

				{conversation.messages
					.slice(-visibleMessageCount)
					.filter((message) => !streamingMessage || message.id !== streamingMessage.id)
					.map((message) => {
						const messageIndex = conversation.messages.findIndex((m) => m.id === message.id);
						const isFirstMessage = messageIndex === 0;
						const isLastMessage = messageIndex === conversation.messages.length - 1;

						return (
							<MessageBubble
								key={message.id}
								message={message}
								characterAvatar={character.avatar}
								characterName={character.name}
								character={character}
								persona={persona}
								settings={globalSettings}
								isLoading={regeneratingMessageId === message.id}
								isFirstMessage={isFirstMessage}
								onRegenerate={message.role === "assistant" ? () => regenerateMessage(message.id) : undefined}
								onDelete={() => handleDeleteMessage(message.id)}
								onDeleteGeneration={message.role === "assistant" ? () => handleDeleteGeneration(message.id) : undefined}
								onDeleteFromHere={() => handleDeleteFromHere(message.id)}
								onEdit={(currentContent) => handleEditMessage(message.id, currentContent)}
								onSwitchVariant={(variantIndex) => switchVariant(message.id, variantIndex)}
								onSwitchGreeting={isFirstMessage ? switchGreeting : undefined}
								onRetry={message.role === "user" && isLastMessage && !streamingMessage && !isLoading ? () => retryFromUserMessage(message.id) : undefined}
							/>
						);
					})}

				{streamingMessage ? (
					<MessageBubble
						key={streamingMessage.id}
						message={streamingMessage}
						characterAvatar={character.avatar}
						characterName={character.name}
						character={character}
						persona={persona}
						settings={globalSettings}
						isLoading={true}
						isFirstMessage={false}
						onSwitchVariant={() => {}}
						onSwitchGreeting={() => {}}
						onEdit={() => {}}
						onDelete={() => {}}
						onDeleteGeneration={() => {}}
						onDeleteFromHere={() => {}}
					/>
				) : null}

				<div ref={messagesEndRef} />
			</div>

			{/* Input */}
			<div className="shrink-0">
				<ChatInput onSendMessage={sendMessage} disabled={isLoading} persona={persona} onOpenPersonaSetup={() => setShowPersonaForm(true)} />
			</div>

			{/* Modals */}
			{showConversationSettings ? <ConvSettings settings={globalSettings} onSettingsChange={onGlobalSettingsChange} isOpen={showConversationSettings} onClose={() => setShowConversationSettings(false)} /> : null}
			{showPersonaForm ? <PersonaForm persona={persona} onPersonaUpdate={onPersonaUpdate} onClose={() => setShowPersonaForm(false)} /> : null}
			<CharacterInfoDialog character={character} open={showCharacterProfile} onOpenChange={setShowCharacterProfile} italicColor={globalSettings.italicColor} />

			<Dialog open={!!deleteConfirmation} onOpenChange={(open) => !open && setDeleteConfirmation(null)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{getDeleteDialogContent().title}</DialogTitle>
						<DialogDescription>{getDeleteDialogContent().content}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteConfirmation(null)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={executeDelete}>
							{deleteConfirmation?.type === "fromHere" ? "Delete All" : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={!!editingMessage} onOpenChange={(open) => !open && setEditingMessage(null)}>
				<DialogContent className="sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>Edit Message</DialogTitle>
					</DialogHeader>
					<div>
						<Textarea value={editingMessage?.content || ""} onChange={(e) => setEditingMessage((prev) => (prev ? { ...prev, content: e.target.value } : null))} rows={6} placeholder="Edit your message..." />
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditingMessage(null)}>
							Cancel
						</Button>
						<Button onClick={handleSaveEdit} disabled={!editingMessage?.content.trim()}>
							Save Changes
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
