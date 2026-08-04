# AI Data Handling

## Scope

This specification defines rules for what data may be sent to external LLM providers, data residency requirements, opt-out mechanisms for sensitive datasets, and audit expectations for AI data flows. It applies to every integration that sends organizational or user data to an external model inference endpoint.

## Intent

Sending data to an external LLM provider is a data sharing event with legal, compliance, and trust implications. This spec ensures every AI data flow is intentional, documented, and governed by the same classification and consent rules as any other data transfer.

## Classification-Based Rules

Apply the rules from `DATA_CLASSIFICATION.md` to every data element before sending it to an external provider:

| Tier | May be sent to external LLM? | Conditions |
| --- | --- | --- |
| Public | Yes | No conditions |
| Internal | Yes | Provider must have a signed DPA; data must not be used for model training |
| Confidential | Conditional | Requires legal review, DPA, and documented business justification |
| Restricted | No | Not permitted without executive approval and legal counsel sign-off |

PII must be treated as Confidential or Restricted depending on its nature (see `PRIVACY_AND_PII.md`).

## Approved Providers

List each approved external LLM provider, the data tiers they may receive, and the legal basis:

| Provider | Approved tiers | DPA in place | Training opt-out | Notes |
| --- | --- | --- | --- | --- |
| <!-- Anthropic Claude API --> | Public, Internal | <!-- Yes / No --> | <!-- Yes → [link] --> | <!-- Zero data retention option --> |
| <!-- OpenAI API --> | Public, Internal | <!-- Yes / No --> | <!-- Yes → [link] --> | |
| <!-- Local / self-hosted endpoint --> | All tiers | N/A — no external transfer | N/A | Verify network isolation |

Only providers on this list may receive organizational data. Adding a new provider requires a reviewed update to this spec.

## Data Minimization in Prompts

Before including data in a prompt:

1. Remove or anonymize any fields not required for the task.
2. Replace PII with synthetic identifiers where the task allows it (e.g. use `user_7f3a` instead of a real name).
3. Strip secrets, tokens, and credentials from code snippets before sending.
4. Use the shortest context window that produces acceptable results.

## Opt-Out for Sensitive Datasets

The following datasets are excluded from all external AI data flows:

| Dataset | Reason | Owner |
| --- | --- | --- |
| <!-- Customer financial records --> | Restricted tier | <!-- Team --> |
| <!-- Employee HR records --> | Restricted + PII | <!-- HR --> |
| <!-- Add rows as needed --> | | |

If a feature requires sending excluded data to an LLM, it must either use a self-hosted model or go through the full legal and compliance approval process.

## Audit Requirements

Every external AI data flow must be:

- **Logged**: Which service, which provider, which data tier, what task, when.
- **Reviewable**: Logs must be retained for <!-- 90 days --> and accessible for compliance review.
- **Attributable**: It must be possible to identify which user request triggered which AI call.

Do not log the full prompt or response content if it may contain Confidential or Restricted data. Log metadata only.

## Training Opt-Out

All approved providers must be configured to opt out of using organizational data for model training. Verify the opt-out status quarterly. If a provider removes the opt-out option, stop sending Internal or above data to that provider immediately and open a review.

## Acceptance Evidence

- Every external LLM integration is documented in the approved provider table.
- DPAs are in place for all providers that receive Internal or above data.
- Training opt-out is verified quarterly for each provider.
- Audit logs exist for external AI data flows and are retained for the defined period.

## Token Budget Class

Workflow rule. Load for AI feature design, provider integration, and privacy review tasks.

## Related Specs

- `DATA_CLASSIFICATION.md` — sensitivity tiers governing what may be sent externally.
- `PRIVACY_AND_PII.md` — PII handling rules that apply to prompts and responses.
- `PROMPT_GOVERNANCE.md` — how prompts are structured to minimize data exposure.
- `LLM_USAGE_POLICY.md` — overall policy for AI assistant usage.

## AI Agent Directives

Before sending any data to an external LLM provider, classify the data and verify it is permitted for the target provider by this spec. Anonymize or strip PII and secrets from all prompts. Never send Restricted data to an external provider. If you are about to include customer data, employee records, or credentials in a prompt, stop and flag it for human review.
