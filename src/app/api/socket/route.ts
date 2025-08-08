export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Server as IOServer } from "socket.io";

const getIo = () => {
	const g = globalThis as unknown as { __io?: IOServer; __onlineCount?: number };
	return g;
};

export async function GET(_req: NextRequest) {
	const g = getIo();
	const PORT = Number(process.env.NEXT_PUBLIC_SOCKET_PORT || 4000);

	if (!g.__io) {
		const io = new IOServer({ path: "/api/socket", addTrailingSlash: false, cors: { origin: "*" } });
		io.listen(PORT);

		g.__onlineCount = 0;

		io.on("connection", (socket) => {
			g.__onlineCount = (g.__onlineCount || 0) + 1;
			io.emit("onlineCount", g.__onlineCount);

			socket.on("disconnect", () => {
				g.__onlineCount = Math.max(0, (g.__onlineCount || 1) - 1);
				io.emit("onlineCount", g.__onlineCount);
			});
		});

		g.__io = io;
		return NextResponse.json({ success: true, message: "Socket.IO server started", port: PORT });
	}

	return NextResponse.json({ success: true, message: "Socket.IO already running", port: PORT });
}
