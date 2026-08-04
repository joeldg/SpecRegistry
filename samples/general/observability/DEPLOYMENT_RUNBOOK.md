# Deployment Runbook

## Scope

This specification defines the general deployment process: pre-flight checklist, deploy steps, smoke tests, rollback trigger criteria, and post-deploy observation window. Copy and adapt this template for each service's production deployment procedure.

## Intent

A deployment runbook eliminates ambiguity at the worst possible time. When a deploy goes wrong, the person running it should not be improvising — they should be following a tested procedure. This template provides the structure; each service fills in the specifics.

## Service Information

| Field | Value |
| --- | --- |
| Service | <!-- service-name --> |
| Deployment target | <!-- Kubernetes / ECS / VM / serverless --> |
| Deploy tool | <!-- kubectl / helm / terraform / deploy script --> |
| Artifact | <!-- Docker image / binary / package --> |
| Repository | <!-- URL --> |
| Runbook owner | <!-- Team name --> |
| Last tested | <!-- YYYY-MM-DD --> |

## Pre-Flight Checklist

Complete all steps before starting a deployment:

- [ ] All PRs in this release are merged and the release branch is tagged
- [ ] Full test suite passes on the release tag
- [ ] Release checklist in `RELEASE_PROCESS.md` is complete
- [ ] Change request is approved (if Significant or High-risk per `CHANGE_MANAGEMENT.md`)
- [ ] On-call engineer is aware and available for the observation window
- [ ] Rollback procedure has been reviewed and the rollback command is ready
- [ ] Monitoring dashboards are open and showing current baseline
- [ ] Not in a freeze window (per `CHANGE_MANAGEMENT.md`)
- [ ] <!-- Any service-specific pre-flight steps -->

## Deploy Steps

```sh
# 1. Pull the release tag
<!-- git checkout vX.Y.Z -->

# 2. Build / tag the artifact (if not done by CI)
<!-- docker build -t <image>:<version> . -->
<!-- docker push <image>:<version> -->

# 3. Deploy to production
<!-- kubectl set image deployment/<service-name> <container>=<image>:<version> -->
<!-- # or: helm upgrade <release> <chart> --set image.tag=<version> -->
<!-- # or: ./scripts/deploy.sh <version> -->

# 4. Monitor the rollout
<!-- kubectl rollout status deployment/<service-name> -->
```

Record the start time and the deploying engineer's name in the change ticket.

## Smoke Tests

Run immediately after deployment completes. Smoke tests must pass before the observation window begins:

```sh
# Health check
curl -f <!-- https://service.example.com/api/v1/health -->

# Critical path check
<!-- curl / script / test command that exercises the most important user flow -->
```

Expected output: `{"status": "ok"}` and <!-- describe expected smoke test output -->.

If smoke tests fail, initiate rollback immediately — do not proceed to the observation window.

## Observation Window

Duration: <!-- 30 minutes --> minimum after a successful deploy.

Monitor during the window:
- Error rate (expected: < <!-- 0.1% --> of requests)
- P99 latency (expected: < <!-- 500ms -->)
- <!-- Business metric: e.g. orders being created, payments processing -->

Dashboard: `<!-- link to service dashboard -->`

Do not deploy another release to this service during the observation window.

## Rollback Trigger Criteria

Initiate rollback immediately if any of the following occur:

- Smoke tests fail
- Error rate rises above <!-- 1% --> and is not declining
- P99 latency doubles and is not declining
- A critical business flow stops functioning
- <!-- Service-specific trigger -->

## Rollback Procedure

```sh
# Rollback to the previous version
<!-- kubectl rollout undo deployment/<service-name> -->
<!-- # or: helm rollback <release> <revision> -->
<!-- # or: ./scripts/deploy.sh <previous-version> -->

# Verify rollback
curl -f <!-- https://service.example.com/api/v1/health -->
<!-- Run smoke tests again -->
```

Record the rollback in the change ticket with the time, reason, and deploying engineer.

## Post-Deploy

After the observation window completes successfully:

- [ ] Update the change ticket: deployment succeeded, observation window closed, metrics normal
- [ ] Post a brief update in the team channel: version deployed, no anomalies observed
- [ ] If any anomalies were observed but resolved: create a ticket for investigation
- [ ] If this was a hotfix: schedule a post-mortem (see `INCIDENT_RESPONSE.md`)

## Token Budget Class

Reference detail. Load on demand during deployments; search for the specific service runbook.

## Related Specs

- `RELEASE_PROCESS.md` — what must be complete before the deployment checklist begins.
- `CHANGE_MANAGEMENT.md` — approval gates for significant and high-risk changes.
- `INCIDENT_RESPONSE.md` — what to do if a deployment causes an incident.

## AI Agent Directives

This is a template. Fill in every `<!-- placeholder -->` before publishing as a governed runbook for a real service. Do not initiate a production deployment without completing the pre-flight checklist. If smoke tests fail, initiate rollback immediately — do not attempt to diagnose and fix forward without human approval. Record the deployment start time and the rollback decision (if any) in the change ticket.
