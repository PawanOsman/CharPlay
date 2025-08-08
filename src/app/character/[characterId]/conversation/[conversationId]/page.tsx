"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Character, Conversation } from "@/types";
import { predefinedCharacters } from "@/data/characters";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import ChatInterface from "@/components/ChatInterface";
import { ArrowLeft } from "lucide-react";

export default function ConversationPage() {
	const params = useParams();
	const router = useRouter();
	const characterId = params.characterId as string;
	const conversationId = params.conversationId as string;

	const [uploadedCharacters] = useLocalStorage<Character[]>("uploaded-characters", []);
	const [character, setCharacter] = useState<Character | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const allCharacters = [...predefinedCharacters, ...uploadedCharacters];
		const foundCharacter = allCharacters.find((c) => c.id === characterId);

		setCharacter(foundCharacter || null);
		setLoading(false);
	}, [characterId, uploadedCharacters]);

	const handleBackToHome = () => {
		router.push("/");
	};

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="flex flex-col items-center gap-2 text-muted-foreground">
					<div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
					<div>Loading conversation...</div>
				</div>
			</div>
		);
	}

	if (!character) {
		return (
			<div className="flex min-h-screen items-center justify-center text-center">
				<div className="flex flex-col items-center gap-4">
					<div className="text-6xl">🤖</div>
					<div className="text-2xl font-semibold">Character Not Found</div>
					<div className="text-muted-foreground">The character you're looking for doesn't exist or has been removed.</div>
					<Button onClick={handleBackToHome}>
						<ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
					</Button>
				</div>
			</div>
		);
	}

	return <ChatInterface character={character} onBackToHome={handleBackToHome} initialConversationId={conversationId} />;
}
