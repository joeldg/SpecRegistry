import type { CompliancePolicyRow, LlmProvider, LlmProviderDescriptor } from "../../api";

export function providerLabel(providers: LlmProviderDescriptor[], provider: LlmProvider): string {
  return providers.find((item) => item.id === provider)?.label ?? provider;
}

export function providerDescriptor(providers: LlmProviderDescriptor[], provider: LlmProvider): LlmProviderDescriptor | undefined {
  return providers.find((item) => item.id === provider);
}

export function modelPlaceholder(providers: LlmProviderDescriptor[], provider: LlmProvider): string {
  return providerDescriptor(providers, provider)?.model ?? providerDescriptor(providers, provider)?.default_model ?? "model";
}

export function baseUrlPlaceholder(providers: LlmProviderDescriptor[], provider: LlmProvider): string {
  const descriptor = providerDescriptor(providers, provider);
  if (!descriptor) return "Provider base URL";
  if (descriptor.base_url || descriptor.default_base_url) return descriptor.base_url || descriptor.default_base_url;
  if (provider === "anthropic") return "Optional proxy base URL";
  if (provider === "gemini") return "Optional Gemini API base URL";
  return "LM Studio: http://10.0.0.142:1234 · Ollama: http://localhost:11434/v1";
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function clampPercentInput(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function parseMappedKinds(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((kind): kind is string => typeof kind === "string") : [];
  } catch {
    return [];
  }
}

export function policyKinds(policy: Pick<CompliancePolicyRow, "required_mapped_kinds"> | { required_mapped_kinds: string[] }): string[] {
  return typeof policy.required_mapped_kinds === "string" ? parseMappedKinds(policy.required_mapped_kinds) : policy.required_mapped_kinds;
}
