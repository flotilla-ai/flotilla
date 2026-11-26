# Flotilla phase 1 progress

Started: 2026-11-27 PKT.
Current `flotilla/p1` head: `65fff3d` after unit 01; unit branches update this file as they land.

| Unit | Status | Attempts | PR | Notes |
|---|---:|---:|---|---|
| 01-skeleton | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/2 | make check passed; compose healthz returned `ok` |
| 02-event-store | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/3 | real Postgres tests passed, including NOTIFY and SSE |
| 03-kernel-budget | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/4 | pure kernel tests passed; prices placeholder/unverified |

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

## Unverified items

None yet.

## Blocked units

None yet.
