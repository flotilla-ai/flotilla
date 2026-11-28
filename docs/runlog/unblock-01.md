# unblock-01 readme quickstart

Rows: none.

Measured on the VM (Linux, Docker available) at `flotilla/p1` `144219a`:
- `docker compose up -d --build --wait`: all services healthy.
- `curl localhost:8080/healthz`: `ok` (one connection reset in the first second after `--wait` returned; a retry answered).
- `docker compose logs server | grep "first-run setup token"`: 1 line.
- `POST /api/v1/auth/setup`: 201. `POST /api/v1/auth/login`: userId and csrfToken.
- `POST /api/v1/threads` with `engine.adapter=fake`: 201; `GET /api/v1/threads/:id/stream` events: thread.created, user.message, run.started, machine.state, cost.entry, agent.delta, run.ended.
- `GET /` on 8080: 200 text/html. `GET /` on 8081: 404 (listening, no preview).
- `make check`: exit 0 (server 55 files, 267 passed, 1 skipped; web 22 files, 38 passed).

Unverified: browser path for setup/login/thread; `claude auth login` and `codex login` (vendor accounts); real `GITHUB_TOKEN` / `FLOTILLA_PUBLIC_URL`; an opened preview on 8081.

`.gitignore` gains `!.env.example` because `.env*` was ignored. `.env.example` holds names only.
