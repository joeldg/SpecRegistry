# Install and Run

SpecRegistry can be run three ways:

- **Local development** — server and Vite web UI in separate processes.
- **Production-style Node** — built server serves both the API and built web UI.
- **Docker Compose** — containerized app with persistent SQLite storage and optional Grafana Alloy.

Prerequisites:

- Node.js 20+
- npm
- Docker + Docker Compose, only for container deployments

## Local development

```sh
npm install
cp .env.example .env
npm run build

# Development: API on :4000 (auto-seeds Acme demo data on first run)
npm run dev:server
# In another terminal: web UI on :5173, proxying /api to :4000
npm run dev:web
```

Open the dashboard at `http://localhost:5173`. API calls are proxied to
`http://localhost:4000`.

The development server seeds Acme demo data into `specregistry.db` the first time it
starts. Delete that file if you want a fresh local registry.

The server loads `.env` automatically for local `npm run dev:server`,
`npm run seed`, and `node packages/server/dist/index.js` runs. Real process
environment variables take precedence over values in `.env`.

## Production-style Node

Production-style: after `npm run build`, `node packages/server/dist/index.js` serves
both the API and the built web UI on port 4000 (`PORT` / `SPECREG_DB` env vars override
the defaults; the SQLite file defaults to `./specregistry.db`). Values can also be placed
in `.env` at the repository root.

```sh
npm install
npm run build
PORT=4000 SPECREG_DB=/var/lib/specregistry/specregistry.db node packages/server/dist/index.js
```

For a server install, set `SPECREG_PUBLIC_URL` to the externally reachable URL, or configure
the public hostname in **Settings > Integrations > Server reachability**. Generated agent
packs, MCP guides, and `.mcp.json` examples use that value.

```sh
SPECREG_PUBLIC_URL=https://specs.example.com node packages/server/dist/index.js
```

## Validate the Build

```sh
npm test   # server API suite (vitest)
```

## Docker Install

For a containerized registry:

```sh
cp .env.example .env
# set SPECREG_PUBLIC_URL, or configure Server reachability in Settings after startup
docker compose up --build
```

`SPECREG_PUBLIC_URL` is important for server deployments. Agent packs and MCP guide
content use it when generating `.mcp.json` and `SPECREGISTRY_MCP_SKILL.md`. If omitted,
the server uses the saved public hostname from Settings, then forwarded request headers,
then the server's detected non-loopback IP address.
Persisted SQLite data lives in the `specregistry-data` Docker volume by default.

Example `.env` for an internal server:

```dotenv
PORT=4000
SPECREG_PUBLIC_URL=https://specs.example.com
SPECREG_AUTH=required
SPECREG_ADMIN_PASSWORD=change-this
SPECREG_DB=/data/specregistry.db
```

Run it:

```sh
docker compose up --build -d
docker compose logs -f specregistry
```

Stop it:

```sh
docker compose down
```

Reset local container data:

```sh
docker compose down -v
```

## Metrics and Grafana Alloy

SpecRegistry exposes Prometheus text metrics at `GET /metrics`. The endpoint is public
so Prometheus/Grafana Alloy can scrape it even when `SPECREG_AUTH=required`.

Run the registry only:

```sh
docker compose up --build
```

Run with Grafana Alloy scraping `/metrics` and remote-writing upstream:

```sh
GRAFANA_REMOTE_WRITE_URL=https://prometheus-prod-xx.grafana.net/api/prom/push \
GRAFANA_REMOTE_WRITE_USERNAME=<instance-id> \
GRAFANA_REMOTE_WRITE_PASSWORD=<api-token> \
docker compose --profile metrics up --build
```

The Alloy service reads [config/alloy/config.alloy](../config/alloy/config.alloy), scrapes
`specregistry:4000/metrics`, and forwards samples to the configured remote-write endpoint.
For the full metric catalog and source queries, see
[metrics reference](../README-METRICS.md).

## First-Time Setup

1. Start the server by using the local, Node, or Docker path above.
2. Open the dashboard.
3. Sign in with the default admin account: **username `admin`, password `admin`**.
   Override the default password with `SPECREG_ADMIN_PASSWORD` in `.env` or the environment.
   Change the password after first login via **Settings → Users → Reset password**.
4. Create or edit reusable baselines under **Baselines**. Use one global project type for organization-wide specs.
5. Add concrete repositories under **Projects** so repo-specific specs stay project-scoped instead of taking over a baseline.
6. Add spec files such as `DESIGN.md`, `STRUCTURE.md`, `API.md`, or domain-specific docs.
7. Publish initial drafts once they are ready to become governed contracts.
8. Configure templates, compliance policies, approval policies, subscriptions, LDAP, and integrations as needed.
9. Install or link the CLI as shown in [Developer Guide](DEVELOPER_GUIDE.md), then have each
   repository initialize its approved specs and agent MCP config.
