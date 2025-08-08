"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Character } from "@/types";
import { predefinedCharacters } from "@/data/characters";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import CharacterCard from "./CharacterCard";
import { useHeaderActions } from "@/components/HeaderActionsContext";

export default function HomePage() {
	const router = useRouter();
	const { setActions } = useHeaderActions();
	const [uploadedCharacters, setUploadedCharacters] = useLocalStorage<Character[]>("uploaded-characters", []);
	const [deleteConfirmCharacter, setDeleteConfirmCharacter] = useState<Character | null>(null);
	const [showAlert, setShowAlert] = useLocalStorage<boolean>("home-alert-visible", true);
	const [dismissedThisSession, setDismissedThisSession] = useState(false);

	const handleExportData = () => {
		const dump: Record<string, string | null> = {};
		for (let i = 0; i < localStorage.length; i += 1) {
			const key = localStorage.key(i);
			if (!key) continue;
			dump[key] = localStorage.getItem(key);
		}
		const payload = {
			version: 1,
			exportedAt: new Date().toISOString(),
			data: dump,
		};
		const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		const ts = new Date().toISOString().replace(/[:.]/g, "-");
		a.href = url;
		a.download = `aicharplay-backup-${ts}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const content = e.target?.result as string;
				const parsed = JSON.parse(content);
				const data: Record<string, string | null> = parsed?.data && typeof parsed.data === "object" ? parsed.data : parsed;
				Object.keys(data || {}).forEach((key) => {
					const value = data[key];
					if (typeof value === "string") {
						localStorage.setItem(key, value);
					} else if (value === null) {
						localStorage.removeItem(key);
					}
				});
				// Refresh in-memory state
				window.location.reload();
			} catch {
				// ignore
			}
		};
		reader.readAsText(file);
		// reset input value to allow re-importing same file
		event.currentTarget.value = "";
	};

	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const content = e.target?.result as string;
					const characterData = JSON.parse(content);

					// Parse character (same logic as before)
					let character: Character;
					if (characterData.spec && characterData.data) {
						// Character Card v2 format
						character = {
							id: `${Date.now()}`,
							name: characterData.data.name || "Unknown",
							description: characterData.data.description || "",
							avatar: characterData.data.avatar || "👤",
							tags: characterData.data.tags || [],
							personality: characterData.data.personality || "",
							first_mes: characterData.data.first_mes || "Hello!",
							scenario: characterData.data.scenario || "",
							depth_prompt: characterData.data.extensions?.depth_prompt?.prompt || "",
							example_dialogue: characterData.data.mes_example || "",
							creator: characterData.data.creator,
							creator_notes: characterData.data.creator_notes,
							alternate_greetings: characterData.data.alternate_greetings,
							character_version: characterData.data.character_version,
							mes_example: characterData.data.mes_example,
							post_history_instructions: characterData.data.post_history_instructions,
							system_prompt: characterData.data.system_prompt,
						};
					} else {
						// Legacy format
						character = {
							id: `${Date.now()}`,
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
					}

					setUploadedCharacters((prev) => [...prev, character]);
				} catch (error) {
					console.error("Error parsing character file:", error);
					alert("Error parsing character file. Please check the format.");
				}
			};
			reader.readAsText(file);
		}
	};

	const allCharacters = [...predefinedCharacters, ...uploadedCharacters];

	const handleCharacterSelect = (character: Character) => {
		router.push(`/character/${character.id}`);
	};

	const handleDeleteCharacter = (character: Character) => {
		setDeleteConfirmCharacter(character);
	};

	const confirmDeleteCharacter = () => {
		if (!deleteConfirmCharacter) return;

		// Remove character from uploaded characters
		setUploadedCharacters((prev) => prev.filter((c) => c.id !== deleteConfirmCharacter.id));

		// Remove all conversations for this character from localStorage
		localStorage.removeItem(`conversations-${deleteConfirmCharacter.id}`);

		setDeleteConfirmCharacter(null);
	};

	// Dark mode only - no theme toggle needed

	useEffect(() => {
		setActions(
			<>
				<Button asChild variant="default" className="font-semibold">
					<label className="cursor-pointer">
						<span className="inline-flex items-center gap-2">
							<Upload className="h-4 w-4" /> Upload Character
						</span>
						<input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
					</label>
				</Button>
				<div className="flex w-full sm:w-auto gap-2 [&>*]:w-1/2 sm:[&>*]:w-auto">
					<Button variant="secondary" onClick={handleExportData} className="font-semibold cursor-pointer">
						<Download className="h-4 w-4 mr-2" /> Export
					</Button>
					<Button asChild variant="secondary" className="font-semibold">
						<label className="cursor-pointer">
							<span className="inline-flex items-center gap-2">
								<Upload className="h-4 w-4" /> Import
							</span>
							<input type="file" accept=".json" onChange={handleImportData} className="hidden" />
						</label>
					</Button>
				</div>
			</>
		);
		return () => setActions(null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className="min-h-screen">
			{/* Main */}
			<main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:px-8">
				{/* Welcome hero */}
				<section className="mb-8 rounded-lg border bg-background/60 p-4 sm:p-6">
					<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Welcome to Pawan.Krd AI Character Playground</h1>
					<p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-3xl">
						Chat with AI characters, customize personas, and try different models. Everything is local-first and open source. Join our
						<strong className="mx-1 text-foreground">Discord community</strong>
						to share feedback, request features, and get help.
					</p>
					<div className="mt-4">
						<a href="https://discord.gg/pawan" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">
							<span>Join Discord</span>
						</a>
					</div>
				</section>
				{showAlert && !dismissedThisSession ? (
					<Alert className="mx-auto mb-8 max-w-3xl">
						<AlertTitle>Local Data & Backups</AlertTitle>
						<AlertDescription>
							<p>All chats, conversations, and uploaded characters are stored locally in your browser (no cloud sync).</p>
							<ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
								<li>
									Use <strong>Export Data</strong> (top-right) to download a backup JSON file of everything.
								</li>
								<li>
									Use <strong>Import Data</strong> to restore your backup on this or another device.
								</li>
								<li>Your data may be lost if you clear site data, use private/incognito mode, or switch browsers.</li>
							</ul>
							<p className="mt-2">
								This is a playground for trying <strong>Pawan.Krd</strong> models, not a production service.
							</p>
							<div className="mt-3 flex gap-2">
								<Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setDismissedThisSession(true)}>
									Close
								</Button>
								<Button size="sm" variant="secondary" className="cursor-pointer" onClick={() => setShowAlert(false)}>
									Don't show again
								</Button>
							</div>
						</AlertDescription>
					</Alert>
				) : null}

				<div className="mb-8 flex flex-col items-center gap-3">
					<h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Choose Your Character</h2>
					<p className="text-muted-foreground max-w-2xl text-center text-base">Select a character to start a conversation. Each character has unique personality traits.</p>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{allCharacters.map((character) => {
						const isUploadedCharacter = uploadedCharacters.some((uc) => uc.id === character.id);
						return (
							<div key={character.id} className="h-full">
								<CharacterCard character={character} onClick={() => handleCharacterSelect(character)} onDelete={isUploadedCharacter ? () => handleDeleteCharacter(character) : undefined} isUploadedCharacter={isUploadedCharacter} />
							</div>
						);
					})}
				</div>

				{allCharacters.length === 0 && (
					<div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-12 text-center">
						<div className="text-5xl">🤖</div>
						<h3 className="text-xl font-semibold">No Characters Available</h3>
						<p className="text-muted-foreground">Upload a character file to get started with your AI conversations.</p>
						<Button asChild>
							<label className="cursor-pointer">
								<span className="inline-flex items-center gap-2">
									<Upload className="h-4 w-4" /> Upload Your First Character
								</span>
								<input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
							</label>
						</Button>
					</div>
				)}
			</main>

			{/* Footer moved to global chrome */}

			<Dialog open={!!deleteConfirmCharacter} onOpenChange={(open) => !open && setDeleteConfirmCharacter(null)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete Character</DialogTitle>
						<DialogDescription>Are you sure you want to delete "{deleteConfirmCharacter?.name}"? This will also permanently delete all conversations with this character.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteConfirmCharacter(null)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={confirmDeleteCharacter}>
							Delete Character
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
