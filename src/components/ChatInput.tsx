"use client";

import { useState, useRef } from "react";
import { Send, ImagePlus, X, User } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Persona } from "@/types";

interface ChatInputProps {
	onSendMessage: (content: string, image?: string) => void;
	disabled?: boolean;
	persona?: Persona | null;
	onOpenPersonaSetup?: () => void;
}

export default function ChatInput({ onSendMessage, disabled = false, persona, onOpenPersonaSetup }: ChatInputProps) {
	const [message, setMessage] = useState("");
	const [selectedImage, setSelectedImage] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const needsPersonaName = !persona || !persona.name || !persona.name.trim();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if ((message.trim() || selectedImage) && !disabled) {
			onSendMessage(message.trim(), selectedImage || undefined);
			setMessage("");
			setSelectedImage(null);
		}
	};

	const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (e) => {
				setSelectedImage(e.target?.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	const removeImage = () => {
		setSelectedImage(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	return (
		<div className="w-full border-t bg-background/80 backdrop-blur">
			<div className="mx-auto w-full px-2 py-2 sm:px-4">
				{selectedImage && (
					<div className="mb-2 inline-block relative">
						<img src={selectedImage} alt="Selected" className="max-h-32 rounded-md" />
						<Button type="button" variant="destructive" size="icon" className="absolute -right-2 -top-2 h-6 w-6 rounded-full" onClick={removeImage}>
							<X className="h-3 w-3" />
						</Button>
					</div>
				)}

				{needsPersonaName ? (
					<div className="flex items-center justify-center">
						<Button type="button" className="w-full sm:w-auto" onClick={onOpenPersonaSetup} disabled={disabled}>
							<User className="mr-2 h-4 w-4" /> Set up persona
						</Button>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="flex items-end gap-1 sm:gap-2">
						<Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} title="Add image">
							<ImagePlus className="h-5 w-5" />
						</Button>
						<input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />

						<Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your message..." disabled={disabled} rows={1} className="h-10 min-h-0 max-h-32 flex-1 resize-none text-base" />

						<Button type="submit" className="whitespace-nowrap" disabled={(!message.trim() && !selectedImage) || disabled}>
							<Send className="h-4 w-4" />
						</Button>
					</form>
				)}
			</div>
		</div>
	);
}
