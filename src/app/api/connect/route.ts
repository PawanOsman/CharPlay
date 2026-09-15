import { createServer } from "node:http";
import { NextRequest, NextResponse } from "next/server";
import { Server as IOServer } from "socket.io";
import { assertSameOrigin, isAllowedOrigin, RequestError } from "@/lib/server-security";

export const runtime = "nodejs";

const state = globalThis as typeof globalThis & { __io?: IOServer; __ioStarting?: Promise<void> };

async function startSocketServer(port: number, publicHost: string) {
	const httpServer = createServer();
	const io = new IOServer(httpServer, {
		path: "/api/socket",
		addTrailingSlash: false,
		serveClient: false,
		maxHttpBufferSize: 1024,
		connectTimeout: 10_000,
		allowRequest: (request, callback) => {
			const origin = request.headers.origin;
			// A same-origin Next rewrite replaces the backend Host header with its loopback target.
			const allowed = origin ? isAllowedOrigin(origin, publicHost) : request.headers["sec-fetch-site"] !== "cross-site";
			callback(null, allowed && io.engine.clientsCount < 1000);
		},
	});
	io.on("connection", (socket) => {
		io.emit("onlineCount", io.engine.clientsCount);
		socket.on("disconnect", () => io.emit("onlineCount", io.of("/").sockets.size));
	});
	try {
		await new Promise<void>((resolve, reject) => {
			httpServer.once("error", reject);
			httpServer.listen(port, process.env.SOCKET_HOST || "127.0.0.1", () => {
				httpServer.removeListener("error", reject);
				resolve();
			});
		});
		state.__io = io;
	} catch (error) {
		io.close();
		throw error;
	}
}

export async function GET(request: NextRequest) {
	try {
		assertSameOrigin(request);
		const port = Number(process.env.SOCKET_PORT || process.env.NEXT_PUBLIC_SOCKET_PORT || 4000);
		if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RequestError("The online counter is not configured.", 503);
		if (!state.__io) {
			state.__ioStarting ??= startSocketServer(port, request.headers.get("host") || request.nextUrl.host).finally(() => { state.__ioStarting = undefined; });
			await state.__ioStarting;
		}
		return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		const status = error instanceof RequestError ? error.status : 503;
		const message = error instanceof RequestError ? error.message : "The online counter is unavailable.";
		return NextResponse.json({ error: { message } }, { status, headers: { "Cache-Control": "no-store" } });
	}
}
