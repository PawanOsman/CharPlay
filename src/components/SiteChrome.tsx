"use client";

import { Github, MessageCircle, Mail, LayoutGrid, BookOpenText, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/components/SocketProvider";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { HeaderActionsProvider } from "@/components/HeaderActionsContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
	const { onlineCount, isConnected } = useOnline();
	const pathname = usePathname();
	const router = useRouter();
	const [actions, setActions] = useState<React.ReactNode>(null);
	const isCharacterRoute = pathname?.startsWith("/character");
	const tabs = useMemo(
		() => [
			{ href: "/", label: "Home", icon: <LayoutGrid className="h-4 w-4" /> },
			{ href: "/faq", label: "FAQ", icon: <BookOpenText className="h-4 w-4" /> },
		],
		[]
	);
	return (
		<HeaderActionsProvider value={{ actions, setActions }}>
			{isCharacterRoute ? (
				<>{children}</>
			) : (
				<div className="min-h-screen">
					<header className="sticky top-0 z-10 border-b bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40">
						<div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4 sm:py-4 md:px-6">
							<div className="flex flex-col gap-3 sm:min-h-16">
								<div className="flex items-center justify-between gap-3">
									<Link href="/" className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
										Pawan.Krd Playground
									</Link>
									<div className="flex items-center gap-2">
										<div className="rounded-md border px-2 py-1 text-xs text-muted-foreground">{isConnected ? `${onlineCount ?? 0} online` : "connecting..."}</div>
										<a className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground" href="https://github.com/PawanOsman/CharPlay" target="_blank" rel="noreferrer" aria-label="GitHub Repository" title="Open GitHub Repository">
											<Github className="h-5 w-5" />
											<span className="hidden sm:inline">GitHub</span>
										</a>
									</div>
								</div>
								<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
									<nav className="order-0 sm:order-none flex items-center gap-1 w-full sm:w-auto overflow-x-auto whitespace-nowrap">
										{tabs.map((tab) => {
											const active = pathname === tab.href;
											return (
												<Button key={tab.href} variant={active ? "default" : "ghost"} size="sm" onClick={() => router.push(tab.href)} className="gap-2 shrink-0 cursor-pointer">
													{tab.icon}
													{tab.label}
												</Button>
											);
										})}
									</nav>
									{/* Desktop actions */}
									<div className="hidden sm:flex items-center gap-2">{actions}</div>
									{/* Mobile actions: full width stacked */}
									<div className="sm:hidden order-1 flex flex-col gap-2 w-full [&>*]:w-full">{actions}</div>
								</div>
							</div>
						</div>
					</header>

					<div className="min-h-[calc(100vh-48px-48px)]">{children}</div>

					<footer className="border-t bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40">
						<div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-3 py-3 sm:flex-row sm:gap-3 sm:px-4 sm:py-4 md:px-6">
							<p className="text-muted-foreground text-xs sm:text-sm text-center sm:text-left">© {new Date().getFullYear()} Pawan.Krd Playground. All rights reserved.</p>
							<div className="flex items-center gap-4">
								<a className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground transition hover:text-foreground" href="https://discord.gg/pawan" target="_blank" rel="noopener noreferrer">
									<MessageCircle className="h-4 w-4" /> <span className="hidden sm:inline">Discord</span>
								</a>
								<a className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground transition hover:text-foreground" href="https://github.com/PawanOsman/CharPlay" target="_blank" rel="noopener noreferrer">
									<Github className="h-4 w-4" /> <span className="hidden sm:inline">GitHub</span>
								</a>
								<a className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground transition hover:text-foreground" href="mailto:contact@pawan.krd">
									<Mail className="h-4 w-4" /> <span className="hidden sm:inline">Email</span>
								</a>
							</div>
						</div>
					</footer>
				</div>
			)}
		</HeaderActionsProvider>
	);
}
