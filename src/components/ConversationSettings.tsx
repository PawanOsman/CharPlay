"use client";

import { useState, useEffect, useRef } from "react";
import { ConversationSettings as SettingsType } from "@/types";
import { Settings, RefreshCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface ConversationSettingsProps {
	settings: SettingsType;
	onSettingsChange: (settings: SettingsType) => void;
	isOpen: boolean;
	onClose: () => void;
}

const DEFAULT_SETTINGS: SettingsType = {
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

interface ModelOption {
	id: string;
	name?: string;
	owner?: string;
	description?: string;
	order?: number;
}

export default function ConversationSettings({ settings, onSettingsChange, isOpen, onClose }: ConversationSettingsProps) {
	const [localSettings, setLocalSettings] = useState<SettingsType>(settings);
	const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
	const [modelsLoading, setModelsLoading] = useState(true);
	const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
	const [modelSearch, setModelSearch] = useState("");
	const [visibleCount, setVisibleCount] = useState(50);
	const modelTriggerRef = useRef<HTMLButtonElement | null>(null);
	const [modelTriggerWidth, setModelTriggerWidth] = useState<number | undefined>(undefined);

	// Sync local settings when external settings change
	useEffect(() => {
		setLocalSettings({ ...settings });
	}, [settings]);

	const loadModels = async () => {
		try {
			setModelsLoading(true);
			if (localSettings.provider === "openai") {
				if (!localSettings.apiBaseUrl || !localSettings.apiKey) {
					// Missing config; do not load
					setAvailableModels([]);
					return;
				}
                const url = `${localSettings.apiBaseUrl.replace(/\/$/, "")}/models`;
                const res = await fetch(url, { headers: { Authorization: `Bearer ${localSettings.apiKey}` } });
                if (!res.ok) {
                    // Use OpenAI-style error format if provided
                    try {
                        const err = await res.json();
                        throw new Error(err?.error?.message || "Failed to load models");
                    } catch {
                        throw new Error("Failed to load models");
                    }
                }
                const data = await res.json();
                const models = (data?.data || data || []).map((model: any) => ({
					id: model.id,
					name: typeof model.name === "string" && model.name ? model.name : undefined,
					owner: typeof model.owned_by === "string" && model.owned_by ? model.owned_by : undefined,
					description: typeof model.description === "string" && model.description ? model.description : undefined,
					order: typeof model.order === "number" ? model.order : undefined,
				}));
				setAvailableModels(models);
			} else {
                const response = await fetch(`/api/models`);
                if (!response.ok) {
					try {
						const err = await response.json();
						throw new Error(err?.error?.message || "Failed to load models");
					} catch {
						throw new Error("Failed to load models");
					}
				}
				const models = await response.json();
				setAvailableModels(models);
			}
		} catch (error) {
			console.error("Error fetching models:", error);
			setAvailableModels([]);
			// Silently ignore here; toast is shown in chat flows. Could add a toast here if desired.
		} finally {
			setModelsLoading(false);
		}
	};

	useEffect(() => {
		if (isOpen) {
			loadModels();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, localSettings.provider, localSettings.apiBaseUrl, localSettings.apiKey]);

	useEffect(() => {
		if (!modelPopoverOpen) return;
		const updateWidth = () => setModelTriggerWidth(modelTriggerRef.current?.offsetWidth || undefined);
		updateWidth();
		window.addEventListener("resize", updateWidth);
		return () => window.removeEventListener("resize", updateWidth);
	}, [modelPopoverOpen]);

	const handleSave = () => {
		onSettingsChange(localSettings);
		onClose();
	};

	const handleReset = () => {
		setLocalSettings({ ...DEFAULT_SETTINGS });
	};

	const updateSetting = <K extends keyof SettingsType>(key: K, value: SettingsType[K]) => {
		setLocalSettings((prev) => ({ ...prev, [key]: value }));
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="w-[100vw] h-[100dvh] max-w-[100vw] rounded-none p-0 sm:w-full sm:max-w-3xl sm:h-[80vh] sm:rounded-lg flex flex-col min-h-0">
				<div className="flex h-full min-h-0 flex-col">
					<div className="sticky top-0 z-10 border-b bg-background p-4">
						<div className="flex items-center gap-2">
							<Settings className="h-5 w-5" />
							<DialogTitle className="p-0">Conversation Settings</DialogTitle>
						</div>
					</div>
					<div className="flex-1 min-h-0 overflow-y-auto p-4">
						<div className="space-y-4">
							<div className="space-y-2">
								<Label>Provider</Label>
								<Select value={localSettings.provider || "pawan"} onValueChange={(v) => updateSetting("provider", v as any)}>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select a provider" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="pawan">Pawan.Krd</SelectItem>
										<SelectItem value="openai">OpenAI-compatible</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{localSettings.provider === "openai" ? (
								<div className="space-y-2">
									<Label>API Base URL</Label>
									<Input value={localSettings.apiBaseUrl || ""} onChange={(e) => updateSetting("apiBaseUrl", e.target.value)} placeholder="https://api.openai.com/v1" />
									<div className="text-muted-foreground text-xs">Requests will be sent to this server and models will be listed from it.</div>
								</div>
							) : null}

							{localSettings.provider === "openai" ? (
								<div className="space-y-2">
									<Label>API Key</Label>
									<Input type="password" value={localSettings.apiKey || ""} onChange={(e) => updateSetting("apiKey", e.target.value)} placeholder="sk-..." />
									<div className="text-muted-foreground text-xs">Stored locally in your browser. Never sent to our servers.</div>
								</div>
							) : null}

							{localSettings.provider === "pawan" ? (
								<div className="space-y-2">
									<Label>Pawan.Krd API Key (optional)</Label>
									<Input type="password" value={localSettings.pawanApiKey || ""} onChange={(e) => updateSetting("pawanApiKey", e.target.value)} placeholder="pk-..." />
									<div className="text-muted-foreground text-xs">
										Provide your Pawan.Krd API key to use your credits. (more usage and faster responses) This is optional.{" "}
										<a style={{ color: "white" }} href="https://discord.gg/pawan" target="_blank" rel="noreferrer">
											(Create one here)
										</a>
									</div>
								</div>
							) : null}

							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label>Model</Label>
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											setVisibleCount(50);
											setModelSearch("");
											loadModels();
										}}
										disabled={modelsLoading || (localSettings.provider === "openai" && (!localSettings.apiBaseUrl || !localSettings.apiKey))}
										title="Refresh models list"
									>
										<RefreshCcw className="h-4 w-4 mr-2" /> Refresh
									</Button>
								</div>
								{modelsLoading ? (
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
										Loading models...
									</div>
								) : (
									<Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
										<PopoverTrigger asChild>
											<Button ref={modelTriggerRef} variant="outline" role="combobox" aria-expanded={modelPopoverOpen} className="w-full justify-between">
												{localSettings.model ? availableModels.find((m) => m.id === localSettings.model)?.name || localSettings.model : "Select a model"}
											</Button>
										</PopoverTrigger>
										<PopoverContent align="start" className="p-0" style={{ width: modelTriggerWidth }}>
											<Command shouldFilter={false}>
												<CommandInput
													placeholder="Search models..."
													value={modelSearch}
													onValueChange={(v) => {
														setModelSearch(v);
														setVisibleCount(50);
													}}
												/>
												<CommandEmpty>No models found.</CommandEmpty>
												<div className="max-h-[60vh] overflow-y-auto overscroll-contain" onWheelCapture={(e) => e.stopPropagation()}>
													<CommandList className="max-h-none">
														{(() => {
															const q = modelSearch.trim().toLowerCase();
															const sorted = [...availableModels].sort((a, b) => {
																if (localSettings.provider === "openai") return (a.id || "").localeCompare(b.id || "");
																const ao = (a.order ?? 0) - (b.order ?? 0);
																if (ao !== 0) return ao;
																return (a.name || a.id).localeCompare(b.name || b.id);
															});
															const filtered = q ? sorted.filter((m) => (m.name || m.id).toLowerCase().includes(q) || (m.owner || "").toLowerCase().includes(q) || (m.description || "").toLowerCase().includes(q)) : sorted;
															const toShow = filtered.slice(0, visibleCount);
															return (
																<>
																	{toShow.map((model) => (
																		<CommandItem
																			key={model.id}
																			onSelect={() => {
																				updateSetting("model", model.id as any);
																				setModelPopoverOpen(false);
																			}}
																			value={model.id}
																		>
																			<div className="flex flex-col">
																				<span className="text-sm font-medium">{model.name || model.id}</span>
																				{model.owner || model.description ? (
																					<span className="text-muted-foreground text-xs">
																						{model.owner}
																						{model.owner && model.description ? ": " : ""}
																						{model.description}
																					</span>
																				) : null}
																			</div>
																		</CommandItem>
																	))}
																	{filtered.length > visibleCount ? (
																		<CommandItem disabled onMouseDown={(e) => e.preventDefault()}>
																			<div className="w-full flex justify-center">
																				<Button
																					variant="ghost"
																					size="sm"
																					onClick={(e) => {
																						e.preventDefault();
																						e.stopPropagation();
																						setVisibleCount((c) => c + 50);
																					}}
																				>
																					Load more
																				</Button>
																			</div>
																		</CommandItem>
																	) : null}
																</>
															);
														})()}
													</CommandList>
												</div>
											</Command>
										</PopoverContent>
									</Popover>
								)}
								{localSettings.provider === "openai" && (!localSettings.apiBaseUrl || !localSettings.apiKey) ? <div className="text-muted-foreground text-xs">Enter API Base URL and API Key to load models.</div> : null}
							</div>

							<div className="flex items-center justify-between">
								<div>
									<Label>Streaming</Label>
									<div className="text-muted-foreground text-xs">Real-time responses</div>
								</div>
								<Switch checked={localSettings.streaming} onCheckedChange={(checked) => updateSetting("streaming", checked)} />
							</div>

							<div className="space-y-2">
								<Label>Italic Color</Label>
								<div className="flex items-center gap-2">
									<input type="color" value={localSettings.italicColor} onChange={(e) => updateSetting("italicColor", e.target.value)} className="h-7 w-9 cursor-pointer rounded border" />
									<Input value={localSettings.italicColor} onChange={(e) => updateSetting("italicColor", e.target.value)} placeholder="#8b5cf6" />
								</div>
								<div className="text-muted-foreground text-xs">For italic text in markdown</div>
							</div>

							<Separator />

							<div className="text-sm font-medium">Generation Settings</div>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label>Temperature: {localSettings.temperature}</Label>
									<Slider min={0} max={2} step={0.1} value={[localSettings.temperature]} onValueChange={([v]) => updateSetting("temperature", v)} />
									<div className="text-muted-foreground text-xs">Creativity level</div>
								</div>
								<div className="space-y-2">
									<Label>Top P: {localSettings.top_p}</Label>
									<Slider min={0} max={1} step={0.05} value={[localSettings.top_p]} onValueChange={([v]) => updateSetting("top_p", v)} />
									<div className="text-muted-foreground text-xs">Token sampling</div>
								</div>
								<div className="space-y-2">
									<Label>Max Tokens: {localSettings.max_tokens}</Label>
									<Slider min={100} max={4000} step={100} value={[localSettings.max_tokens]} onValueChange={([v]) => updateSetting("max_tokens", v)} />
									<div className="text-muted-foreground text-xs">Response length</div>
								</div>
								<div className="space-y-2">
									<Label>Frequency Penalty: {localSettings.frequency_penalty}</Label>
									<Slider min={-2} max={2} step={0.1} value={[localSettings.frequency_penalty]} onValueChange={([v]) => updateSetting("frequency_penalty", v)} />
									<div className="text-muted-foreground text-xs">Reduce repetition</div>
								</div>
								<div className="space-y-2">
									<Label>Presence Penalty: {localSettings.presence_penalty}</Label>
									<Slider min={-2} max={2} step={0.1} value={[localSettings.presence_penalty]} onValueChange={([v]) => updateSetting("presence_penalty", v)} />
									<div className="text-muted-foreground text-xs">Encourage new topics</div>
								</div>
								<div className="space-y-2">
									<Label>Top K: {localSettings.top_k}</Label>
									<Slider min={0} max={100} step={1} value={[localSettings.top_k]} onValueChange={([v]) => updateSetting("top_k", v)} />
									<div className="text-muted-foreground text-xs">Token filtering</div>
								</div>
								<div className="space-y-2">
									<Label>Min P: {localSettings.min_p}</Label>
									<Slider min={0} max={1} step={0.05} value={[localSettings.min_p]} onValueChange={([v]) => updateSetting("min_p", v)} />
									<div className="text-muted-foreground text-xs">Minimum probability</div>
								</div>
								<div className="space-y-2">
									<Label>Repetition Penalty: {localSettings.repetition_penalty}</Label>
									<Slider min={0.5} max={2} step={0.1} value={[localSettings.repetition_penalty]} onValueChange={([v]) => updateSetting("repetition_penalty", v)} />
									<div className="text-muted-foreground text-xs">Avoid word repeating</div>
								</div>
							</div>
						</div>
					</div>
					<div className="mt-auto shrink-0 border-t bg-background p-3">
						<div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
							<Button variant="ghost" onClick={handleReset}>
								Reset to Defaults
							</Button>
							<Button variant="outline" onClick={onClose}>
								Cancel
							</Button>
							<Button onClick={handleSave}>Save Settings</Button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
