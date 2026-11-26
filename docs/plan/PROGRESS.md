# Flotilla phase 1 progress

Started: 2026-11-27 PKT.
Current integration branch before final merge: `flotilla/p1` at `c0fcd7c9ee1737dc706c60c06a63f69cc1bd93c9` (units 01-15). Units 16-17 are on PR branches pending their final gates.

| Unit | Status | Attempts | PR | Notes |
|---|---:|---:|---|---|
| 01-skeleton | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/2 | `make check` and compose `/healthz` passed |
| 02-event-store | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/3 | real Postgres transaction/NOTIFY/SSE tests passed |
| 03-kernel-budget | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/4 | kernel tests passed; price table is placeholder |
| 04-adapter-host | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/5 | fake/generic fixture and process-group tests passed |
| 05-docker-driver | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/6 | local Docker integration passed |
| 06-claude-code-adapter | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/7 | fixture tests passed; live vendor login unverified |
| 07-codex-adapter | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/8 | fixture tests passed; live vendor CLI unverified |
| 08-auth-projects-api | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/9 | auth/project/read tests passed |
| 09-git-mirror | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/10 | local mirror tests passed; live GitHub unverified |
| 10-egress-gate | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/11 | gate unit tests passed; live proxied egress unverified |
| 11-thread-runner | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/12 | fake runner tests passed; compose fake run proven |
| 12-web-ui-core | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/13 | build and mocked Playwright passed |
| 13-web-ui-actions | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/16 | feature Playwright suite passed 6/6 |
| 14-github-autofix | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/15 | monitor/autofix unit tests passed; real GitHub unverified |
| 15-previews | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/14 | token tests passed; live end-to-end preview unverified |
| 16-captain-tools | branch-ready | 1 | https://github.com/flotilla-ai/flotilla/pull/17 | tool tests 2/2; live Captain relay unverified |
| 17-captain-scheduler | branch-ready | 1 | https://github.com/flotilla-ai/flotilla/pull/18 | scheduler tests 2/2; restart recovery partly unverified |

<<<<<<< HEAD
| 04-adapter-host | pending | 0 | | |
| 05-docker-driver | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/6 | docker integration passed on local Docker |
| 06-claude-code-adapter | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/7 | fixture parser tests passed; vendor fields synthetic/unverified |
| 07-codex-adapter | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/8 | fixture parser tests passed; vendor fields partly verified |
| 08-auth-projects-api | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/9 | targeted auth/project/read tests passed |
| 09-git-mirror | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/10 | local fake-driver tests passed; container/visibility unverified |
| 10-egress-gate | pending | 0 | | |
| 11-thread-runner | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/12 | fake adapter/db tests passed; Docker/captain coverage unverified |
| 12-web-ui-core  | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/13 | build and mocked Playwright passed; server-backed e2e unverified |
| 13-web-ui-actions | branch-ready | 0 | | feature e2e 6/6 passed; live backend screenshot unverified |
| 14-github-autofix | pending | 0 | | |
| 15-previews  | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/14 | token unit tests passed; live proxy integration unverified |
| 16-captain-tools | branch-ready | 0 | | captain tool tests 2/2 and make check passed; live relay unverified |
| 17-captain-scheduler | pending | 0 | | |
||||||| c0fcd7c
| 04-adapter-host | pending | 0 | | |
| 05-docker-driver | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/6 | docker integration passed on local Docker |
| 06-claude-code-adapter | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/7 | fixture parser tests passed; vendor fields synthetic/unverified |
| 07-codex-adapter | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/8 | fixture parser tests passed; vendor fields partly verified |
| 08-auth-projects-api | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/9 | targeted auth/project/read tests passed |
| 09-git-mirror | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/10 | local fake-driver tests passed; container/visibility unverified |
| 10-egress-gate | pending | 0 | | |
| 11-thread-runner | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/12 | fake adapter/db tests passed; Docker/captain coverage unverified |
| 12-web-ui-core  | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/13 | build and mocked Playwright passed; server-backed e2e unverified |
| 13-web-ui-actions | branch-ready | 0 | | feature e2e 6/6 passed; live backend screenshot unverified |
| 14-github-autofix | pending | 0 | | |
| 15-previews  | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/14 | token unit tests passed; live proxy integration unverified |
| 16-captain-tools | pending | 0 | | |
| 17-captain-scheduler | pending | 0 | | |
=======
## Verification highlights
>>>>>>> flotilla/17-captain-scheduler

Measured in this session:
- `make check` exits 0 on the current unit-17 branch.
- `make verify` exits 0 and prints `ok` from `curl -fsS localhost:8080/healthz`.
- Fresh compose: first-run admin setup and login succeeded.
- Fresh compose fake thread: `thread.created user.message run.started cost.entry agent.delta run.ended`; final thread status `waiting`; fake usage recorded as `1000` micro-USD.
- Fresh compose budget cap of 500 micro-USD: final thread status `paused`, open approval `Budget cap reached (usd); raise the cap or stop`.

## Unverified items / local commands

- Real Claude/Codex vendor login and JSON drift: run the adapter smoke commands in `docs/runlog/06-claude-code-adapter.md` and `docs/runlog/07-codex-adapter.md` on a machine with those CLI logins.
- Real GitHub push/PR/webhook/CI flow: set `GITHUB_TOKEN`, create a GitHub-backed project, run a fake thread, then inspect the opened PR and check events.
- Live egress behavior inside a running long-lived thread: create a project with `egressAllow`, run a thread, and compare `curl https://example.org` with an allowlisted host inside its container.
- Preview end-to-end: expose a port in a running thread, mint a preview token, open `http://localhost:8081/p/<code>/<port>/`, and confirm UI cookies alone are rejected.
- Captain live relay end-to-end: create a Captain against a test project and inspect crew rows plus `kernel.denied` for a sixth crew start.
- Scheduler database restart recovery is designed through durable wake rows but has only unit-level coverage.

## Blocked units

None.

## Safety audit

- No pushes to `main`; all integration went to `flotilla/p1` or unit branches.
- No force-pushes or branch deletions.
- No paid vendor API calls, Ollama, or real vendor logins were used.
- `.env.example` contains names only; no secret values were committed.
- Dependency licenses are permissive; no AGPL/GPL runtime dependency was added intentionally.
- Captain run tokens are random 32-byte values stored only as hashes in memory and revoked at run end.

## Morning summary

Phase 1 implementation is effectively complete through unit 17 on the integration branches, with units 01-15 already on `flotilla/p1` and units 16-17 pending final PR gate/merge at the time this file was written. The system can boot with compose, create the first admin, execute a fake Docker-backed thread, stream/persist events, and pause on a hard budget approval. The largest remaining risks are integration surfaces that require real external systems: vendor CLIs, GitHub credentials/webhooks, live preview traffic, and long-running Captain/crew behavior. `flotilla/p1` should not be merged to `main` until those are accepted or locally smoke-tested.
