# Test Specification

## Purpose

Defines the unit, integration, contract, SIL, HIL, and regression tests required for changes,
and the controlled progression from simulation to real hardware. When agents make QA and coding
decisions, they must be able to see the impact of their changes through tests, logs, and
artifacts before a human reviews them — and before anything touches hardware.

## Required Test Types

| Type | Validates |
| --- | --- |
| Unit tests | Individual functions and classes. |
| Contract tests | APIs, protobufs, UDP messages, and SNMP behavior against their specifications. |
| Integration tests | Interactions between subsystems. |
| Regression tests | That existing behavior is not broken. |
| Static analysis | Coding standards, security risks, and maintainability. |
| Build validation | That the project compiles cleanly. |
| Change-specific tests | Behavior tied directly to the ticket's acceptance criteria. |

## SIL Virtual Environment

AI-generated changes are validated in the SIL (software-in-the-loop) environment before any
hardware test.

| Capability | Requirement |
| --- | --- |
| Virtualized behavior | Simulate hardware-adjacent behavior. |
| Message replay | Replay UDP, protobuf, SNMP, or API traffic. |
| Fault injection | Simulate packet loss, invalid values, timeouts, and degraded states. |
| Regression scenarios | Validate known system behaviors. |
| Hardware-readiness gate | Determine whether a change is safe to test on real hardware. |

## Real Hardware Validation Gate

Hardware can be bricked, so progression to real hardware is gated. A change may be authorized
for hardware testing **only after** all of the following pass, in order:

1. Unit tests pass — basic correctness verified.
2. Contract tests pass — interface compatibility verified.
3. SIL tests pass — behavior validated in simulation.
4. Human review complete — an engineer approves the logic and the risk.
5. Hardware test authorized — the change may be tested on real hardware (including reboot
   testing where startup behavior or run-time failure handling must be observed).

Unattended agent deployment directly to hardware is prohibited; a human-in-the-loop is required
at the hardware gate.

## AI Agent Directives

An agent must run the test types required by the ticket and the affected contracts, capture the
evidence (logs, reports, simulation output), and stop at the hardware-readiness gate. It may not
request hardware authorization until SIL and human review are complete.
