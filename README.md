# Flotilla

Flotilla is an open-source, self-hostable rebuild of [Capy](https://capy.ai): threads where coding agents work on isolated machines (Docker containers), with projects, pull requests, reviews, Captains and automations, all on your own host.

Status: pre-release on branch `flotilla/p1`. Row-by-row parity is tracked in `docs/plan/PARITY.md`.

## Requirements

- Docker with Compose v2 (the server talks to the Docker socket to start thread machines)
- 4+ GB of free RAM
- git

## Quickstart

```sh
git clone https://github.com/flotilla-ai/flotilla.git
cd flotilla
docker compose up -d --build --wait
curl localhost:8080/healthz        # prints: ok
```

The first build takes several minutes (it builds the server image and the thread image).

### 1. Create the admin

The server prints a one-time setup token on first start:

```sh
docker compose logs server | grep "first-run setup token"
```

Use it in the web UI at <http://localhost:8080>, or with the API:

```sh
curl -X POST localhost:8080/api/v1/auth/setup \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"<password>","token":"<setup token>"}'
```

It answers `201` once; after that the endpoint answers `409 setup complete`.

### 2. Log in

In the web UI, or with the API (the session is a cookie; writes also need the CSRF token from the login response):

```sh
curl -c jar -X POST localhost:8080/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"<password>"}'
# {"userId":"usr_...","csrfToken":"..."}
```

### 3. Create a thread with the `fake` adapter and watch it stream

The `fake` adapter is a scripted agent: no model, no account, no cost. It is the default engine.

```sh
curl -b jar -X POST localhost:8080/api/v1/threads \
  -H 'content-type: application/json' -H 'x-flotilla-csrf: <csrfToken>' \
  -d '{"title":"hello","prompt":"say hello","engine":{"adapter":"fake"}}'
# {"id":"thr_...","status":"queued",...}

curl -N -b jar localhost:8080/api/v1/threads/<thread id>/stream
# event: thread.created, user.message, run.started, machine.state, cost.entry, agent.delta, run.ended
```

## Ports

| Port | Use |
|---|---|
| 8080 | web UI and API |
| 8081 | previews of ports opened inside thread machines |

## Optional configuration

Names only; see `.env.example`. None is needed for the quickstart.

| Variable | Use |
|---|---|
| `GITHUB_TOKEN` | GitHub personal access token for repos and pull requests |
| `FLOTILLA_PUBLIC_URL` | public base URL of the server, used in links and OAuth callbacks |
| `FLOTILLA_MASTER_KEY_FILE` | path of the secrets vault master key (compose sets it; generated on first use) |
| `FLOTILLA_DOMAIN` | host name used to build UI and preview URLs (compose sets `localhost`) |

## Claude and Codex

Flotilla runs the official, unmodified `claude` and `codex` CLIs, which are installed in the thread image. You log each one in with your own account, using the CLI's own flow: `claude auth login` and `codex login`. Flotilla never stores or proxies Claude.ai session tokens. If a thread fails before the first agent message, see "Codex or Claude needs reconnecting" in `docs/TROUBLESHOOTING.md`.

## Development

```sh
corepack enable && pnpm install
make check     # typecheck, tests, lint (server tests start throwaway postgres:16 containers)
make verify    # make check, then build the thread image, compose up, /healthz, compose down
```

## What was verified

Measured on a Linux VM on 2026-11-28, on `flotilla/p1` at `144219a`: `docker compose up -d --build --wait`, `/healthz` printing `ok`, the setup token line in the server log, `POST /api/v1/auth/setup` (201), login, creating a `fake` thread and its event stream ending in `run.ended`, and `GET /` on 8080 returning the web UI HTML.

Unverified:
- Admin setup, login and thread creation through the web UI in a browser (only the API path was run).
- `claude auth login` and `codex login` (they need a real vendor account).
- `GITHUB_TOKEN` and `FLOTILLA_PUBLIC_URL` with real values.
- Previews on 8081 (the port answers; no preview was opened).

## More

- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- [docs/plan/](docs/plan/): spec, parity ledger, progress, decisions
