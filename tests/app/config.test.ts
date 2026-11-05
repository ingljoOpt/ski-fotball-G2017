import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { localConfig } from "../../src/lib/config.ts";
import { emailSchema, safeReturnPath, settingsSchema, trainingTimeSchema } from "../../src/lib/validation.ts";

const local = {
  APP_ENV: "local", AUTH_MODE: "local", NODE_ENV: "development",
  PGLITE_DATA_DIR: ".local/test-config",
  APP_URL: "http://localhost:3000",
};

test("local config accepts only explicit local development", () => {
  assert.equal(localConfig(local).appUrl, "http://localhost:3000");
  assert.equal(localConfig(local).dataDirectory, resolve(".local/test-config"));
  assert.equal(localConfig({ ...local, PGLITE_DATA_DIR: undefined }).dataDirectory, resolve(".local/pglite"));
  for (const override of [
    { NODE_ENV: "production" }, { NODE_ENV: "test" }, { APP_ENV: "production" },
    { AUTH_MODE: "neon" }, { VERCEL: "1" }, { CI: "true" },
    { PGLITE_DATA_DIR: "https://remote.example/db" }, { PGLITE_DATA_DIR: "" },
    { APP_URL: "https://remote.example" }, { APP_URL: "http://localhost:3000/path" },
  ]) assert.throws(() => localConfig({ ...local, ...override }));
});

test("only invitation return paths can redirect after login", () => {
  const path = `/invitasjon/${"a".repeat(64)}`;
  assert.equal(safeReturnPath(path), path);
  const clubPath = `/klubbinvitasjon/${"b".repeat(64)}`;
  assert.equal(safeReturnPath(clubPath), clubPath);
  for (const input of ["https://evil.example", "//evil.example", "/\\evil.example", undefined, "/invitasjon/not-a-token"]) {
    assert.equal(safeReturnPath(input), "/oversikt");
  }
});

test("email, duration, lead time and weekdays are validated", () => {
  assert.equal(emailSchema.parse("COACH@EXAMPLE.INVALID"), "coach@example.invalid");
  assert.deepEqual(settingsSchema.parse({ durationMinutes: "60", generationDaysBefore: "0" }), {
    durationMinutes: 60, generationDaysBefore: 0,
  });
  assert.equal(settingsSchema.safeParse({ durationMinutes: 0, generationDaysBefore: 31 }).success, false);
  assert.equal(trainingTimeSchema.safeParse({ weekday: 0, startTime: "25:00" }).success, false);
  assert.deepEqual(trainingTimeSchema.parse({ weekday: "3", startTime: "18:00" }), { weekday: 3, startTime: "18:00" });
});
