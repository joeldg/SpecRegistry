# UDP Message Contract Specification

## Purpose

Defines the JSON-based UDP message contracts exchanged between subsystems and the rules for
validating them. UDP is lossy and unordered by nature, so the contract must make timing and
failure expectations explicit — an agent that changes a message without understanding these
assumptions can break a working system that compiles cleanly.

## Message Schema

| Item | Requirement |
| --- | --- |
| Structure | Each message defines its JSON structure, required fields, and optional fields. |
| Field types | Every field has an explicit type and, where applicable, range and units. |
| Identification | Messages carry a type discriminator and a schema version. |

## Timing Assumptions

Every message contract documents its frequency, timeout, retry behavior, and packet-loss
expectations. Consumers must tolerate the documented loss and delay characteristics.

## Compatibility Rules

- **Additive** (minor): adding an optional field, or a new message type.
- **Breaking** (major): removing or retyping a field, changing required/optional status, or
  changing timing assumptions. Breaking changes require sign-off from every consumer.

## Error Handling

The contract defines behavior for invalid, missing, malformed, and delayed messages. A
receiver must fail safe — it logs and rejects a bad message rather than acting on it.

## Test Cases

Simulated packet scenarios are required: nominal traffic, packet loss, out-of-order delivery,
malformed payloads, and timeouts. These run in the SIL environment via message replay.

## AI Agent Directives

An agent changing a UDP message must classify the change against the compatibility rules,
preserve or explicitly revise the timing assumptions, and exercise the simulated packet
scenarios before proposing the change. Silent changes to required fields or timing are
prohibited.
