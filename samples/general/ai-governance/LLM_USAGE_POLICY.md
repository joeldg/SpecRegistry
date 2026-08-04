# LLM Usage Policy

## Scope

This specification defines which tasks AI assistants may support, what requires human review before use, prohibited uses, and how AI-generated output is labeled and attributed. It applies to every engineer, product manager, and automated agent that uses an LLM-powered tool in the course of this organization's work.

## Intent

LLMs are powerful tools that accelerate development but introduce risks: hallucinated facts, over-trusted output, and autonomous actions in production systems. This policy ensures AI assistance is used where it adds value and constrained where it creates risk.

## Permitted Uses

The following uses are permitted without additional approval:

| Use | Notes |
| --- | --- |
| Code completion and suggestion | Human reviews and accepts or rejects each suggestion |
| Drafting documentation, tickets, and commit messages | Human edits and approves before publishing |
| Generating test cases | Human reviews test logic and assertions before merging |
| Explaining code or specifications | Output is informational; no direct action taken |
| Searching and summarizing internal knowledge | Human verifies claims against primary sources |
| Generating boilerplate from a specification | Human reviews the output matches the spec |
| Drafting specification changes | Must go through the normal spec review workflow before publication |

## Uses Requiring Human Review

The following outputs require explicit human review before use:

| Use | Review requirement |
| --- | --- |
| Security-sensitive code (auth, crypto, secrets handling) | Security-competent reviewer sign-off on the generated code |
| Database migrations | DBA or senior engineer review of schema and rollback plan |
| API contract changes | API contract review per `API_CONTRACT.md` |
| Infrastructure-as-code changes | Infrastructure team review before apply |
| Production configuration changes | Change request per `CHANGE_MANAGEMENT.md` |

## Prohibited Uses

The following uses are unconditionally prohibited:

- Autonomous commits to protected branches without a human PR approval
- Autonomous deployment to production environments
- Autonomous approval or merging of pull requests
- Autonomous publication of specification changes
- Handling or transmitting secrets, credentials, or PII to external LLM providers without a reviewed data handling policy
- Using output from an LLM as the primary source for a security, compliance, or legal decision without human expert review

## Attribution

AI-assisted work must be attributed. Apply the following to your organization's conventions:

- **Commit messages:** Include a `Co-Authored-By:` trailer for AI-generated or AI-assisted code (e.g. `Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>`).
- **Specifications:** AI-drafted specs are labeled as drafts until reviewed and approved by a human.
- **Documentation:** AI-assisted documentation is reviewed by a human before publication; no separate attribution is required.

## Data Sent to External Providers

Before sending proprietary code, specifications, or data to an external LLM provider, verify:

1. The data classification tier (see `DATA_CLASSIFICATION.md`).
2. The provider's data use policy.
3. Whether your organization has a DPA (Data Processing Agreement) with the provider.

Confidential or Restricted data must not be sent to external LLM providers without legal review and an approved DPA.

## Acceptance Evidence

- AI-generated code that is committed has human review before merge.
- Security-sensitive AI-generated code has reviewer sign-off.
- No AI tool has autonomous access to protected branches or production systems.
- Restricted data is not transmitted to external LLM providers.

## Token Budget Class

Workflow rule. Load for AI-assisted implementation, tool configuration, and policy review tasks.

## Related Specs

- `AGENT_CONTAINMENT.md` — blast-radius limits for autonomous agents.
- `PROMPT_GOVERNANCE.md` — version control and review for production LLM prompts.
- `AI_DATA_HANDLING.md` — rules for what data may be sent to external providers.
- `DATA_CLASSIFICATION.md` — sensitivity tiers that govern what may be sent externally.

## AI Agent Directives

You are subject to this policy. Do not autonomously commit to protected branches, deploy to production, approve PRs, or publish specifications. Always note when you have generated security-sensitive code and flag it for explicit human security review. Do not transmit Confidential or Restricted data to external services without documented authorization. When asked to perform a prohibited action, refuse and explain why, pointing to this spec.
