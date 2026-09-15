import assert from "node:assert/strict";
import test from "node:test";
import { assertSameOrigin, chatRequestSchema, clientRateLimitKey, isAllowedOrigin, modelQuota, RateLimiter, readJsonBody } from "./server-security.ts";

const jsonRequest = (body, headers = {}) => new Request("https://chat.example/api/chat", {
	method: "POST", body, headers: { "content-type": "application/json", ...headers },
});

test("reject oversized bodies even when the client omits or understates Content-Length", async () => {
	for (const headers of [{}, { "content-length": "1" }]) {
		await assert.rejects(readJsonBody(jsonRequest(JSON.stringify({ content: "x".repeat(100) }), headers), 32), { status: 413 });
	}
});

test("bound streamed body bytes and cancel the reader when the limit is crossed", async () => {
	let cancelled = false;
	const stream = new ReadableStream({
		pull(controller) { controller.enqueue(new TextEncoder().encode("0123456789")); },
		cancel() { cancelled = true; },
	});
	const request = new Request("https://chat.example/api/chat", { method: "POST", body: stream, duplex: "half", headers: { "content-type": "application/json" } });
	await assert.rejects(readJsonBody(request, 15), { status: 413 });
	assert.equal(cancelled, true);
});

test("malformed JSON and non-JSON browser form submissions receive client errors", async () => {
	await assert.rejects(readJsonBody(jsonRequest("{")), { status: 400 });
	await assert.rejects(readJsonBody(jsonRequest("{}", { "content-type": "text/plain" })), { status: 415 });
	assert.deepEqual(await readJsonBody(jsonRequest('{"content":"hello"}')), { content: "hello" });
});

test("generation bounds reject expensive or malformed requests while retaining UI settings", () => {
	const valid = { messages: [{ role: "user", content: "Hello", id: "local-id", timestamp: 123 }], settings: { model: "cosmosrp", temperature: 0.7, max_tokens: 4000, streaming: true, italicColor: "#fff" } };
	assert.equal(chatRequestSchema.safeParse(valid).success, true);
	assert.equal(chatRequestSchema.safeParse({ ...valid, settings: { ...valid.settings, max_tokens: 1_000_000 } }).success, false);
	assert.equal(chatRequestSchema.safeParse({ ...valid, settings: { ...valid.settings, temperature: -1 } }).success, false);
	assert.equal(chatRequestSchema.safeParse({ ...valid, messages: [{ role: "tool", content: "hello" }] }).success, false);
	assert.equal(chatRequestSchema.safeParse({ ...valid, messages: [{ role: "user", content: "hello", image: "file:///etc/passwd" }] }).success, false);
	assert.equal(chatRequestSchema.safeParse({ ...valid, messages: Array.from({ length: 501 }, () => ({ role: "user", content: "hello" })) }).success, false);
	assert.equal(chatRequestSchema.parse({ messages: [{ role: "user", content: "Hello" }] }).settings.max_tokens, 1000);
});

test("IP headers never establish a new rate-limit identity without explicit proxy trust", () => {
	const first = new Headers({ "cf-connecting-ip": "203.0.113.1", "x-forwarded-for": "203.0.113.2" });
	const second = new Headers({ "cf-connecting-ip": "203.0.113.3", "x-forwarded-for": "203.0.113.4" });
	assert.equal(clientRateLimitKey(first, ""), "shared");
	assert.equal(clientRateLimitKey(second, ""), "shared");
	assert.equal(clientRateLimitKey(first, "cf-connecting-ip"), "ip:203.0.113.1");
	assert.equal(clientRateLimitKey(new Headers({ "x-forwarded-for": "203.0.113.2, 203.0.113.3" }), "x-forwarded-for"), "shared");
	assert.equal(clientRateLimitKey(new Headers({ "x-real-ip": "attacker" }), "x-real-ip"), "shared");
	assert.equal(clientRateLimitKey(new Headers({ "x-real-ip": "2001:db8::1" }), "x-real-ip"), clientRateLimitKey(new Headers({ "x-real-ip": "2001:0db8:0:0:0:0:0:1" }), "x-real-ip"));
});

test("varying arbitrary model names cannot reset the daily quota", () => {
	const limiter = new RateLimiter();
	const { limit } = modelQuota("cosmosrp");
	for (let i = 0; i < limit; i++) {
		assert.equal(limiter.consume(`client:${modelQuota(`cosmosrp-${i}`).bucket}`, limit, 86_400_000, 1).allowed, true);
	}
	assert.equal(limiter.consume(`client:${modelQuota("cosmosrp-new-name").bucket}`, limit, 86_400_000, 1).allowed, false);
});

test("rate-limit storage fails closed at capacity and expired entries are reclaimed", () => {
	const limiter = new RateLimiter(2);
	assert.equal(limiter.consume("a", 1, 60_000, 0).allowed, true);
	assert.equal(limiter.consume("b", 1, 60_000, 0).allowed, true);
	assert.equal(limiter.consume("c", 1, 60_000, 0).allowed, false);
	assert.equal(limiter.consume("a", 1, 60_000, 0).allowed, false);
	assert.equal(limiter.consume("c", 1, 60_000, 60_001).allowed, true);
});

test("cross-origin requests are rejected and configured origins are compared exactly", () => {
	assert.equal(isAllowedOrigin("https://evil.example", "chat.example", ""), false);
	assert.equal(isAllowedOrigin("null", "chat.example", ""), false);
	assert.equal(isAllowedOrigin("https://chat.example", "chat.example", ""), true);
	assert.equal(isAllowedOrigin("http://chat.example", "chat.example", "https://chat.example"), false);
	assert.equal(isAllowedOrigin("https://chat.example.evil.example", "chat.example", "https://chat.example"), false);
	assert.throws(() => assertSameOrigin(jsonRequest("{}", { origin: "https://evil.example", host: "chat.example" })), { status: 403 });
	assert.throws(() => assertSameOrigin(jsonRequest("{}", { "sec-fetch-site": "cross-site", host: "chat.example" })), { status: 403 });
});
