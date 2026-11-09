import { test } from "node:test";
import assert from "node:assert/strict";
import { MockLanguageModelV4 } from "ai/test";
import { collectTiimExercises, readTiimCatalogue, readTiimExercise, tiimExercisesUrl } from "../../src/lib/tiim-exercise-agent.ts";

const catalogue = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { allSessionsAndDrills: [
  { _type: "drill", title: "Pasning i trekanter", slug: { current: "pasning" }, level: [{ name: "8-9 år" }], topic: [{ name: "Spille fremover" }] },
  { _type: "drill", title: "Eldre spillere", slug: { current: "eldre" }, level: [{ name: "10-12 år" }], topic: [] },
  { _type: "session", title: "Økt", slug: { current: "okt" }, level: [{ name: "8-9 år" }] },
  { _type: "drill", title: "Ugyldig lenke", slug: { current: "../privat" }, level: [{ name: "8-9 år" }] },
] } } })}</script>`;
const exercise = `<main><h1>Pasningsøvelse</h1><dl><div><dt>Tema</dt><dd>Spille fremover</dd></div><div><dt>Alder</dt><dd>8-9 år</dd></div></dl><section><h2>Læringsmomenter</h2><p>Se opp før pasningen.</p></section></main>`;
const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 0 } };

test("Tiim exercise must have a safe URL and an explicit matching age on its own page", () => {
  const html = exercise;
  const url = "https://tiim.no/ovelse/pasning";
  assert.equal(readTiimExercise(html, url, 9).sourceAge, "8-9 år");
  assert.equal(readTiimExercise(html, url, 9).theme, "Spille fremover");
  const multiple = html.replace("<dd>8-9 år</dd>", "<dd><ul><li>10-12 år</li><li>8-9 år</li></ul></dd>");
  assert.equal(readTiimExercise(multiple, url, 9).sourceAge, "8-9 år");
  assert.equal(readTiimExercise(multiple, url, 11).sourceAge, "10-12 år");
  assert.throws(() => readTiimExercise(html, url, 10), /aldersmerking/);
  assert.throws(() => readTiimExercise(html.replace("8-9 år", ""), url, 9), /aldersmerking/);
  assert.throws(() => readTiimExercise(html, "https://tiim.no.evil.invalid/ovelse/pasning", 9), /lenke/);
});

test("catalogue filters exercises by explicit age and safely ranks the requested focus", () => {
  assert.deepEqual(readTiimCatalogue(catalogue, 9, "Pasning og spille fremover"), [
    { url: "https://tiim.no/ovelse/pasning", title: "Pasning i trekanter", themes: ["Spille fremover"] },
  ]);
  assert.deepEqual(readTiimCatalogue(catalogue, 10, "Pasning").map((item) => item.title), ["Eldre spillere"]);
});

test("subagent reads candidate pages and rejects invented sources", async () => {
  const url = "https://tiim.no/ovelse/pasning";
  const requests: string[] = [];
  const fetcher: typeof fetch = async (input, options) => {
    requests.push(String(input));
    assert.equal(options?.redirect, "error");
    return new Response(String(input).endsWith("robots.txt") ? "User-agent: *\nAllow: /" : String(input) === tiimExercisesUrl ? catalogue : exercise,
      { headers: { "content-type": "text/html" } });
  };
  const model = (selected: string) => new MockLanguageModelV4({ doGenerate: [
    { content: [{ type: "tool-call", toolCallId: "read-1", toolName: "readExercise", input: JSON.stringify({ url }) }], finishReason: { unified: "tool-calls", raw: "tool-calls" }, usage, warnings: [] },
    { content: [{ type: "text", text: JSON.stringify({ exercises: [{ url: selected, relevance: "Pasning og orientering", summary: "Tre spillere øver på pasninger." }], warnings: [] }) }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] },
  ] });
  const result = await collectTiimExercises(9, "Spille fremover", "Pasning", model(url), fetcher);
  assert.equal(result.exercises[0].sourceUrl, url);
  assert.equal(result.exercises[0].sourceAge, "8-9 år");
  assert.match(result.exercises[0].sourceCheckedOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(requests, ["https://tiim.no/robots.txt", tiimExercisesUrl, url]);
  await assert.rejects(collectTiimExercises(9, "Pasning", "", model("https://tiim.no/ovelse/oppdiktet"), fetcher), /uten kontrollert kilde/);
  await assert.rejects(collectTiimExercises(9, "Pasning", "", model(url), async () => new Response("User-agent: *\nDisallow: /", { headers: { "content-type": "text/plain" } })), /robots/);
});