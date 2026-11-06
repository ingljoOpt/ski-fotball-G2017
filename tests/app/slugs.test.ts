import { test } from "node:test";
import assert from "node:assert/strict";
import { clubUrl, slugBase, slugSchema, teamUrl } from "../../src/lib/slugs.ts";
import { withSearch } from "../../src/lib/tenant-routing.ts";

test("slugs normalize Norwegian names, punctuation, empty names and length", () => {
  assert.equal(slugBase(" Ski IL Fotball ", "club"), "ski-il-fotball");
  assert.equal(slugBase("G2017", "team"), "g2017");
  assert.equal(slugBase("Æ Ø Å / &", "club"), "ae-o-a");
  assert.equal(slugBase("!!!", "club"), "klubb");
  assert.equal(slugBase("!!!", "team"), "lag");
  assert.equal(slugBase("a".repeat(79) + " b", "club"), "a".repeat(79));
  assert.equal(slugBase("a".repeat(100), "team").length, 80);
  for (const value of ["../auth", "", "FOO", "-foo", "foo-", "foo--bar", "foo/bar", "a".repeat(121)]) {
    assert.equal(slugSchema.safeParse(value).success, false, value);
  }
  assert.equal(teamUrl({ slug: "ski-il-fotball" }, { slug: "g2017" }), "/ski-il-fotball/g2017");
  assert.equal(clubUrl({ slug: "ski-il-fotball" }), "/ski-il-fotball");
});

test("legacy query strings preserve errors, selected years and repeated values safely", () => {
  assert.equal(withSearch("/club/team/aarsplan", { year: "2026", feil: "Prøv på nytt", tag: ["a", "b"], unused: undefined }),
    "/club/team/aarsplan?year=2026&feil=Pr%C3%B8v+p%C3%A5+nytt&tag=a&tag=b");
});
