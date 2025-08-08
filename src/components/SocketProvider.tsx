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
		// Ensure server is started, then connect
		const ensureServer = async () => {
			try {
				await fetch("/api/socket", { method: "GET" });
			} catch {}
			const port = Number(process.env.NEXT_PUBLIC_SOCKET_PORT || 4000);
			const url = `${window.location.protocol}//${window.location.hostname}:${port}`;
			const s = io(url, { path: "/api/socket", addTrailingSlash: false });
			setSocket(s);
			s.on("connect", () => setIsConnected(true));
			s.on("disconnect", () => setIsConnected(false));
			s.on("onlineCount", (count: number) => setOnlineCount(count));
		};
		ensureServer();
		return () => {
			if (socket) {
				socket.off("connect");
				socket.off("disconnect");
				socket.off("onlineCount");
				socket.close();
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const value = useMemo<OnlineContextValue>(() => ({ socket, onlineCount, isConnected }), [onlineCount, isConnected]);

	return <OnlineContext.Provider value={value}>{children}</OnlineContext.Provider>;
}
