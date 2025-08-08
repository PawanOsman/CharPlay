import type { Metadata } from "next";
import ThemeProvider from "@/components/ThemeProvider";
import SocketProvider from "@/components/SocketProvider";
import SiteChrome from "@/components/SiteChrome";
import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
	title: "Pawan.Krd AI Character Playground",
	description: "Interactive AI character playground",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={`${inter.variable} dark`}>
			<body className={`${inter.className} min-h-screen`}>
				<ThemeProvider>
					<SocketProvider>
						<SiteChrome>{children}</SiteChrome>
						<Toaster position="top-center" richColors closeButton />
					</SocketProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
