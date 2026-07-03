import Anthropic from "@anthropic-ai/sdk";
import type { Db } from "../db.js";
import { HttpError } from "../helpers.js";
import { decryptSecret, encryptSecret } from "./secretCrypto.js";

export type LlmProvider = "anthropic" | "openai" | "gemini" | "openai_compatible" | "openrouter" | "bitdeer" | "together" | "vultr" | "nvidia";

export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  base_url: string;
  api_key: string;
  max_tokens: number;
}

export interface PublicLlmConfig extends Omit<LlmConfig, "api_key"> {
  has_api_key: boolean;
}

export type LlmTier = "cheap" | "standard" | "frontier";
export type LlmTaskRoute =
  | "classification"
  | "summarization"
  | "spec_generation"
  | "task_planning"
  | "ticket_generation"
  | "audit"
  | "draft_fix"
  | "efficacy"
  | "maintenance"
  | "test";

export interface PublicLlmTierConfig extends PublicLlmConfig {
  tier: LlmTier;
  label: string;
  description: string;
}

export interface LlmTieringConfig {
  tiers: Record<LlmTier, PublicLlmTierConfig>;
  routes: Record<LlmTaskRoute, LlmTier>;
}

export interface LlmProviderDescriptor {
  id: LlmProvider;
  label: string;
  family: "native" | "openai_compatible";
  description: string;
  default_base_url: string;
  default_model: string;
  model_fallbacks: string[];
  requires_api_key: boolean;
  docs_url?: string;
}

export interface PublicLlmProviderConfig extends LlmProviderDescriptor {
  model: string;
  base_url: string;
  has_api_key: boolean;
}

const KEYS = {
  provider: "llm.provider",
  model: "llm.model",
  base_url: "llm.base_url",
  api_key: "llm.api_key",
  max_tokens: "llm.max_tokens",
};

export const LLM_TIERS: Array<{ tier: LlmTier; label: string; description: string }> = [
  { tier: "cheap", label: "Cheap / local", description: "Fast, low-cost models for classification, summarization, and planning." },
  { tier: "standard", label: "Standard", description: "Default balanced model for general automation." },
  { tier: "frontier", label: "Frontier", description: "Highest-quality model for final audits, generation, and draft fixes." },
];

export const DEFAULT_LLM_ROUTES: Record<LlmTaskRoute, LlmTier> = {
  classification: "cheap",
  summarization: "cheap",
  task_planning: "cheap",
  ticket_generation: "standard",
  maintenance: "standard",
  spec_generation: "frontier",
  audit: "frontier",
  draft_fix: "frontier",
  efficacy: "frontier",
  test: "standard",
};

export const LLM_TIER_VALUES: LlmTier[] = ["cheap", "standard", "frontier"];
export const LLM_ROUTE_VALUES: LlmTaskRoute[] = Object.keys(DEFAULT_LLM_ROUTES) as LlmTaskRoute[];
export const LLM_PROVIDER_VALUES: LlmProvider[] = [
  "anthropic",
  "openai",
  "gemini",
  "openrouter",
  "bitdeer",
  "together",
  "vultr",
  "nvidia",
  "openai_compatible",
];

const GEMINI_MODEL_FALLBACKS = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite-preview-12-2025",
  "gemini-3-pro-preview",
  "gemini-3-pro-image-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

export const LLM_PROVIDERS: LlmProviderDescriptor[] = [
  {
    id: "anthropic",
    label: "Anthropic Claude",
    family: "native",
    description: "Claude models through Anthropic's Messages API.",
    default_base_url: "",
    default_model: "claude-sonnet-4-5",
    model_fallbacks: ["claude-opus-4-8", "claude-sonnet-4-5", "claude-haiku-4-5"],
    requires_api_key: true,
    docs_url: "https://docs.anthropic.com/",
  },
  {
    id: "openai",
    label: "OpenAI",
    family: "openai_compatible",
    description: "OpenAI chat completions and compatible proxies.",
    default_base_url: "https://api.openai.com/v1",
    default_model: "gpt-4.1",
    model_fallbacks: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"],
    requires_api_key: true,
    docs_url: "https://platform.openai.com/docs",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    family: "native",
    description: "Gemini models through Google Generative Language APIs.",
    default_base_url: "https://generativelanguage.googleapis.com/v1beta",
    default_model: "gemini-3.5-flash",
    model_fallbacks: GEMINI_MODEL_FALLBACKS,
    requires_api_key: true,
    docs_url: "https://ai.google.dev/gemini-api/docs",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    family: "openai_compatible",
    description: "Multi-provider routing through OpenRouter's OpenAI-compatible API.",
    default_base_url: "https://openrouter.ai/api/v1",
    default_model: "anthropic/claude-sonnet-4.5",
    model_fallbacks: ["anthropic/claude-sonnet-4.5", "openai/gpt-4.1", "google/gemini-2.5-pro"],
    requires_api_key: true,
    docs_url: "https://openrouter.ai/docs",
  },
  {
    id: "bitdeer",
    label: "Bitdeer AI",
    family: "openai_compatible",
    description: "Bitdeer OpenAI-compatible hosted models.",
    default_base_url: "https://api-bitdeer.ai/v1",
    default_model: "deepseek-ai/DeepSeek-V3",
    model_fallbacks: ["deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-R1"],
    requires_api_key: true,
  },
  {
    id: "together",
    label: "Together AI",
    family: "openai_compatible",
    description: "Together AI inference through the OpenAI-compatible chat API.",
    default_base_url: "https://api.together.xyz/v1",
    default_model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    model_fallbacks: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-Coder-32B-Instruct"],
    requires_api_key: true,
    docs_url: "https://docs.together.ai/",
  },
  {
    id: "vultr",
    label: "Vultr",
    family: "openai_compatible",
    description: "Vultr Serverless Inference via an OpenAI-compatible API.",
    default_base_url: "https://api.vultrinference.com/v1",
    default_model: "llama-3.1-70b-instruct",
    model_fallbacks: ["llama-3.1-70b-instruct", "mistral-7b-instruct"],
    requires_api_key: true,
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    family: "openai_compatible",
    description: "NVIDIA build.nvidia.com / NIM LLM APIs through OpenAI-compatible chat completions.",
    default_base_url: "https://integrate.api.nvidia.com/v1",
    default_model: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    model_fallbacks: [
      "nvidia/llama-3.3-nemotron-super-49b-v1.5",
      "nvidia/llama-3.1-nemotron-ultra-253b-v1",
      "meta/llama-3.1-70b-instruct",
      "openai/gpt-oss-120b",
      "qwen/qwen3-coder-480b-a35b-instruct",
    ],
    requires_api_key: true,
    docs_url: "https://docs.api.nvidia.com/nim/reference/llm-apis",
  },
  {
    id: "openai_compatible",
    label: "OpenAI-compatible / local",
    family: "openai_compatible",
    description: "Custom endpoints such as Ollama, LM Studio, vLLM, LocalAI, or private gateways.",
    default_base_url: "",
    default_model: "llama3.1",
    model_fallbacks: ["llama3.1", "google/gemma-4-12b-qat"],
    requires_api_key: false,
  },
];

function providerDescriptor(provider: LlmProvider): LlmProviderDescriptor {
  return LLM_PROVIDERS.find((item) => item.id === provider) ?? LLM_PROVIDERS[0];
}

function normalizeProvider(value: unknown, fallback: LlmProvider = "anthropic"): LlmProvider {
  return typeof value === "string" && LLM_PROVIDERS.some((item) => item.id === value) ? (value as LlmProvider) : fallback;
}

function uniqueModels(...groups: string[][]): string[] {
  const seen = new Set<string>();
  const models: string[] = [];
  for (const group of groups) {
    for (const model of group) {
      if (!model || seen.has(model)) continue;
      seen.add(model);
      models.push(model);
    }
  }
  return models;
}

function openAiCompatibleBase(config: Pick<LlmConfig, "provider" | "base_url">): string {
  const descriptor = providerDescriptor(config.provider);
  const raw =
    descriptor.family === "openai_compatible"
      ? config.base_url || descriptor.default_base_url
      : config.base_url;
  const trimmed = raw.replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.pathname === "" || url.pathname === "/") {
      url.pathname = "/v1";
      return url.toString().replace(/\/+$/, "");
    }
  } catch {
    // Fall through and use the literal value; the fetch error will be explicit.
  }
  return trimmed;
}

function envApiKeyForProvider(provider: LlmProvider): string {
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY ?? "";
  if (provider === "openai") return process.env.OPENAI_API_KEY ?? "";
  if (provider === "gemini") return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "";
  if (provider === "openrouter") return process.env.OPENROUTER_API_KEY ?? "";
  if (provider === "bitdeer") return process.env.BITDEER_API_KEY ?? "";
  if (provider === "together") return process.env.TOGETHER_API_KEY ?? "";
  if (provider === "vultr") return process.env.VULTR_API_KEY ?? "";
  if (provider === "nvidia") return process.env.NVIDIA_API_KEY ?? process.env.NGC_API_KEY ?? "";
  return "";
}

function requireHostedApiKey(config: LlmConfig): void {
  const descriptor = providerDescriptor(config.provider);
  if (descriptor.requires_api_key && !config.api_key) {
    throw new HttpError(503, `LLM provider ${config.provider} requires LLM_API_KEY, a provider-specific API key environment variable, or a saved API key`);
  }
}

function textFromOpenAiChoice(body: unknown): string {
  const choices = (body as { choices?: unknown[] })?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = choices[0] as {
    text?: unknown;
    message?: {
      content?: unknown;
      reasoning_content?: unknown;
      tool_calls?: unknown;
    };
  };
  const content = first.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const record = part as Record<string, unknown>;
          if (typeof record.text === "string") return record.text;
          if (typeof record.content === "string") return record.content;
        }
        return "";
      })
      .join("")
      .trim();
    if (text) return text;
  }
  if (typeof first.text === "string" && first.text.trim()) return first.text.trim();
  return "";
}

function noTextDetail(body: unknown): string {
  const choice = (body as { choices?: Array<Record<string, unknown>> })?.choices?.[0];
  const finish = typeof choice?.finish_reason === "string" ? ` finish_reason=${choice.finish_reason};` : "";
  const keys = choice ? ` choice_keys=${Object.keys(choice).join(",")};` : "";
  return `LLM returned no text.${finish}${keys} Verify the selected model is a chat/completions model and that the base URL points at the OpenAI-compatible /v1 API.`;
}

function settingMap(db: Db): Map<string, string> {
  return new Map(
    (db.prepare("SELECT key, value FROM settings WHERE key LIKE 'llm.%'").all() as Array<{ key: string; value: string }>).map(
      (row) => [row.key, row.value]
    )
  );
}

function envProvider(): LlmProvider {
  if (process.env.LLM_PROVIDER === "openai") return "openai";
  if (process.env.LLM_PROVIDER === "gemini") return "gemini";
  if (process.env.LLM_PROVIDER === "openai_compatible") return "openai_compatible";
  if (process.env.LLM_PROVIDER === "openrouter") return "openrouter";
  if (process.env.LLM_PROVIDER === "bitdeer") return "bitdeer";
  if (process.env.LLM_PROVIDER === "together") return "together";
  if (process.env.LLM_PROVIDER === "vultr") return "vultr";
  if (process.env.LLM_PROVIDER === "nvidia") return "nvidia";
  if (process.env.LLM_BASE_URL) return "openai_compatible";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
  return "anthropic";
}

export function getLlmConfig(db: Db): LlmConfig {
  const settings = settingMap(db);
  const provider = (settings.get(KEYS.provider) || process.env.LLM_PROVIDER || envProvider()) as LlmProvider;
  const normalizedProvider = normalizeProvider(provider);
  const providerConfig = getLlmProviderConfig(db, normalizedProvider);
  return {
    provider: normalizedProvider,
    model:
      settings.get(KEYS.model) ||
      process.env.LLM_MODEL ||
      process.env.ANTHROPIC_MODEL ||
      process.env.OPENAI_MODEL ||
      process.env.GEMINI_MODEL ||
      providerConfig.model,
    base_url: settings.get(KEYS.base_url) || process.env.LLM_BASE_URL || providerConfig.base_url,
    api_key:
      (settings.get(KEYS.api_key) ? decryptSecret(settings.get(KEYS.api_key)!) : "") ||
      process.env.LLM_API_KEY ||
      providerConfig.api_key,
    max_tokens: Math.max(1, Number(settings.get(KEYS.max_tokens) || process.env.LLM_MAX_TOKENS || 16000)),
  };
}

function tierKey(tier: LlmTier, field: keyof typeof KEYS): string {
  return `llm.tier.${tier}.${KEYS[field].replace("llm.", "")}`;
}

function routeKey(route: LlmTaskRoute): string {
  return `llm.route.${route}`;
}

function providerKey(provider: LlmProvider, field: "model" | "base_url" | "api_key"): string {
  return `llm.provider_config.${provider}.${field}`;
}

function getLlmProviderConfig(db: Db, provider: LlmProvider): LlmConfig {
  const settings = settingMap(db);
  const descriptor = providerDescriptor(provider);
  return {
    provider,
    model: settings.get(providerKey(provider, "model")) || descriptor.default_model,
    base_url: settings.get(providerKey(provider, "base_url")) || descriptor.default_base_url,
    api_key:
      (settings.get(providerKey(provider, "api_key")) ? decryptSecret(settings.get(providerKey(provider, "api_key"))!) : "") ||
      (envProvider() === provider ? process.env.LLM_API_KEY || envApiKeyForProvider(provider) : envApiKeyForProvider(provider)),
    max_tokens: 0,
  };
}

export function publicLlmProviderConfig(db: Db, provider: LlmProvider, config = getLlmProviderConfig(db, provider)): PublicLlmProviderConfig {
  const descriptor = providerDescriptor(provider);
  return {
    ...descriptor,
    model: config.model,
    base_url: config.base_url,
    has_api_key: Boolean(config.api_key),
  };
}

export function publicLlmProvidersConfig(db: Db): PublicLlmProviderConfig[] {
  return LLM_PROVIDER_VALUES.map((provider) => publicLlmProviderConfig(db, provider));
}

export function saveLlmProviderConfig(
  db: Db,
  provider: LlmProvider,
  input: Partial<Pick<LlmConfig, "model" | "base_url" | "api_key">> & { clear_api_key?: boolean }
): LlmConfig {
  const current = getLlmProviderConfig(db, provider);
  const next: LlmConfig = {
    ...current,
    model: typeof input.model === "string" && input.model.trim() ? input.model.trim() : current.model,
    base_url: typeof input.base_url === "string" ? input.base_url.trim() : current.base_url,
    api_key: typeof input.api_key === "string" && input.api_key ? input.api_key : current.api_key,
  };
  if (input.clear_api_key) next.api_key = "";

  const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  upsert.run(providerKey(provider, "model"), next.model);
  upsert.run(providerKey(provider, "base_url"), next.base_url);
  upsert.run(providerKey(provider, "api_key"), encryptSecret(next.api_key));
  return next;
}

function defaultConfigForTier(db: Db, tier: LlmTier): LlmConfig {
  const base = getLlmConfig(db);
  if (tier === "cheap" && (process.env.LLM_LOCAL_BASE_URL || process.env.LLM_CHEAP_BASE_URL)) {
    return {
      provider: "openai_compatible",
      model: process.env.LLM_CHEAP_MODEL || process.env.LLM_LOCAL_MODEL || "local-model",
      base_url: process.env.LLM_CHEAP_BASE_URL || process.env.LLM_LOCAL_BASE_URL || "",
      api_key: process.env.LLM_CHEAP_API_KEY || process.env.LLM_LOCAL_API_KEY || "",
      max_tokens: Math.max(1, Number(process.env.LLM_CHEAP_MAX_TOKENS || 4000)),
    };
  }
  if (tier === "frontier") {
    return {
      ...base,
      model:
        process.env.LLM_FRONTIER_MODEL ||
        process.env.ANTHROPIC_MODEL ||
        process.env.OPENAI_MODEL ||
        process.env.GEMINI_MODEL ||
        base.model,
      max_tokens: Math.max(1, Number(process.env.LLM_FRONTIER_MAX_TOKENS || base.max_tokens)),
    };
  }
  return base;
}

export function getLlmTierConfig(db: Db, tier: LlmTier): LlmConfig {
  const map = settingMap(db);
  const fallback = defaultConfigForTier(db, tier);
  const provider = (map.get(tierKey(tier, "provider")) || fallback.provider) as LlmProvider;
  const normalizedProvider = normalizeProvider(provider, fallback.provider);
  const providerConfig = getLlmProviderConfig(db, normalizedProvider);
  return {
    provider: normalizedProvider,
    model: map.get(tierKey(tier, "model")) || (fallback.provider === normalizedProvider ? fallback.model : providerConfig.model),
    base_url: map.get(tierKey(tier, "base_url")) || (fallback.provider === normalizedProvider ? fallback.base_url : providerConfig.base_url),
    api_key: (map.get(tierKey(tier, "api_key")) ? decryptSecret(map.get(tierKey(tier, "api_key"))!) : "") || providerConfig.api_key || fallback.api_key,
    max_tokens: Math.max(1, Number(map.get(tierKey(tier, "max_tokens")) || fallback.max_tokens)),
  };
}

export function publicLlmTierConfig(db: Db, tier: LlmTier, config = getLlmTierConfig(db, tier)): PublicLlmTierConfig {
  const meta = LLM_TIERS.find((item) => item.tier === tier)!;
  return { ...publicLlmConfig(db, config), tier, label: meta.label, description: meta.description };
}

export function getLlmRouteTier(db: Db, route: LlmTaskRoute): LlmTier {
  const map = settingMap(db);
  const value = map.get(routeKey(route));
  return value === "cheap" || value === "standard" || value === "frontier" ? value : DEFAULT_LLM_ROUTES[route] ?? "standard";
}

export function getLlmConfigForRoute(db: Db, route: LlmTaskRoute): LlmConfig {
  return getLlmTierConfig(db, getLlmRouteTier(db, route));
}

export function publicLlmTieringConfig(db: Db): LlmTieringConfig {
  return {
    tiers: {
      cheap: publicLlmTierConfig(db, "cheap"),
      standard: publicLlmTierConfig(db, "standard"),
      frontier: publicLlmTierConfig(db, "frontier"),
    },
    routes: Object.fromEntries(
      (Object.keys(DEFAULT_LLM_ROUTES) as LlmTaskRoute[]).map((route) => [route, getLlmRouteTier(db, route)])
    ) as Record<LlmTaskRoute, LlmTier>,
  };
}

export function publicLlmConfig(db: Db, config = getLlmConfig(db)): PublicLlmConfig {
  const { api_key: _secret, ...rest } = config;
  return { ...rest, has_api_key: Boolean(config.api_key) };
}

export function saveLlmConfig(
  db: Db,
  input: Partial<LlmConfig> & { clear_api_key?: boolean }
): LlmConfig {
  const current = getLlmConfig(db);
  const provider = normalizeProvider(input.provider, current.provider);
  const descriptor = providerDescriptor(provider);
  const providerChanged = provider !== current.provider;
  const next: LlmConfig = {
    provider,
    model: typeof input.model === "string" && input.model.trim() ? input.model.trim() : providerChanged ? descriptor.default_model : current.model,
    base_url: typeof input.base_url === "string" ? input.base_url.trim() : providerChanged ? descriptor.default_base_url : current.base_url,
    api_key: typeof input.api_key === "string" && input.api_key ? input.api_key : current.api_key,
    max_tokens: Math.max(1, Number(input.max_tokens ?? current.max_tokens)),
  };
  if (input.clear_api_key) next.api_key = "";

  const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  upsert.run(KEYS.provider, next.provider);
  upsert.run(KEYS.model, next.model);
  upsert.run(KEYS.base_url, next.base_url);
  upsert.run(KEYS.api_key, encryptSecret(next.api_key));
  upsert.run(KEYS.max_tokens, String(next.max_tokens));
  return next;
}

export function saveLlmTierConfig(
  db: Db,
  tier: LlmTier,
  input: Partial<LlmConfig> & { clear_api_key?: boolean }
): LlmConfig {
  const current = getLlmTierConfig(db, tier);
  const provider = normalizeProvider(input.provider, current.provider);
  const descriptor = providerDescriptor(provider);
  const providerChanged = provider !== current.provider;
  const next: LlmConfig = {
    provider,
    model: typeof input.model === "string" && input.model.trim() ? input.model.trim() : providerChanged ? descriptor.default_model : current.model,
    base_url: typeof input.base_url === "string" ? input.base_url.trim() : providerChanged ? descriptor.default_base_url : current.base_url,
    api_key: typeof input.api_key === "string" && input.api_key ? input.api_key : current.api_key,
    max_tokens: Math.max(1, Number(input.max_tokens ?? current.max_tokens)),
  };
  if (input.clear_api_key) next.api_key = "";
  const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  upsert.run(tierKey(tier, "provider"), next.provider);
  upsert.run(tierKey(tier, "model"), next.model);
  upsert.run(tierKey(tier, "base_url"), next.base_url);
  upsert.run(tierKey(tier, "api_key"), encryptSecret(next.api_key));
  upsert.run(tierKey(tier, "max_tokens"), String(next.max_tokens));
  if (tier === "standard") saveLlmConfig(db, { ...next, clear_api_key: input.clear_api_key });
  return next;
}

export function saveLlmRoutes(db: Db, routes: Partial<Record<LlmTaskRoute, LlmTier>>): Record<LlmTaskRoute, LlmTier> {
  const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  for (const route of LLM_ROUTE_VALUES) {
    const tier = routes[route];
    if (tier === "cheap" || tier === "standard" || tier === "frontier") upsert.run(routeKey(route), tier);
  }
  return publicLlmTieringConfig(db).routes;
}

export interface LlmTextInput {
  system: string;
  user: string;
  maxTokens?: number;
  route?: LlmTaskRoute;
  tier?: LlmTier;
}

async function runLlmTextWithConfig(
  config: LlmConfig,
  input: { system: string; user: string; maxTokens: number }
): Promise<{ text: string; model: string; provider: LlmProvider }> {
  const maxTokens = input.maxTokens;
  if (config.provider === "anthropic") {
    requireHostedApiKey(config);
    const client = new Anthropic({
      apiKey: config.api_key,
      ...(config.base_url ? { baseURL: config.base_url } : {}),
    });
    const stream = client.messages.stream({
      model: config.model,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      system: input.system,
      messages: [{ role: "user", content: input.user }],
    });
    const message = await stream.finalMessage();
    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    if (!text) throw new HttpError(502, `LLM returned no text (stop_reason: ${message.stop_reason})`);
    return { text, model: config.model, provider: config.provider };
  }

  if (config.provider === "gemini") {
    requireHostedApiKey(config);
    const base = (config.base_url || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
    const modelPath = config.model.startsWith("models/") ? config.model : `models/${config.model}`;
    const res = await fetch(`${base}/${modelPath}:generateContent?key=${encodeURIComponent(config.api_key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        generationConfig: { maxOutputTokens: maxTokens },
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts: [{ text: input.user }] }],
      }),
    });
    if (!res.ok) throw new HttpError(502, `LLM provider error ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
    if (!text) throw new HttpError(502, "LLM returned no text");
    return { text, model: config.model, provider: config.provider };
  }

  const openAiBase = openAiCompatibleBase(config);
  if (!openAiBase) {
    throw new HttpError(503, "LLM provider openai_compatible requires LLM_BASE_URL or a saved base URL");
  }
  requireHostedApiKey(config);
  const res = await fetch(`${openAiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.api_key ? { authorization: `Bearer ${config.api_key}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
  });
  if (!res.ok) {
    throw new HttpError(502, `LLM provider error ${res.status}: ${await res.text()}`);
  }
  const body = await res.json();
  const text = textFromOpenAiChoice(body);
  if (!text) throw new HttpError(502, noTextDetail(body));
  return { text, model: config.model, provider: config.provider };
}

export async function runLlmText(
  db: Db,
  input: LlmTextInput
): Promise<{ text: string; model: string; provider: LlmProvider; tier: LlmTier; route: LlmTaskRoute }> {
  const route = input.route ?? "test";
  const tier = input.tier ?? getLlmRouteTier(db, route);
  const config = getLlmTierConfig(db, tier);
  const maxTokens = input.maxTokens ?? config.max_tokens;
  return { ...(await runLlmTextWithConfig(config, { system: input.system, user: input.user, maxTokens })), tier, route };
}

export async function runLlmProviderTest(
  db: Db,
  provider: LlmProvider,
  input: { system: string; user: string; maxTokens: number }
): Promise<{ text: string; model: string; provider: LlmProvider }> {
  return runLlmTextWithConfig(getLlmProviderConfig(db, provider), input);
}

async function listLlmModelsForConfig(config: LlmConfig): Promise<{ provider: LlmProvider; models: string[] }> {
  const descriptor = providerDescriptor(config.provider);
  if (config.provider === "anthropic") {
    if (!config.api_key) {
      return { provider: config.provider, models: descriptor.model_fallbacks };
    }
    const client = new Anthropic({ apiKey: config.api_key, ...(config.base_url ? { baseURL: config.base_url } : {}) });
    const page = await client.models.list({ limit: 100 });
    return { provider: config.provider, models: uniqueModels(descriptor.model_fallbacks, page.data.map((model) => model.id)) };
  }
  if (config.provider === "gemini") {
    if (!config.api_key) {
      return { provider: config.provider, models: descriptor.model_fallbacks };
    }
    const base = (config.base_url || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
    const res = await fetch(`${base}/models?key=${encodeURIComponent(config.api_key)}`);
    if (!res.ok) throw new HttpError(502, `LLM model list error ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
    const models = (body.models ?? [])
      .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
      .map((model) => (model.name ?? "").replace(/^models\//, ""))
      .filter(Boolean);
    return { provider: config.provider, models: uniqueModels(descriptor.model_fallbacks, models) };
  }

  const base = openAiCompatibleBase(config);
  if (!base || (descriptor.requires_api_key && !config.api_key)) return { provider: config.provider, models: descriptor.model_fallbacks };
  const res = await fetch(`${base}/models`, {
    headers: { ...(config.api_key ? { authorization: `Bearer ${config.api_key}` } : {}) },
  });
  if (!res.ok) throw new HttpError(502, `LLM model list error ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { data?: Array<{ id?: string }> };
  return {
    provider: config.provider,
    models: uniqueModels(descriptor.model_fallbacks, (body.data ?? []).map((model) => model.id).filter((id): id is string => Boolean(id))),
  };
}

export async function listLlmModels(db: Db, tier?: LlmTier): Promise<{ provider: LlmProvider; models: string[]; tier?: LlmTier }> {
  const config = tier ? getLlmTierConfig(db, tier) : getLlmConfig(db);
  return { ...(await listLlmModelsForConfig(config)), tier };
}

export async function listLlmProviderModels(db: Db, provider: LlmProvider): Promise<{ provider: LlmProvider; models: string[] }> {
  return listLlmModelsForConfig(getLlmProviderConfig(db, provider));
}
