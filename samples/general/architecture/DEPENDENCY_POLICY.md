# Dependency Policy

## Scope

This specification defines the rules for introducing, pinning, auditing, and retiring third-party dependencies. It applies to production runtime dependencies, development tooling, and transitive dependencies in every package in this repository.

## Intent

Third-party dependencies are a major source of security vulnerabilities, license risk, and maintenance burden. This policy ensures that every dependency is a deliberate choice, kept current, and removable when it stops earning its place.

## Introducing a New Dependency

Before adding a dependency, answer all of the following:

1. **Necessity** — Does this dependency solve a problem that cannot be solved with a small amount of well-tested in-house code?
2. **Maintenance** — Is the project actively maintained? When was the last release? How many open issues are unaddressed?
3. **License** — Is the license compatible with this project's license and commercial use? (See License Allowlist below.)
4. **Size** — What is the bundle or binary size impact? Is it acceptable for the target environment?
5. **Transitive risk** — How many transitive dependencies does it bring? Are any of them known problematic packages?
6. **Alternatives** — Were two or more alternatives considered?

A new production runtime dependency requires a PR description that answers these questions. A reviewer must confirm the answers before approving.

## License Allowlist

| License | Allowed in production | Allowed in dev tooling |
| --- | --- | --- |
| MIT | Yes | Yes |
| Apache 2.0 | Yes | Yes |
| BSD 2-Clause / 3-Clause | Yes | Yes |
| ISC | Yes | Yes |
| MPL 2.0 | Review required | Yes |
| LGPL | Review required | Yes |
| GPL (any version) | No | Review required |
| AGPL | No | No |
| Commercial / proprietary | Review required | Review required |

When in doubt, consult the tech lead before adding a dependency with an unlisted license.

## Version Pinning

- All direct dependencies must be pinned to an exact version in the manifest (`package.json`, `requirements.txt`, `Cargo.toml`, etc.).
- The lock file (`package-lock.json`, `poetry.lock`, `Cargo.lock`) must be committed to source control.
- Ranges (`^`, `~`, `>=`) are not allowed for production runtime dependencies without documented justification.

## CVE Scanning

- The dependency manifest is scanned for CVEs on every CI run and at least weekly on `main`.
- **Critical severity CVEs** must be resolved within <!-- 7 days --> of first detection.
- **High severity CVEs** must be resolved within <!-- 30 days -->.
- **Medium and below** are tracked and resolved in the next planned maintenance cycle.
- Unmitigated critical CVEs are a blocking release concern.

## Vendoring Policy

Dependencies are <!-- not vendored | vendored into `vendor/` for languages without a lock file equivalent -->. If a dependency must be vendored, document the reason and the process for updating it.

## Retiring a Dependency

When a dependency is no longer needed:
1. Remove it from the manifest and verify the lock file updates cleanly.
2. Check for transitive dependents that may have relied on it indirectly.
3. Run the full test suite to confirm removal is safe.
4. Update this spec if the dependency was referenced here.

## Acceptance Evidence

- New production runtime dependencies have PR descriptions addressing the five introduction questions.
- Lock file is committed and reflects the pinned versions.
- CVE scan runs in CI and results are visible in the build output.
- No critical CVEs remain open past the resolution SLA.

## Token Budget Class

Workflow rule. Load for dependency introduction, security audit, and upgrade tasks.

## Related Specs

- `VULNERABILITY_MANAGEMENT.md` — CVE triage process and exception handling.
- `RELEASE_PROCESS.md` — dependency updates as part of the release checklist.
- `SECRETS_MANAGEMENT.md` — dependencies that handle credentials need additional scrutiny.

## AI Agent Directives

Before recommending a new dependency, answer the five introduction questions and include them in the PR description. Always propose exact version pins, never ranges. Do not add dependencies with GPL or AGPL licenses without explicit human approval. Flag any detected CVE in a proposed or existing dependency before implementing code that uses it.
