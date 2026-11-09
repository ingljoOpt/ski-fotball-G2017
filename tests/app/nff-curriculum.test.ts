import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MockLanguageModelV4 } from "ai/test";
import { crawlNffCurriculum, getNffCurriculum, refreshNffCurriculum, relevantCurriculum, type Curriculum } from "../../src/lib/nff-curriculum.ts";
import { nffStartUrl, readNffHtml, validateNffOutput } from "../../src/lib/nff-curriculum-agent.ts";

const index = `<main><a href="/artikkel/fagplan-8-9-ar">Fagplan 8-9 år</a><a href="/artikkel/fagplan-10-12-ar">Fagplan 10-12 år</a><a href="https://evil.invalid/artikkel/fagplan-8-9-ar">Fagplan 8-9 år</a><a href="https://user:pass@tiim.no/artikkel/fagplan-8-9-ar">Fagplan 8-9 år</a></main>`;
const article = `<main><h1>Fagplan 8-9 år</h1><h2>Spille fremover</h2><h3>Pasning</h3><section hidden><li>Se opp.</li></section><a href="/artikkel/laeringsmoment">Flere læringsmomenter</a></main>`;

test("agent reader exposes hidden text and only safe NFF links, without interpreting the theme hierarchy", () => {
  const page = readNffHtml(`<main><h1>Fagplan 8-9 år</h1><section hidden><p>Se opp &amp; velg rom.</p></section><a href="/artikkel/pasning">Pasning</a><a href="https://evil.invalid/">Utenfor NFF</a><a href="https://user:pass@tiim.no/">Passord</a></main>`, "https://tiim.no/artikkel/fagplan-8-9-ar");
  assert.match(page.text, /Se opp & velg rom/);
  assert.equal(page.links.length, 1);
  assert.equal(page.links[0].url, "https://tiim.no/artikkel/pasning");
});

test("agent output requires read source evidence, matching age and explicit versus inferred skill links", () => {
  const url = "https://tiim.no/artikkel/fagplan-8-9-ar";
  const page = readNffHtml(`<main><h1>Fagplan 8-9 år</h1><h2>Spille fremover</h2><h3>Pasning</h3><li>Se opp.</li></main>`, url);
  const proof = (sitat: string) => ({ kildeUrl: url, sitat });
  const output = { aldersklasse: { fra: 8, til: 9, ...proof("Fagplan 8-9 år") },
    hovedtemaer: [{ navn: "Spille fremover", ...proof("Spille fremover"), laeringsmomenter: [], delferdigheter: [{ navn: "Pasning", kobling: "tolkning", ...proof("Pasning") }] }],
    delferdigheter: [{ navn: "Pasning", ...proof("Pasning"), laeringsmomenter: [{ tekst: "Orienter deg før pasningen.", ...proof("Se opp.") }] }], merknader: [] };
  const pages = new Map([[url, page]]);
  assert.equal(validateNffOutput(output, 9, pages).hovedtemaer[0].navn, "Spille fremover");
  assert.throws(() => validateNffOutput(output, 10, pages), /aldersklasse/);
  assert.throws(() => validateNffOutput(output, 9, new Map()), /kildebelegg/);
  const invented = structuredClone(output);
  invented.delferdigheter[0].laeringsmomenter[0].sitat = "Oppdiktet kildebelegg";
  assert.throws(() => validateNffOutput(invented, 9, pages), /kildebelegg/);
  const link = structuredClone(output);
  link.hovedtemaer[0].delferdigheter[0].kobling = "eksplisitt";
  const sanitized = validateNffOutput(link, 9, pages);
  assert.equal(sanitized.hovedtemaer[0].delferdigheter[0].kobling, "tolkning");
  assert.match(sanitized.merknader[0], /må vurderes av trener/);
  assert.throws(() => validateNffOutput(output, 9, new Map([[url, { ...page, title: "Fagplan 10-12 år" }]])), /annen aldersklasse/);
  const inventedName = structuredClone(output);
  inventedName.hovedtemaer[0].navn = "Oppdiktet hovedtema";
  assert.throws(() => validateNffOutput(inventedName, 9, pages), /navn mangler/);
});

test("bundled seed starts offline; explicit refresh persists by age class and failed refresh preserves the last good JSON", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nff-curriculum-"));
  try {
    const seed = await getNffCurriculum(9, directory);
    assert.equal(seed.topics.length, 4);
    assert.equal(seed.structured?.delferdigheter.length, 9);
    assert.equal(seed.fetchedAt, "2026-11-08");
    assert.equal((await getNffCurriculum(10, directory)).topics.length, 0);
    assert.deepEqual(await readdir(directory), [], "reading does not write files or call the agent");
    let calls = 0;
    const fresh: Curriculum = { ...seed, structured: structuredClone(seed.structured!), fetchedAt: "2026-11-09T12:00:00Z" };
    fresh.structured!.delferdigheter[0].laeringsmomenter[0].tekst = "Nytt kildevalidert testmoment.";
    const reader = async () => { calls++; return fresh; };
    await Promise.all([refreshNffCurriculum(9, reader, directory), refreshNffCurriculum(9, reader, directory)]);
    assert.equal(calls, 1, "simultaneous refresh calls share one agent invocation");
    const filename = join(directory, "8-9.json");
    const stored = await readFile(filename, "utf8");
    assert.deepEqual(JSON.parse(stored).structured, fresh.structured);
    assert.equal((await getNffCurriculum(8, directory)).fetchedAt, fresh.fetchedAt, "refresh updates the entire age class");
    await assert.rejects(refreshNffCurriculum(9, async () => { throw new Error("NFF er nede"); }, directory), /NFF er nede/);
    assert.equal(await readFile(filename, "utf8"), stored);
    assert.equal((await getNffCurriculum(9, directory)).fetchedAt, fresh.fetchedAt);
    await assert.rejects(refreshNffCurriculum(9, async () => ({ ...fresh, structured: undefined }), directory));
    await assert.rejects(refreshNffCurriculum(10, reader, directory), /annen aldersklasse/);
    assert.equal(await readFile(filename, "utf8"), stored);
    assert.deepEqual(await readdir(directory), ["8-9.json"], "no temporary files remain");
    const restartedDirectory = await mkdtemp(join(tmpdir(), "nff-reopened-"));
    try {
      await writeFile(join(restartedDirectory, "8-9.json"), stored);
      const reopened = await getNffCurriculum(9, restartedDirectory);
      assert.equal(reopened.fetchedAt, fresh.fetchedAt);
      assert.deepEqual(reopened.structured, fresh.structured, "disk data survives an empty memory cache");
    } finally { await rm(restartedDirectory, { recursive: true }); }
    const failedDirectory = await mkdtemp(join(tmpdir(), "nff-save-failed-"));
    try {
      const previous = await getNffCurriculum(9, failedDirectory);
      await mkdir(join(failedDirectory, "8-9.json"));
      await assert.rejects(refreshNffCurriculum(9, reader, failedDirectory));
      assert.deepEqual(await getNffCurriculum(9, failedDirectory), previous, "failed disk writes never replace the memory snapshot");
      assert.deepEqual(await readdir(failedDirectory), ["8-9.json"], "failed saves clean only their own temporary file");
    } finally { await rm(failedDirectory, { recursive: true }); }
  } finally { await rm(directory, { recursive: true }); }
});

test("AI agent reads the directory, follows article links and returns the validated structured curriculum", async () => {
  const requests: string[] = [];
  const fetcher: typeof fetch = async (url, options) => {
    requests.push(String(url));
    assert.equal(options?.redirect, "error");
    return new Response(String(url).endsWith("robots.txt") ? "User-agent: *\nAllow: /" : String(url).includes("/tema/") ? index : article,
      { headers: { "content-type": "text/html" } });
  };
  const source = "https://tiim.no/artikkel/fagplan-8-9-ar";
  const detail = "https://tiim.no/artikkel/laeringsmoment";
  const proof = (sitat: string, kildeUrl = source) => ({ sitat, kildeUrl });
  const output = { aldersklasse: { fra: 8, til: 9, ...proof("Fagplan 8-9 år") },
    hovedtemaer: [{ navn: "Spille fremover", ...proof("Spille fremover"), laeringsmomenter: [], delferdigheter: [{ navn: "Pasning", kobling: "tolkning", ...proof("Pasning") }] }],
    delferdigheter: [{ navn: "Pasning", ...proof("Pasning"), laeringsmomenter: [{ tekst: "Orienter deg før pasningen.", ...proof("Se opp.", detail) }] }], merknader: [] };
  const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 0 } };
  const calls = [nffStartUrl, source, detail].map((url, index) => ({ content: [{ type: "tool-call" as const, toolCallId: `read-${index}`, toolName: "readNffPage", input: JSON.stringify({ url }) }], finishReason: { unified: "tool-calls" as const, raw: "tool-calls" }, usage, warnings: [] }));
  const model = new MockLanguageModelV4({ doGenerate: [...calls, { content: [{ type: "text", text: JSON.stringify(output) }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] }] });
  const result = await crawlNffCurriculum(9, fetcher, model);
  assert.equal(result.topics.length, 1);
  assert.equal(result.topics[0].theme, "Spille fremover");
  assert.equal(result.topics[0].skills[0].title, "Pasning");
  assert.equal(result.topics[0].skills[0].relationship, "tolkning");
  assert.deepEqual(result.structured, output);
  assert.ok(requests.includes(detail), "agent follows links beyond the directory");
  assert.equal(requests.length, 4);
  assert.ok(result.fetchedAt);
  assert.equal(model.doGenerateCalls.length, 4);
  assert.deepEqual(model.doGenerateCalls[1].toolChoice, { type: "tool", toolName: "readNffPage" }, "directory-only reads cannot finish the agent");
  assert.match(JSON.stringify(model.doGenerateCalls[1].prompt), /fagplan-8-9-ar/);
  assert.equal(relevantCurriculum(result, ["Pasning"]).topics[0].theme, "Spille fremover");
  assert.ok(!("structured" in relevantCurriculum(result, ["Pasning"])), "the session agent never receives an unbounded duplicate of the source document");
});