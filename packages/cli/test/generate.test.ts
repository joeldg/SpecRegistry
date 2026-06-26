import assert from "node:assert/strict";
import test from "node:test";
import { exampleTemplateFilename, renderExampleTemplate } from "../src/generate.js";

test("example template filenames stay outside generated spec filenames", () => {
  assert.equal(exampleTemplateFilename("DESIGN.md"), "DESIGN.examples.md");
  assert.equal(exampleTemplateFilename("SECURITY_PRIVACY.md"), "SECURITY_PRIVACY.examples.md");
});

test("example templates include source evidence and SDD review guidance", () => {
  const markdown = renderExampleTemplate({
    filename: "API.md",
    projectType: "Web App Standard",
    languages: ["TypeScript", "SQL"],
    tree: "src/server.ts\nsrc/routes/users.ts\ntest/users.test.ts\n",
  });

  assert.match(markdown, /^# API\.md Example Template/m);
  assert.match(markdown, /Project type: Web App Standard/);
  assert.match(markdown, /Detected languages: TypeScript, SQL/);
  assert.match(markdown, /`src\/routes\/users\.ts`/);
  assert.match(markdown, /## Positive Examples/);
  assert.match(markdown, /## Negative Examples/);
  assert.match(markdown, /Which examples should be promoted into the governed spec/);
});
