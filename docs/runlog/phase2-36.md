# phase2-36 usage, budgets and API models

Branch `flotilla/phase2-36-usage-billing-api` from `origin/flotilla/p1` (`eba906f`), then real-merged `6b5546a` (repair-10/repair-12). Fake/scripted adapters, temporary Postgres 16 container. No vendor calls or logins.

## Rows
- done: CAPY-341, CAPY-346, CAPY-352, CAPY-353, CAPY-481, CAPY-635, CAPY-636, CAPY-637, CAPY-639.

## Changes
- `apps/server/src/db/migrations/0023_usage_billing.sql`: `usage_settings` (org `run_out_free`, `machine_rates` µ$/min per runner type), `usage_budgets` (global/project, `month`|`lifetime`, maxUsd, warnAt), `cost_entries` attribution columns + `BEFORE INSERT` trigger that stamps owner/project/connection/billing item/runner type and prices `machine-estimate` rows; backfill for existing rows.
- `apps/server/src/usage-billing-api/store.ts`: `UsageReport`, `UsageSeries`, `BudgetWindow`, `MachineMinute`; report/series/balance/budgets/settings and the pre-run window gate.
- `apps/server/src/routes/usage-billing-api.route.ts`: `GET /usage`, `GET /usage/series`, `GET /usage/balance`, `PUT /usage/budgets`, `GET|PUT /usage/settings` under `/api/v1` (session or API key; writes admin-only).
- `apps/server/src/runner/runner.ts`: exported `runGates`; the first gate reason pauses the run with the existing budget approval.
- `apps/server/src/models-catalog/store.ts`: `onRunOut` never switches onto free models silently; `runOutFree: 'never'` removes the free option.
- `apps/web/src/features/usage-billing-api/index.tsx`: `/usage` page (window spend/tokens, budget windows, by member/model/thread/billing item).
- `CAPY-639` reuses phase2-04 `GET /api/v1/models`; the new test proves it with a bearer API key.

## Red first
`npx vitest run src/usage-billing-api` with the test file only (store/route/migration moved aside, runner/catalog edits stashed):
```
   × CAPY-341 ... → expected 404 to be 403
   × CAPY-352/353/635 ... → expected undefined to be 'month'
   × CAPY-353/636 ... → expected { error: 'route not found', …(1) } to match object { bucket: 'day', by: 'member' }
   × CAPY-346/637 ... → expected 404 to be 403
   × CAPY-481 ... (5002 ms timeout waiting for a run-out card; inferred cause: keep-going switched to free without asking)
   × CAPY-639 ... → expected 404 to be 200
      Tests  6 failed (6)
```
CAPY-639 failed only on its last assertion (`/usage/balance` with the API key); the `/models` part already existed.

## Focused (after merge)
```
 ✓ src/usage-billing-api/usage-billing-api.test.ts (6 tests) 2857ms
 Test Files  1 passed (1)
      Tests  6 passed (6)
 ✓ src/features/usage-billing-api/usage-billing-api.test.tsx (1 test) 24ms
      Tests  1 passed (1)
```

## Done signal (after merge)
`pnpm --filter @flotilla/server test` (before merge): `Test Files 24 passed (24)`, `Tests 152 passed | 1 skipped (153)`.
`make check` (after merge, exit 0): server `Test Files 24 passed (24)`, `Tests 153 passed | 1 skipped (154)`; gate 5, core 15, web 17, host 3, codex 5, claude-code 7, generic-cli 4, fake 3 passed.
`pnpm -r lint`: exit 0.

## Devin Review round 1
Fixed:
- Deleted-thread spend is kept in `usage_tombstones`.
- The thread cap is checked against the ledger.
- Raise on a shared cap no longer overwrites the thread cap.
- An old free offer is refused after `runOutFree: 'never'`.
- Private titles in the report are shown only to the current owner.

All five are covered by new assertions in `usage-billing-api.test.ts`.

Escalated: machine time is sampled every 10 s by the runner ticker, so a run shorter than its first sample has no machine cost. This belongs to phase2-12 machine core metering.

Re-run: `npx vitest run src/usage-billing-api src/thread-lifecycle src/runner src/models-catalog` gave `Test Files 6 passed (6)` and `Tests 51 passed (51)`.

## Unverified
- Runs shorter than the 10 s machine ticker get no machine cost (escalated to phase2-12).
- Machine minutes are priced per runner type `pool` (the only type until phase2-12 machine core records sizes); no real machine sizes are metered here.
- `/usage` is proven by a render test, not a browser e2e.
- Real vendor run-out detection is CAPY-333 (`needs-human-login`); CAPY-481 is proven with a scripted `run_out` adapter. Operator check with a real Claude subscription: `pnpm --filter @flotilla/server exec vitest run src/usage-billing-api` covers the fixture path; for live, sign in with `claude login` in a thread machine, exhaust the subscription, and confirm the run-out card shows `Use Flotilla free models` instead of switching.
- No auto-reload, credits or invoices (Flotilla has no billing); CAPY-346 is the monthly cap window only.
