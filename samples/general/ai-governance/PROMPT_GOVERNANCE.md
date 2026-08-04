# Prompt Governance

## Scope

This specification defines how prompts used in production LLM-powered features are versioned, reviewed, changed, and protected against injection. It applies to every prompt that is part of a shipped product feature — not to ad-hoc developer tool usage.

## Intent

A production prompt is a program. Like application code, it can have bugs, security vulnerabilities, and regressions. Without version control and review, prompt changes break features silently, and prompt injections compromise system behavior. This spec ensures prompts are treated with the same rigor as code.

## What Is a Governed Prompt

A prompt is governed by this spec when it:

- Is rendered at runtime to an LLM as part of a user-facing feature
- Incorporates user-supplied input that could alter the instruction
- Controls an action with side effects (data writes, API calls, agent decisions)
- Is relied upon for accuracy, safety, or compliance

One-off developer queries, local experimentation, and internal tooling with no external impact are not governed.

## Versioning and Storage

Governed prompts are:

- Stored in the repository under `<!-- prompts/ or src/prompts/ -->` as versioned files
- Named descriptively: `<!-- feature-name.prompt.md or feature-name.v2.txt -->`
- Tracked in git with the same branch and review policy as code
- Accompanied by a brief changelog comment when changed

Each prompt file includes a header comment:

```
# Prompt: <feature name>
# Version: <semver>
# Last reviewed: <YYYY-MM-DD>
# Reviewer: <name>
```

Breaking changes (behavior change, output format change) increment the MAJOR version. Non-breaking improvements increment MINOR. Clarifications increment PATCH.

## Review Requirements

A governed prompt change requires:

1. A PR with the prompt diff clearly visible.
2. A description of what changed and why.
3. Test evidence: sample inputs and the new vs. old outputs.
4. At least one reviewer who can evaluate the change's effect on the feature.
5. Security review if the change affects how user input is incorporated (injection risk).

## Prompt Injection Mitigations

User-supplied input incorporated into a prompt must be treated as untrusted:

| Mitigation | Required? |
| --- | --- |
| Separate system and user turns (never concatenate directly into system prompt) | Yes |
| Validate and sanitize input before rendering | Yes |
| Set a maximum input length | Yes |
| Include an instruction-boundary marker in the system prompt | Recommended |
| Monitor outputs for policy violations | Recommended for high-risk features |

Never trust user-supplied input to contain only data. Treat it as potentially adversarial.

## Output Validation

For prompts that produce structured output (JSON, code, decisions):

- Validate the output shape before using it.
- Define the expected schema and reject malformed responses.
- Log unexpected output for review (without logging sensitive input content).
- Fall back to a safe default when the LLM output cannot be validated.

## Testing

Each governed prompt must have:

- A set of representative input/output examples (golden tests) stored alongside the prompt.
- A regression check that runs the examples against the current prompt and flags divergence.
- A documented evaluation method for subjective quality (e.g. human eval, LLM-as-judge with a defined rubric).

## Acceptance Evidence

- Governed prompts are stored in the repository with version headers.
- Prompt changes go through PR review with test evidence.
- User input is never concatenated directly into the system prompt.
- Output validation exists for structured-output prompts.

## Token Budget Class

Workflow rule. Load for LLM feature design, prompt authoring, and security review tasks.

## Related Specs

- `LLM_USAGE_POLICY.md` — which uses of LLMs are permitted and what requires review.
- `AI_DATA_HANDLING.md` — what data may appear in prompts sent to external providers.
- `SECRETS_MANAGEMENT.md` — API keys used to call LLM providers.

## AI Agent Directives

When generating or modifying a production prompt, include a version header and a changelog comment. Never concatenate raw user input into a system prompt. When the prompt accepts user-supplied content, include input validation and output validation in the implementation. Flag any prompt change that could alter system behavior as requiring a human review with test evidence before merge.
