# AGENTS.md

## Commands
- Test (done signal): `make check`
- Full: `make verify`
- Lint: `make lint`

## Hard rules
- Never push to or merge into main. Never force-push. Work on branch `flotilla/<unit>` and open PRs against `flotilla/p1` only.
- Never print, log, or commit secrets. `.env.example` lists names only, never values. Tests use a fake agent, recorded fixtures, or free models only.
- Do not touch files outside the unit's SCOPE. If you must, stop and report.
- Prove it by running it. Paste real command output; never claim "should work".
- Mark unknowns `unverified`. Never invent facts, flags, APIs, or numbers.

## Workspace
- Package names are locked: `@flotilla/server`, `@flotilla/gate`, `@flotilla/web`, `@flotilla/core`, `@flotilla/adapter-host`, `@flotilla/adapter-fake`, `@flotilla/adapter-generic-cli`, `@flotilla/adapter-claude-code`, `@flotilla/adapter-codex`.
- `@flotilla/core` uses subpath exports, not barrels.
- Server extension points are `src/routes/*.route.{ts,js}` and `src/modules/*.module.{ts,js}`; `*.test.*` and helpers are never loaded.
- All API routes live under `/api/v1`; `/healthz` is the only non-`/api/v1` route.
- Non-public routes are behind `requireSession`, which is fail-closed until unit 08.
- UI style: greys and black; orange only for "needs you"; no pill badges.

## Style
- Smallest diff that meets the done signal. Types and data shapes first. Delete dead code.
