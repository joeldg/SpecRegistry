# Release Process

## Scope

This specification defines how software versions are numbered, how release candidates are promoted to production, how rollbacks are triggered, and what post-release observation is required. It applies to every service or package that ships to an external or production environment.

## Intent

A consistent, documented release process ensures that every production change is deliberate, traceable, and reversible. It protects customers from accidental deployments and gives the team a clear escalation path when something goes wrong.

## Versioning Policy

This project follows Semantic Versioning (`MAJOR.MINOR.PATCH`):

| Increment | When |
| --- | --- |
| MAJOR | Breaking change to a public API, schema, or CLI contract |
| MINOR | New backwards-compatible functionality |
| PATCH | Bug fix, security patch, dependency bump with no behavior change |

Pre-release suffixes (`-alpha.1`, `-beta.2`, `-rc.1`) are allowed for release candidates. Version numbers are set in `<!-- package.json / pyproject.toml / Cargo.toml -->` and must not be committed without a corresponding changelog entry.

## Release Checklist

Before tagging a release, verify all of the following:

- [ ] All tickets in the release scope are merged and linked
- [ ] Full test suite passes on the release branch
- [ ] Static analysis and security scan are clean
- [ ] Changelog updated with a human-readable summary of changes
- [ ] Dependent services notified of breaking changes (if MAJOR)
- [ ] Database migrations reviewed and rollback procedure documented
- [ ] Release notes reviewed by tech lead or product owner

## Promotion Flow

```
feature branch → develop (or main) → release candidate → production tag
```

1. Cut a `release/X.Y.Z` branch from `develop` (GitFlow) or tag directly from `main` (trunk-based).
2. Run the full release checklist.
3. Tag as `vX.Y.Z-rc.N` and deploy to staging.
4. Smoke-test the staging environment against the acceptance criteria for this release.
5. On sign-off, merge the release branch to `main` and tag `vX.Y.Z`.
6. Deploy the tagged version to production.
7. Begin the post-release observation window.

## Post-Release Observation

All releases enter a minimum <!-- 30-minute --> observation window after production deployment. During this window:

- Monitor error rate, latency, and business-critical metrics.
- Keep the release engineer on standby.
- Do not deploy another release to the same service.

If anomalies exceed the defined alert thresholds during the window, initiate rollback immediately without waiting for root-cause analysis.

## Rollback Triggers

Initiate rollback when any of the following occur during or after the observation window:

- Error rate increases by more than <!-- 5% --> over baseline
- P99 latency doubles
- A critical customer-facing feature is broken
- A security vulnerability is discovered in the shipped code

## Rollback Procedure

1. Re-deploy the previous tagged version.
2. Verify the rollback restored normal metrics.
3. Open an incident ticket with the timeline, root cause (if known), and customer impact.
4. Do not re-attempt the failed release until root cause is identified and the fix is reviewed.

## Acceptance Evidence

- Every production deployment is tagged with a semantic version in source control.
- Release checklist completion is recorded (PR comment, ticket update, or changelog entry).
- Post-release observation window is documented in the deployment log.
- Rollback events are tracked as incidents with root-cause records.

## Token Budget Class

Workflow rule. Load for release, deployment, and rollback tasks.

## Related Specs

- `BRANCHING_STRATEGY.md` — release branch creation and merge policy.
- `CHANGE_MANAGEMENT.md` — approval gates and freeze windows.
- `INCIDENT_RESPONSE.md` — what to do when a release causes an incident.

## AI Agent Directives

Do not tag or deploy a release without completing the release checklist. Do not deploy to production without human sign-off on the release candidate. If anomaly thresholds are crossed during the observation window, initiate rollback and open an incident ticket — do not attempt to fix forward without human approval.
