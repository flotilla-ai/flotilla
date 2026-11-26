# UNIT 01: Repo skeleton, compose, core types, module loader
GOAL: Create the pnpm TypeScript monorepo with every P1 workspace package stubbed under its final name, `make check`, the final P1 docker compose (postgres + server + gate, internal networks), a server that auto-loads route and lifecycle modules and answers `/healthz`, and the SPEC §4-§5a types as a compile-only module.
BRANCH: flotilla/01-skeleton   PR TARGET: flotilla/p1 (never main)
REPO: flotilla-ai/flotilla
DEPENDS ON: none (first unit). Base branch `flotilla/p1` contains only README/LICENSE plus the plan files listed in handoffs/README.md step 1.
SCOPE (you own only these paths): `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `Makefile`, `AGENTS.md`, `.gitignore`, `.env.example`, `LICENSE` (MIT), `THIRD_PARTY_NOTICES.md`, `docker-compose.yml`, `deploy/server.Dockerfile`, `pnpm-lock.yaml`, `.github/workflows/check.yml`, `docs/runlog/01-skeleton.md`, `apps/server/{package.json,tsconfig.json,src/index.ts,src/loader.ts,src/loader.test.ts,src/routes/healthz.route.ts,src/auth/requireSession.ts}`, `apps/gate/{package.json,tsconfig.json,src/main.ts}`, `packages/core/{package.json,tsconfig.json,src/types.ts,src/schemas.ts,src/types.test.ts}`, and a stub `package.json` + `src/index.ts` (one `export {}` line) for each of `packages/adapters/{host,fake,generic-cli,claude-code,codex}`.
OUT OF SCOPE: Any business logic, DB schema, adapters, UI, real auth, the real gate proxy. No Caddy, no pg-boss (P2). Don't create `apps/web` (unit 12 owns it).
SHAPES:
- Copy every `ts` block of SPEC.md §4 and §5a **verbatim** into `packages/core/src/types.ts` (exported). `scripts/check_spec_ts.py` in the plan proves they compile together under `tsc --strict`. Add zod schemas only for `Event` and `Approval` in `src/schemas.ts`.
- **Package names (locked; use exactly these everywhere):** `@flotilla/server` (apps/server), `@flotilla/gate` (apps/gate), `@flotilla/web` (apps/web, created by unit 12), `@flotilla/core`, `@flotilla/adapter-host`, `@flotilla/adapter-fake`, `@flotilla/adapter-generic-cli`, `@flotilla/adapter-claude-code`, `@flotilla/adapter-codex`. `pnpm-workspace.yaml` = `apps/*`, `packages/*`, `packages/adapters/*`.
- **`@flotilla/core` subpath exports, no barrels:** `"exports": { "./types": "./src/types.ts", "./schemas": "./src/schemas.ts", "./kernel/*": "./src/kernel/*.ts" }` (plus matching built `dist` conditions if you compile). Later units add kernel files without touching any index file.
- **Server loader (`src/loader.ts`, used by `src/index.ts`):** loads only files matching `src/routes/*.route.{ts,js}` and `src/modules/*.module.{ts,js}`, never `*.test.*` or `*.d.ts`, working from both `src` (tsx/vitest) and `dist` (node). A route file default-exports `{ basePath: string; app: Hono; public?: boolean }`; non-public routes are mounted behind `requireSession` from `src/auth/requireSession.ts`. A module file default-exports `{ name: string; start(ctx: { log: Logger; env: NodeJS.ProcessEnv }): Promise<() => Promise<void>> }` (background loops, extra listeners such as :8081/:8082, subscribers); `index.ts` starts all modules and calls their stop functions on SIGTERM. All API routes live under `/api/v1/…`; `/healthz` is the only non-`/api/v1` route.
- **`requireSession` stub is fail-closed:** it returns 401 for every request. Unit 08 owns this file afterwards and replaces the body. Route tests in other units test their sub-app directly.
- **Gate stub (`apps/gate/src/main.ts`):** listens on `:3128` and answers every request `403 gate: not implemented` (fail closed). Unit 10 owns `apps/gate/**` afterwards.
DONE SIGNAL:
```
make check            # = pnpm -r typecheck && pnpm -r test && pnpm -r lint ; exit 0
docker compose up -d --build --wait && curl -fsS --retry 20 --retry-connrefused --retry-delay 1 localhost:8080/healthz ; docker compose down -v
```
EXPECTED: `make check` exits 0 with at least 2 test files run, including `loader.test.ts` proving: a `x.route.ts` mounts under its basePath, a non-public route returns 401 via the stub, a `x.module.ts` is started and stopped, and `x.route.test.ts` / `helper.ts` are ignored. curl prints exactly `ok`. `docker compose config --services` prints exactly `gate`, `postgres`, `server` (any order); `docker compose config` shows networks `db` and `edge` with `internal: true`, postgres only on `db`, gate not on `db`, and port 8082 not published. `docker compose up` works with no `.env` file: Postgres's password comes from a generated Docker secret or `POSTGRES_HOST_AUTH_METHOD=trust` on the internal `db` network, never a committed value; postgres has a `pg_isready` healthcheck and server waits on `service_healthy`.
DIFF BUDGET: ≤ 34 files / ≤ 1,100 changed lines (types file is most of it; lockfile not counted)

## Context
- Read first: `AGENTS.md`, `SPEC.md` §4, §5a, §6a ("Network"), §11 (compose shape), `ROADMAP.md` Phase 1 table.
- **Shared files, so later units never collide:** later units add `*.route.ts` / `*.module.ts` files and never edit `apps/server/src/index.ts`, `loader.ts`, `apps/server/package.json`, `docker-compose.yml` or `deploy/server.Dockerfile`. So pre-add now to `apps/server/package.json` — dependencies: `@flotilla/core`, all five `@flotilla/adapter-*` (all `workspace:*`), `hono`, `@hono/node-server`, `zod`, `drizzle-orm`, `pg`, `dockerode`, `@modelcontextprotocol/sdk`; devDependencies: `drizzle-kit`, `msw`, `vitest`, `typescript`, `tsx`, `@types/node`, `@types/pg`, `@types/dockerode`. Check each license is MIT/Apache-2.0/BSD/ISC and list them in `THIRD_PARTY_NOTICES.md`. Password hashing uses Node's built-in `crypto.scrypt` (no dependency). Playwright belongs to `apps/web` (unit 12); a unit may add deps only to a `package.json` inside its own SCOPE.
- `docker-compose.yml`: copy the P1 shape in SPEC.md §11 (postgres, server, gate; networks `db`/`edge` internal; server publishes 8080 and 8081 only). The gate uses the server image with `command: ["node","apps/gate/dist/main.js"]`, so `deploy/server.Dockerfile` must build every workspace package. Include the `gate-secret` volume (rw in server, ro in gate) exactly as in §11; unit 10 fills it.
- Node 22, pnpm workspaces, vitest, TypeScript strict, ESLint or oxlint (pick one, note why).
- `AGENTS.md`: copy the starter from DEVIN-PLAYBOOK.md §2 (commands + hard rules), add the package names, the `*.route.ts` / `*.module.ts` conventions and "all routes under `/api/v1`", and keep it under 16 KiB.
- `.github/workflows/check.yml`: pushing workflow files needs the GitHub app's *workflows* permission. If the push is rejected for that reason, drop the file from this PR, say so, and leave it for mehdi.
- **First thing in the session** (paste output in the runlog): `docker compose version`; `docker run --rm hello-world`; `docker network create --internal flt-probe && docker run --rm --network flt-probe busybox wget -T 3 -q -O- http://1.1.1.1 ; echo "exit=$?" ; docker network rm flt-probe` (expect a non-zero exit: internal networks have no route out). If Docker doesn't work inside your VM, still finish everything else and mark the compose check `unverified (no docker in VM)`; mehdi then decides where Docker integration tests run (handoffs/README.md, pre-launch check P1).

## Rules (hard)
- Work on branch `flotilla/01-skeleton` created from `flotilla/p1` on `flotilla-ai/flotilla`. Push the branch and open a PR against `flotilla/p1` titled "01-skeleton: Repo skeleton, compose, core types, module loader" with: goal, diff summary, pasted test output, unverified items (DEVIN-PLAYBOOK.md §3b). Then **stop for mehdi's review**; he reviews and merges himself. Never push to `main` or `flotilla/p1`, never merge any PR (including your own), never force-push, never enable auto-merge. Do not file issues or comment on other PRs.
- Tests use the `fake` adapter, recorded fixtures, or free models only. No paid API calls, no Ollama, no real vendor logins.
- Never print, log or commit secrets. `.env.example` lists names only, never values.
- Touch only the files in SCOPE. If you must touch anything else, stop and report.
- Write the failing test for the DONE SIGNAL first, then the smallest change that passes. Types before logic (SPEC.md §4). Delete dead code.
- Prove it: paste the real command output. Mark anything you couldn't check "unverified". Never invent facts, numbers or APIs; if a vendor flag isn't in the docs cited here, say so.
- Licenses: only MIT / Apache-2.0 / BSD / ISC dependencies. No AGPL. Note any copied code in `THIRD_PARTY_NOTICES.md` with its license.

## Report back (final message)
1. 5 lines: what you built, done signal result, `make check` tail.
2. `git diff --stat flotilla/p1...flotilla/01-skeleton`.
3. Structured: `{branch, pr_url, tests_passed, summary, unverified[]}`.
4. Decisions you made (from `docs/runlog/01-skeleton.md` DECISIONS) and anything left unverified.
