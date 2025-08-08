"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps as NextThemesProviderProps } from "next-themes";

type ThemeProviderProps = React.PropsWithChildren<Partial<Pick<NextThemesProviderProps, "attribute" | "defaultTheme" | "enableSystem" | "disableTransitionOnChange">>>;

export default function ThemeProvider({ children, attribute = "class", defaultTheme = "dark", enableSystem = false, disableTransitionOnChange = true }: ThemeProviderProps) {
	return (
		<NextThemesProvider attribute={attribute} defaultTheme={defaultTheme} enableSystem={enableSystem} disableTransitionOnChange={disableTransitionOnChange}>
			{children}
		</NextThemesProvider>
	);
}
