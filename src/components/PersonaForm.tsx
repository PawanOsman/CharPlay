"use client";

import { Persona } from "@/types";
import { useRef, useState } from "react";
import { X, User, ImagePlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PersonaFormProps {
	persona: Persona | null;
	onPersonaUpdate: (persona: Persona) => void;
	onClose: () => void;
}

export default function PersonaForm({ persona, onPersonaUpdate, onClose }: PersonaFormProps) {
	const [formData, setFormData] = useState<Persona>(persona || { name: "", traits: "", background: "", age: undefined, gender: "", appearance: "", avatar: "" });
	const isAgeInvalid = typeof formData.age === "number" && formData.age < 18;
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const isNameMissing = !formData.name.trim();
	const isAgeMissing = typeof formData.age !== "number";
	const isGenderMissing = !formData.gender?.trim();
	const [errors, setErrors] = useState<{ name?: string; age?: string; gender?: string }>({});

	// Field validators (used onChange and onBlur)
	const validateName = (name: string): string | undefined => {
		return name.trim() ? undefined : "Name is required";
	};

	const validateAge = (ageValue: number | undefined): string | undefined => {
		if (typeof ageValue !== "number") return "Age is required";
		if (ageValue < 18) return "Age must be 18 or older.";
		return undefined;
	};

	const validateGender = (genderValue: string | undefined): string | undefined => {
		return genderValue && genderValue.trim() ? undefined : "Gender is required";
	};

	const handleImageUpload: React.ChangeEventHandler<HTMLInputElement> = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			setFormData((prev) => ({ ...prev, avatar: result }));
		};
		reader.readAsDataURL(file);
		// Reset the input so selecting the same file again triggers onChange
		e.currentTarget.value = "";
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const newErrors: { name?: string; age?: string; gender?: string } = {};
		if (isNameMissing) newErrors.name = "Name is required";
		if (isAgeMissing) newErrors.age = "Age is required";
		if (!isAgeMissing && isAgeInvalid) newErrors.age = "Age must be 18 or older.";
		if (isGenderMissing) newErrors.gender = "Gender is required";

		setErrors(newErrors);

		const hasErrors = Object.keys(newErrors).length > 0;
		if (hasErrors) return;

		onPersonaUpdate(formData);
		onClose();
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="w-[100vw] h-[100dvh] max-w-[100vw] rounded-none m-0 p-4 overflow-y-auto sm:max-w-md sm:h-auto sm:rounded-lg sm:m-auto sm:p-6">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<User className="h-5 w-5" /> {persona ? "Edit Persona" : "Create Persona"}
					</DialogTitle>
				</DialogHeader>
				<form id="persona-form" noValidate onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<label className="text-sm font-medium">
							Avatar <span className="text-xs text-muted-foreground font-normal">(optional)</span>
						</label>
						<div className="flex items-center gap-3">
							<Avatar key={formData.avatar && (formData.avatar.startsWith("http") || formData.avatar.startsWith("data:")) ? "has-image" : `no-image-${formData.name?.trim()?.charAt(0) || "_"}`} className="h-10 w-10 rounded-lg">
								{formData.avatar && (formData.avatar.startsWith("http") || formData.avatar.startsWith("data:")) ? <AvatarImage className="object-cover" src={formData.avatar} alt="Persona avatar" /> : null}
								<AvatarFallback delayMs={0} className="rounded-lg text-base">
									{formData.avatar && !(formData.avatar.startsWith("http") || formData.avatar.startsWith("data:")) ? formData.avatar : formData.name?.trim() ? formData.name.trim().charAt(0).toUpperCase() : <User className="h-4 w-4" />}
								</AvatarFallback>
							</Avatar>
							<Input value={formData.avatar || ""} onChange={(e) => setFormData({ ...formData, avatar: e.target.value })} placeholder="Emoji (e.g., 😀) or image URL" />
							<input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
							<Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} title="Upload image">
								<ImagePlus className="h-4 w-4" />
							</Button>
							{formData.avatar ? (
								<Button type="button" variant="outline" size="icon" onClick={() => setFormData({ ...formData, avatar: "" })} title="Clear avatar">
									<X className="h-4 w-4" />
								</Button>
							) : null}
						</div>
						<p className="text-xs text-muted-foreground">Enter an emoji, paste an image URL, or upload an image.</p>
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium">
							Name <span className="text-xs text-muted-foreground font-normal">(Required)</span> <span className="text-destructive">*</span>
						</label>
						<Input
							value={formData.name}
							onChange={(e) => {
								const value = e.target.value;
								setFormData({ ...formData, name: value });
								setErrors((prev) => ({ ...prev, name: validateName(value) }));
							}}
							onBlur={() => setErrors((prev) => ({ ...prev, name: validateName(formData.name) }))}
							placeholder="Your name or nickname"
							aria-invalid={!!errors.name}
						/>
						{errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">
								Age <span className="text-xs text-muted-foreground font-normal">(Required)</span> <span className="text-destructive">*</span>
							</label>
							<Input
								type="number"
								min={18}
								value={formData.age ?? ""}
								onChange={(e) => {
									const value = e.target.value === "" ? undefined : Number(e.target.value);
									setFormData({ ...formData, age: value });
									setErrors((prev) => ({ ...prev, age: validateAge(value) }));
								}}
								onBlur={() => setErrors((prev) => ({ ...prev, age: validateAge(formData.age) }))}
								placeholder="18+"
								aria-invalid={!!errors.age || isAgeInvalid}
							/>
							{errors.age ? <p className="text-xs text-destructive">{errors.age}</p> : isAgeInvalid ? <p className="text-xs text-destructive">Age must be 18 or older.</p> : null}
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">
								Gender <span className="text-xs text-muted-foreground font-normal">(Required)</span> <span className="text-destructive">*</span>
							</label>
							<Input
								value={formData.gender || ""}
								onChange={(e) => {
									const value = e.target.value;
									setFormData({ ...formData, gender: value });
									setErrors((prev) => ({ ...prev, gender: validateGender(value) }));
								}}
								onBlur={() => setErrors((prev) => ({ ...prev, gender: validateGender(formData.gender) }))}
								placeholder="e.g., male, female"
								aria-invalid={!!errors.gender}
							/>
							{errors.gender ? <p className="text-xs text-destructive">{errors.gender}</p> : null}
						</div>
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium">
							Personality Traits <span className="text-xs text-muted-foreground font-normal">(optional)</span>
						</label>
						<Textarea value={formData.traits} onChange={(e) => setFormData({ ...formData, traits: e.target.value })} placeholder="Describe your personality (e.g., curious, friendly, analytical...)" rows={3} />
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium">
							Background <span className="text-xs text-muted-foreground font-normal">(optional)</span>
						</label>
						<Textarea value={formData.background} onChange={(e) => setFormData({ ...formData, background: e.target.value })} placeholder="Brief background about yourself (optional)" rows={3} />
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium">
							Appearance <span className="text-xs text-muted-foreground font-normal">(optional)</span>
						</label>
						<Textarea value={formData.appearance || ""} onChange={(e) => setFormData({ ...formData, appearance: e.target.value })} placeholder="Describe your appearance, style, notable features (optional)" rows={3} />
					</div>
				</form>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" form="persona-form" disabled={isNameMissing || isAgeMissing || isGenderMissing || isAgeInvalid} aria-disabled={isNameMissing || isAgeMissing || isGenderMissing || isAgeInvalid}>
						Save Persona
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
