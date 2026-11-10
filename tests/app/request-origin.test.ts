import { test } from "node:test";
import assert from "node:assert/strict";
import { isSameOrigin } from "../../src/lib/request-origin.ts";

test("origin follows the external host and protocol without allowing cross-site requests", () => {
  const check = (headers: Record<string, string>) => isSameOrigin(new Request("http://localhost:3018/api/session-chat", { headers }));
  assert.equal(check({ host: "127.0.0.1:3018", origin: "http://127.0.0.1:3018" }), true);
  assert.equal(check({ host: "internal:3000", "x-forwarded-host": "app.example.com", "x-forwarded-proto": "https", origin: "https://app.example.com" }), true);
  assert.equal(check({ host: "127.0.0.1:3018", origin: "http://attacker.example" }), false);
  assert.equal(check({ host: "internal:3000", "x-forwarded-host": "app.example.com", "x-forwarded-proto": "https", origin: "http://app.example.com" }), false);
  assert.equal(check({ host: "127.0.0.1:3018" }), false);
  assert.equal(check({ origin: "http://localhost:3018" }), false);
  assert.equal(check({ host: "app.example.com", "x-forwarded-proto": "javascript", origin: "javascript://app.example.com" }), false);
});