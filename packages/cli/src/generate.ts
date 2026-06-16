import fs from "node:fs";
import path from "node:path";
import type { StubPromptResponse } from "@specregistry/shared";
import { fetchJson, selectProjectType } from "./registry.js";
import { scanDirectory } from "./scan.js";

export interface GenerateOptions {
  server: string;
  token?: string;
  type?: string;
  out: string;
  dir: string;
  write: boolean;
  force: boolean;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
}

async function generateMarkdown(prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("--write requires ANTHROPIC_API_KEY in the environment");
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.SPECREG_GENERATE_MODEL ?? "claude-opus-4-8",
      max_tokens: 12000,
      system:
        "You generate complete Markdown specification documents. Output only the Markdown document, with no preamble and no code fence around the response.",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic generation failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as AnthropicResponse;
  const markdown =
    body.content
      ?.filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("")
      .trim() ?? "";
  if (!markdown) throw new Error("Anthropic generation returned no Markdown content");
  return markdown;
}

export async function runGenerate(opts: GenerateOptions): Promise<void> {
  const root = process.cwd();
  console.log(`Scanning ${root} ...`);
  const scan = scanDirectory(root);
  console.log(
    `Found ${scan.fileCount} files. Detected languages: ${scan.languages.join(", ") || "(none)"}`
  );

  const projectType = await selectProjectType(opts.server, opts.type, opts.token);
  const response = await fetchJson<StubPromptResponse>(`${opts.server}/api/v1/cli/stub-prompts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_type: projectType.name,
      detected_languages: scan.languages,
    }),
  }, opts.token);

  const outDir = path.resolve(root, opts.out);
  fs.mkdirSync(outDir, { recursive: true });
  const specDir = path.resolve(root, opts.dir);
  if (opts.write) fs.mkdirSync(specDir, { recursive: true });

  const written: string[] = [];
  const generated: string[] = [];
  for (const stub of response.prompts) {
    // The server tailors [PROJECT_TYPE]/[LANGUAGES]; the local scan fills [TREE]/[CONTEXT].
    const prompt = stub.prompt.replaceAll("[TREE]", scan.tree).replaceAll("[CONTEXT]", scan.tree);
    const file = path.join(outDir, `${stub.target_filename}.prompt.txt`);
    fs.writeFileSync(file, prompt, "utf8");
    written.push(file);

    if (opts.write) {
      const target = path.join(specDir, stub.target_filename);
      if (fs.existsSync(target) && !opts.force) {
        throw new Error(`${path.relative(root, target)} already exists. Re-run with --force to overwrite it.`);
      }
      console.log(`Generating ${path.relative(root, target)} ...`);
      fs.writeFileSync(target, await generateMarkdown(prompt), "utf8");
      generated.push(target);
    }
  }

  console.log(`\nWrote ${written.length} generation prompt(s):`);
  for (const file of written) {
    console.log(`  - ${path.relative(root, file)}`);
  }
  if (generated.length > 0) {
    console.log(`\nGenerated ${generated.length} spec file(s):`);
    for (const file of generated) {
      console.log(`  - ${path.relative(root, file)}`);
    }
    console.log("\nReview the generated markdown, then create or submit the specs through the registry workflow.");
  } else {
    console.log(
      `\nNext step: run each prompt through your AI agent to produce the corresponding spec file,\nor re-run with --write and ANTHROPIC_API_KEY to generate files directly.`
    );
  }
}
