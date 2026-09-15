"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";

type OnlineContextValue = {
	socket: Socket | null;
	onlineCount: number | null;
	isConnected: boolean;
};

const OnlineContext = createContext<OnlineContextValue>({ socket: null, onlineCount: null, isConnected: false });

export function useOnline() {
	return useContext(OnlineContext);
}

export default function SocketProvider({ children }: { children: React.ReactNode }) {
	const [onlineCount, setOnlineCount] = useState<number | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [socket, setSocket] = useState<Socket | null>(null);

	useEffect(() => {
		let active = true;
		let connection: Socket | undefined;
		// Ensure server is started, then connect
		const ensureServer = async () => {
			try {
				const response = await fetch("/api/connect", { method: "GET" });
				if (!response.ok || !active) return;
			} catch { return; }
			const url = window.location.origin;
			const s = io(url, { path: "/api/socket", addTrailingSlash: false });
			connection = s;
			setSocket(s);
			s.on("connect", () => setIsConnected(true));
			s.on("disconnect", () => setIsConnected(false));
			s.on("onlineCount", (count: number) => setOnlineCount(count));
		};
		ensureServer();
		return () => {
			active = false;
			if (connection) {
				connection.off("connect");
				connection.off("disconnect");
				connection.off("onlineCount");
				connection.close();
			}
		};
	}, []);

	const value = useMemo<OnlineContextValue>(() => ({ socket, onlineCount, isConnected }), [socket, onlineCount, isConnected]);

	return <OnlineContext.Provider value={value}>{children}</OnlineContext.Provider>;
}
