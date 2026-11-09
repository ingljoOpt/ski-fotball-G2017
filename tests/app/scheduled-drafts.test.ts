import { test } from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { cronAuthorized, isOsloCronHour } from "../../src/lib/scheduled-drafts.ts";

test("Vercel has one daily schedule at 06 in Oslo using the secured GET route", async () => {
  const config = JSON.parse(await readFile(new URL("../../vercel.json", import.meta.url), "utf8"));
  assert.equal(config.crons, undefined);
  assert.deepEqual(config.schedules, { "make-plan": { schedule: "0 6 * * *", timezone: "Europe/Oslo",
    path: "/api/cron/make-plan", requestMethod: "GET" } });
  await access(new URL("../../src/app/api/cron/make-plan/route.ts", import.meta.url));
});

test("cron requires the production Vercel environment and the exact secret", () => {
  const env = { VERCEL: "1", VERCEL_ENV: "production", NODE_ENV: "production", CRON_SECRET: "fiktiv-hemmelighet" };
  const request = new Request("https://example.invalid/api/cron", { headers: { authorization: "Bearer fiktiv-hemmelighet" } });
  assert.equal(cronAuthorized(request, env), true);
  assert.equal(cronAuthorized(request, { ...env, VERCEL_ENV: "preview" }), false);
  assert.equal(cronAuthorized(request, { ...env, VERCEL: undefined }), false);
  assert.equal(cronAuthorized(request, { ...env, CRON_SECRET: "" }), false);
  assert.equal(cronAuthorized(request, { ...env, CRON_SECRET: "kort" }), false);
  assert.equal(cronAuthorized(new Request(request.url, { headers: { authorization: "Bearer feil" } }), env), false);
});

test("cron uses 06 in Oslo in both winter and summer", () => {
  assert.equal(isOsloCronHour(new Date("2026-01-15T05:00:00Z")), true);
  assert.equal(isOsloCronHour(new Date("2026-01-15T04:00:00Z")), false);
  assert.equal(isOsloCronHour(new Date("2026-07-15T04:00:00Z")), true);
  assert.equal(isOsloCronHour(new Date("2026-07-15T05:00:00Z")), false);
  assert.equal(isOsloCronHour(new Date("2026-03-29T04:00:00Z")), true);
  assert.equal(isOsloCronHour(new Date("2026-10-25T05:00:00Z")), true);
});