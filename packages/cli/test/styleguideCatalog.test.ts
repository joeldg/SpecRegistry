import assert from "node:assert/strict";
import test from "node:test";
import { GOOGLE_STYLE_GUIDES as shared } from "@specregistry/shared";
import { GOOGLE_STYLE_GUIDES as vendored, type StyleGuideEntry } from "../src/styleguideCatalog.js";

// The CLI vendors a copy of the styleguide catalog (so the published binary has no
// @specregistry/shared runtime dep). This guard fails the build if the two drift —
// otherwise the server's resolve-guidance could advertise a guide `specreg styleguide
// add` can't pull. Keep both copies in sync.
const normalize = (entries: StyleGuideEntry[]) =>
  entries.map((g) => ({
    id: g.id,
    title: g.title,
    filename: g.filename,
    languages: g.languages,
    sources: g.sources.map((s) => ({ title: s.title, url: s.url })),
  }));

test("vendored CLI styleguide catalog matches @specregistry/shared", () => {
  assert.deepEqual(normalize(vendored), normalize(shared as StyleGuideEntry[]));
});
