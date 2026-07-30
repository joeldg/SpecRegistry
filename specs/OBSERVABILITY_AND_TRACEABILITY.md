# Observability and Traceability Specification

## Purpose

When AI writes the code, the code is no longer the source of truth — the specification is.
Observability must therefore shift from observing software execution to observing the
translation of intent into execution. This specification defines how every line of
synthesized code is traced back to the specification that motivated it, and how divergence
from the specification is detected and reported.

## Bidirectional Traceability

The system must be able to:

1. Trace a block of specification to the token usage and the specific lines of code in a PR
   that implement it, **and**
2. Trace lines of code in a PR back to an agent id, a prompt template, and the section of
   the specification they satisfy.

Requirement IDs are derived from specification headings (for example, a clause under
section 7.4 is `REQ-7.4`). Generated code references its requirement id inline, e.g.
`// @spec[REQ-7.4]`, so traceability survives in the source.

## Divergence and Orphan Scoring

Anything that cannot be mapped clearly back to the specification is **divergence**. Every PR
generates a divergence/orphan report. The specification defines limits for acceptable
divergence; a PR exceeding the limit is held for human review.

## Telemetry

Telemetry is tied to model usage, duration, and agent id.

| Metric | Description |
| --- | --- |
| TTFT & latency | Time to first token and total generation duration per agent step. |
| Token efficiency ratio | Ratio of prompt tokens to generated code tokens (detects over-verbose prompting). |
| Cost per feature/fix | Total cost of the LLM calls required to merge a specification. |
| Tokens missed | Tokens wasted on blind-alley work, rewrites, and bad output. |
| Self-healing iteration rate | Loops (compile → fail → correct → regenerate) before reaching a passing state. |
| First-pass success rate | Percentage of specs that compile and pass all generated tests on iteration 0. |
| Spec compliance | Independent 0–100% score of how thoroughly generated code covers the spec's constraints. |
| Semantic drift | Vector distance between the new code's structural intent and the established architecture. |
| Architecture boundary violations | Count of times an agent violated a specification boundary. |
| Spec error attribution | Regressions traced back to a vague or contradictory specification node. |

## Compact Traceability & Token Efficiency

To ensure sidecar metadata artifacts and context injections remain economically viable and token-aware under large codebases:

1. **Schema V2 Dictionary Encoding**: Sidecar metadata (`.spec/code-map.json` and `.spec/code-trace.json`) and network reports must use top-level string lookup tables (`dict.paths`, `dict.kinds`, `dict.signatures`, `dict.specs`) and compact index-tuples rather than verbose key-value objects. This structure must achieve a **70%–80% reduction** in file footprint and network payload size.
2. **Compact DSL Projections**: MCP tools (`check_compliance`, `finish_task`) and agent prompt injectors MUST NOT dump raw JSON arrays into agent context. Traceability evidence must be projected into a line-oriented Compact DSL or TSV summary, reducing prompt token consumption by **>90%** (<200 tokens per check).
3. **Transparent Compatibility**: Readers and decoders must transparently handle both Schema V1 (verbose JSON) and Schema V2 (compact dictionary) payloads without loss of fidelity.

## Root-Cause Classification

Failures are classified as a **logic gap** (code did not match the spec) or a **context gap**
(code matched the spec, but the spec did not account for the real-world state). Code that
scores perfect spec compliance yet still fails is a **spec flaw** — it signals a problem with
the specification itself and is routed back to the spec authors.

## AI Agent Directives

Agents must emit the spec id, spec version, and prompt hash for every action so that each
change is attributable. An agent must not produce code it cannot map to a specification
clause; unmappable output is divergence and must be reported, not merged.
