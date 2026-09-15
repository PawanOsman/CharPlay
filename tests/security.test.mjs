import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import { describe, test } from "node:test";
import { io } from "socket.io-client";

const baseUrl = process.env.SECURITY_TEST_BASE_URL;
const validChat = { messages: [{ role: "user", content: "Hello" }], settings: { model: "cosmosrp" } };

// Run only against a local isolated build with an empty PAWANKRD_API_KEY.
// This suite intentionally makes no requests to an upstream model provider.
describe("built application security", { skip: !baseUrl }, () => {
	if (!baseUrl) return;
	const base = new URL(baseUrl);
	assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "SECURITY_TEST_BASE_URL must point to a local test server");
	const origin = base.origin;
	const request = (path, options = {}) => fetch(new URL(path, base), { ...options, signal: AbortSignal.timeout(10_000) });
	const chat = (body = validChat, extra = {}) => request("/api/chat", {
		method: "POST",
		body: typeof body === "string" ? body : JSON.stringify(body),
		headers: { "content-type": "application/json", origin, ...extra },
	});

	test("public pages load with browser security headers and no framework header", async () => {
		for (const path of ["/", "/faq", "/character/example"]) {
			const response = await request(path);
			assert.equal(response.status, 200, path);
			assert.equal(response.headers.get("x-powered-by"), null);
			assert.equal(response.headers.get("x-content-type-options"), "nosniff");
			assert.equal(response.headers.get("x-frame-options"), "DENY");
			assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
			assert.match(response.headers.get("permissions-policy") || "", /camera=\(\)/);
			const csp = response.headers.get("content-security-policy") || "";
			assert.match(csp, /object-src 'none'/);
			assert.match(csp, /frame-ancestors 'none'/);
			assert.match(csp, /base-uri 'self'/);
			await response.arrayBuffer();
		}
	});

	test("malformed JSON and invalid generation settings return 400", async () => {
		for (const body of ["{", { messages: "invalid" }, { ...validChat, settings: { model: "cosmosrp", max_tokens: 1_000_000 } }]) {
			const response = await chat(body);
			assert.equal(response.status, 400);
			assert.equal((await response.json()).error.type, "invalid_request_error");
		}
	});

	test("non-JSON form-compatible requests return 415", async () => {
		const response = await chat(validChat, { "content-type": "text/plain" });
		assert.equal(response.status, 415);
		await response.arrayBuffer();
	});

	test("oversized actual request bodies return 413", async () => {
		const response = await chat({ messages: [{ role: "user", content: "x".repeat(5 * 1024 * 1024) }] });
		assert.equal(response.status, 413);
		await response.arrayBuffer();
	});

	test("oversized Content-Length is rejected before the declared body arrives", async () => {
		const url = new URL("/api/chat", base);
		const result = await new Promise((resolve, reject) => {
			const transport = url.protocol === "https:" ? https : http;
			const req = transport.request(url, {
				method: "POST",
				headers: { origin, "content-type": "application/json", "content-length": String(6 * 1024 * 1024), connection: "close" },
			}, (response) => {
				response.resume();
				response.on("end", () => { resolve(response.statusCode); req.destroy(); });
				response.on("error", reject);
			});
			req.setTimeout(10_000, () => req.destroy(new Error("Oversized request was not rejected promptly")));
			req.on("error", reject);
			req.end("{}");
		});
		assert.equal(result, 413);
	});

	test("foreign browser origins are rejected on every application API route", async () => {
		for (const path of ["/api/chat", "/api/models", "/api/connect"]) {
			const response = await request(path, {
				method: path === "/api/chat" ? "POST" : "GET",
				headers: { origin: "https://attacker.example", "content-type": "application/json" },
				...(path === "/api/chat" ? { body: JSON.stringify(validChat) } : {}),
			});
			assert.equal(response.status, 403, path);
			assert.equal((await response.json()).error.message, "Cross-origin requests are not allowed.");
		}
	});

	test("an unconfigured provider returns a sanitized 503 without contacting upstream", async () => {
		for (const response of [await chat(), await request("/api/models")]) {
			assert.equal(response.status, 503, "Start the isolated test server with PAWANKRD_API_KEY='' before running this suite");
			assert.equal(response.headers.get("cache-control"), "no-store");
			assert.deepEqual(await response.json(), { error: { message: "The chat provider is not configured.", type: "server_error", code: 503 } });
		}
	});

	test("Socket.IO polling accepts the app Origin through the same-origin rewrite and rejects foreign origins", async (t) => {
		const bootstrap = await request("/api/connect", { headers: { origin } });
		assert.equal(bootstrap.status, 200);
		assert.deepEqual(await bootstrap.json(), { success: true });
		const handshakePath = "/api/socket?EIO=4&transport=polling";
		const handshake = await request(handshakePath, { headers: { origin } });
		assert.equal(handshake.status, 200);
		const packet = await handshake.text();
		assert.equal(packet[0], "0");
		const { sid } = JSON.parse(packet.slice(1));
		assert.equal(typeof sid, "string");
		const sessionPath = `${handshakePath}&sid=${encodeURIComponent(sid)}`;
		t.after(async () => {
			const close = await request(sessionPath, { method: "POST", body: "1", headers: { origin, "content-type": "text/plain;charset=UTF-8" } });
			await close.arrayBuffer();
		});
		const connected = await request(sessionPath, { method: "POST", body: "40", headers: { origin, "content-type": "text/plain;charset=UTF-8" } });
		assert.equal(connected.status, 200);
		assert.equal(await connected.text(), "ok");
		const foreign = await request(handshakePath, { headers: { origin: "https://attacker.example" } });
		assert.equal(foreign.status, 403);
		await foreign.arrayBuffer();
	});

	test("Socket.IO WebSocket transport connects through the same-origin rewrite", async () => {
		const bootstrap = await request("/api/connect", { headers: { origin } });
		assert.equal(bootstrap.status, 200);
		await bootstrap.arrayBuffer();
		const socket = io(origin, {
			path: "/api/socket", addTrailingSlash: false, transports: ["websocket"],
			reconnection: false, timeout: 5_000, extraHeaders: { Origin: origin },
		});
		try {
			await new Promise((resolve, reject) => {
				socket.once("connect", resolve);
				socket.once("connect_error", reject);
			});
			assert.equal(socket.connected, true);
		} finally {
			socket.removeAllListeners();
			socket.disconnect();
		}
	});
});
