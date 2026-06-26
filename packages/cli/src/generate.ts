import fs from "node:fs";
import path from "node:path";
import type { StubPromptResponse } from "@specregistry/shared";
import { fetchJson, selectProjectType } from "./registry.js";
import type { Manifest } from "./repo.js";
import { scanDirectory } from "./scan.js";

export interface GenerateOptions {
  server: string;
  token?: string;
  type?: string;
  out: string;
  dir: string;
  exampleDir: string;
  examples: boolean;
  write: boolean;
  force: boolean;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

type GenerateProvider = "anthropic" | "openai" | "gemini" | "openai_compatible";

interface GenerateLlmConfig {
  provider: GenerateProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  maxTokens: number;
}

const SYSTEM_PROMPT =
  "You generate complete Markdown specification documents. Output only the Markdown document, with no preamble and no code fence around the response.";

export function exampleTemplateFilename(specFilename: string): string {
  const parsed = path.parse(specFilename);
  return `${parsed.name}.examples.md`;
}

export function renderExampleTemplate(input: {
  filename: string;
  projectType: string;
  languages: string[];
  tree: string;
}): string {
  const languages = input.languages.length > 0 ? input.languages.join(", ") : "unknown";
  const notablePaths = input.tree
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.endsWith("/"))
    .slice(0, 12);
  const pathHints = notablePaths.length > 0
    ? notablePaths.map((item) => `- \`${item.replace(/^[-\s]+/, "")}\``).join("\n")
    : "- `<path/to/source>`";
  return `# ${input.filename} Example Template

> Companion examples for a generated \`${input.filename}\` draft.
> Keep this file outside governed \`specs/\` content unless reviewers decide these examples should become part of the spec.

## Scope

- Project type: ${input.projectType}
- Detected languages: ${languages}
- Draft spec: \`${input.filename}\`

## Source Evidence To Check

${pathHints}

## Positive Examples

Add examples of implementation choices that should satisfy \`${input.filename}\`.

### Example: <name>

- Context: <where this appears in the codebase>
- Input or situation: <trigger, request, config, or code path>
- Expected behavior: <observable result>
- Relevant files: <paths>

\`\`\`
<minimal good example>
\`\`\`

## Negative Examples

Add examples that should be rejected, flagged in review, or treated as spec violations.

### Anti-example: <name>

- Context: <where this could happen>
- Problem: <why this conflicts with the spec>
- Expected agent response: <what an implementation/review agent should do>

\`\`\`
<minimal bad example>
\`\`\`

## Edge Cases

- <boundary condition>
- <error path>
- <migration or compatibility case>

## Review Notes

- Which examples should be promoted into the governed spec?
- Which examples should stay as local training/reference material?
- What tests or audit prompts should cite these examples?
`;
}

function normalizeProvider(value: string | undefined): GenerateProvider | undefined {
  if (value === "anthropic" || value === "openai" || value === "gemini" || value === "openai_compatible") return value;
  return undefined;
}

function inferProvider(): GenerateProvider {
  const configured = normalizeProvider(process.env.SPECREG_GENERATE_PROVIDER || process.env.LLM_PROVIDER);
  if (configured) return configured;
  if (process.env.SPECREG_GENERATE_BASE_URL || process.env.LLM_BASE_URL) return "openai_compatible";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
  return "anthropic";
}

function providerApiKey(provider: GenerateProvider): string {
  return (
    process.env.SPECREG_GENERATE_API_KEY ||
    process.env.LLM_API_KEY ||
    (provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : provider === "openai"
        ? process.env.OPENAI_API_KEY
        : provider === "gemini"
          ? process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
          : "") ||
    ""
  );
}

function defaultModel(provider: GenerateProvider): string {
  if (provider === "anthropic") return "claude-opus-4-8";
  if (provider === "openai") return "gpt-4.1";
  if (provider === "gemini") return "gemini-3.5-flash";
  return "llama3.1";
}

function defaultBaseUrl(provider: GenerateProvider): string {
  if (provider === "anthropic") return "https://api.anthropic.com";
  if (provider === "openai") return "https://api.openai.com/v1";
  if (provider === "gemini") return "https://generativelanguage.googleapis.com/v1beta";
  return "";
}

function generateConfig(): GenerateLlmConfig {
  const provider = inferProvider();
  return {
    provider,
    model:
      process.env.SPECREG_GENERATE_MODEL ||
      process.env.LLM_MODEL ||
      (provider === "anthropic"
        ? process.env.ANTHROPIC_MODEL
        : provider === "openai"
          ? process.env.OPENAI_MODEL
          : provider === "gemini"
            ? process.env.GEMINI_MODEL
            : undefined) ||
      defaultModel(provider),
    baseUrl: (process.env.SPECREG_GENERATE_BASE_URL || process.env.LLM_BASE_URL || defaultBaseUrl(provider)).replace(/\/+$/, ""),
    apiKey: providerApiKey(provider),
    maxTokens: Math.max(1, Number(process.env.SPECREG_GENERATE_MAX_TOKENS || process.env.LLM_MAX_TOKENS || 12000)),
  };
}

function requireApiKey(config: GenerateLlmConfig, names: string): void {
  if (!config.apiKey) throw new Error(`--write with provider ${config.provider} requires ${names} in the environment or .env`);
}

async function generateMarkdown(prompt: string): Promise<string> {
  const config = generateConfig();
  if (config.provider === "anthropic") {
    requireApiKey(config, "ANTHROPIC_API_KEY, LLM_API_KEY, or SPECREG_GENERATE_API_KEY");
    const res = await fetch(`${config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic generation failed: ${res.status} ${await res.text()}`);
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

  if (config.provider === "gemini") {
    requireApiKey(config, "GEMINI_API_KEY, GOOGLE_API_KEY, LLM_API_KEY, or SPECREG_GENERATE_API_KEY");
    const modelPath = config.model.startsWith("models/") ? config.model : `models/${config.model}`;
    const res = await fetch(`${config.baseUrl}/${modelPath}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        generationConfig: { maxOutputTokens: config.maxTokens },
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });
    if (!res.ok) throw new Error(`Gemini generation failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as GeminiResponse;
    const markdown = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
    if (!markdown) throw new Error("Gemini generation returned no Markdown content");
    return markdown;
  }

  if (!config.baseUrl) throw new Error("--write with provider openai_compatible requires LLM_BASE_URL or SPECREG_GENERATE_BASE_URL");
  if (config.provider === "openai") requireApiKey(config, "OPENAI_API_KEY, LLM_API_KEY, or SPECREG_GENERATE_API_KEY");
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${config.provider} generation failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as ChatCompletionResponse;
  const markdown = body.choices?.[0]?.message?.content?.trim() ?? "";
  if (!markdown) throw new Error(`${config.provider} generation returned no Markdown content`);
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
  const exampleDir = path.resolve(root, opts.exampleDir);
  if (opts.examples) fs.mkdirSync(exampleDir, { recursive: true });
  const governed = opts.write ? governedFilenames(specDir) : new Set<string>();

  const written: string[] = [];
  const generated: string[] = [];
  const examples: string[] = [];
  for (const stub of response.prompts) {
    // The server tailors [PROJECT_TYPE]/[LANGUAGES]; the local scan fills [TREE]/[CONTEXT].
    const prompt = stub.prompt.replaceAll("[TREE]", scan.tree).replaceAll("[CONTEXT]", scan.tree);
    const file = path.join(outDir, `${stub.target_filename}.prompt.txt`);
    fs.writeFileSync(file, prompt, "utf8");
    written.push(file);

    if (opts.write) {
      const target = path.join(specDir, stub.target_filename);
      if (governed.has(stub.target_filename) && !opts.force) {
        throw new Error(
          `${path.relative(root, target)} is governed by ${path.relative(root, path.join(specDir, ".specregistry.json"))}. ` +
            "Generate repo-specific drafts outside the governed specs directory or re-run with --force."
        );
      }
      if (fs.existsSync(target) && !opts.force) {
        throw new Error(`${path.relative(root, target)} already exists. Re-run with --force to overwrite it.`);
      }
      console.log(`Generating ${path.relative(root, target)} ...`);
      fs.writeFileSync(target, await generateMarkdown(prompt), "utf8");
      generated.push(target);
    }

    if (opts.examples) {
      const exampleTarget = path.join(exampleDir, exampleTemplateFilename(stub.target_filename));
      if (fs.existsSync(exampleTarget) && !opts.force) {
        throw new Error(`${path.relative(root, exampleTarget)} already exists. Re-run with --force to overwrite it.`);
      }
      fs.writeFileSync(
        exampleTarget,
        renderExampleTemplate({
          filename: stub.target_filename,
          projectType: projectType.name,
          languages: scan.languages,
          tree: scan.tree,
        }),
        "utf8"
      );
      examples.push(exampleTarget);
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
    console.log(
      `\nReview the generated markdown, then run:\n  specreg submit-drafts --server ${opts.server}${opts.type ? ` --type "${opts.type}"` : ""}`
    );
  } else {
    console.log(
      `\nNext step: run each prompt through your AI agent to produce the corresponding spec file,\nor re-run with --write and SPECREG_GENERATE_PROVIDER / LLM_PROVIDER configured.`
    );
  }
  if (examples.length > 0) {
    console.log(`\nGenerated ${examples.length} example template file(s):`);
    for (const file of examples) {
      console.log(`  - ${path.relative(root, file)}`);
    }
    console.log("Keep example templates outside governed specs unless reviewers intentionally promote them.");
  }
}

function governedFilenames(specDir: string): Set<string> {
  const manifestPath = path.join(specDir, ".specregistry.json");
  if (!fs.existsSync(manifestPath)) return new Set();
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
  return new Set(manifest.specs.map((spec) => spec.filename));
}
