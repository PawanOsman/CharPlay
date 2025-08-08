"use client";

import React, { createContext, useContext } from "react";

export interface HeaderActionsValue {
	actions: React.ReactNode;
	setActions: (node: React.ReactNode) => void;
}

const HeaderActionsContext = createContext<HeaderActionsValue | undefined>(undefined);

export function HeaderActionsProvider({ value, children }: { value: HeaderActionsValue; children: React.ReactNode }) {
	return <HeaderActionsContext.Provider value={value}>{children}</HeaderActionsContext.Provider>;
}

export function useHeaderActions() {
	const ctx = useContext(HeaderActionsContext);
	if (!ctx) throw new Error("useHeaderActions must be used within HeaderActionsProvider");
	return ctx;
}
