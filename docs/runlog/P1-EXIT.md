# P1 exit verification

Measured in the session VM on 2026-11-27 PKT.

## Passed

- `make check` -> exit 0.
- `make verify` -> exit 0; compose health check printed `ok`.
- Fresh `docker compose up -d --build`: server, Postgres, and gate started; `/healthz` returned `ok`.
- First-run admin setup and login succeeded through `/api/v1/auth/setup` and `/api/v1/auth/login`.
- No-project fake thread in fresh compose completed. Event kinds observed in Postgres, in order: `thread.created user.message run.started cost.entry agent.delta run.ended`.
- That fake thread ended with status `waiting` and recorded usage `{ usd: 1000, machineSec: 0, cacheTokens: 0, inputTokens: 0, outputTokens: 0 }`.
- A second fake thread with `maxUsd: 500` ended `paused` with open approval `Budget cap reached (usd); raise the cap or stop`.
- Targeted git mirror, Captain tools, scheduler, and runner suites passed after the final review fixes.

## Not proven

- Real Claude or Codex login/CLI behavior.
- Real GitHub push, PR creation, webhook delivery, and autofix against live CI.
- Live allowlisted versus blocked egress from inside a long-running thread.
- End-to-end preview traffic through `:8081`.
- Captain relay creating five real crew containers and denying a sixth in a live Docker run.
- Database restart recovery of scheduler wake rows beyond unit-level coverage.

## Exact local smoke command

```sh
make check
make verify
```

For the interactive smoke, run `docker compose up -d --build`, use the printed first-run setup token in the UI, then create a fake-engine thread with no project and a small budget.
