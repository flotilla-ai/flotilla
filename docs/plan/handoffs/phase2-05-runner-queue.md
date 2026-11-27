# phase2-05: Durable runner queue and steer modes

GOAL: Persistent inbox, steer/queue/edit semantics, provider retry, plan gate, codemode event display. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-05-runner-queue
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/runner-queue*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/runner-queue*` only when this unit has UI rows
- `packages/**/runner-queue*` only when this unit owns adapter/package behavior
- `scripts/test-runner-queue*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-05-runner-queue.md`
- `docs/runlog/phase2-05.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `ThreadInboxItem`, `DeliveryMode`, `MessageVersion`, `PlanGate`, `AdapterError`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-004` — Steer delivery mode: message reaches agent at its next step (Enter). Flotilla equivalent: Thread + event log + web UI; [ADP] needs adapter 'inject at next step'; fallback = queue.
- `CAPY-009` — Edit a queued/steered message before the agent reads it; send now / discard / return to composer. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-010` — Edit a sent message; thread continues from new version with a version switcher. Flotilla equivalent: Thread + event log + web UI; [ADP] requires fork/rewind support per adapter; else start new session from edited message.
- `CAPY-026` — Context meter + 'Compact at' per thread, org default. Flotilla equivalent: Thread + event log + web UI; [ADP] compaction is harness-specific; expose only where adapter supports.
- `CAPY-465` — /plan prefix: explore and ask first, change nothing until plan approved (Slack, Linear, API too). Flotilla equivalent: Thread + event log + web UI; docs FAQ F:L2251 still says no plan mode; changelog is newer. Flotilla: first-class plan gate.
- `CAPY-466` — /btw opens a side thread like /side; hold Alt+M to talk. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-467` — Send while a file is still uploading; goes out after upload, survives reload. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-468` — Two or more queued messages fold behind a count above composer. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-469` — Retry on provider error with no message to type; error card offers Retry or another model on own key. Flotilla equivalent: Thread + event log + web UI; [ADP] adapter error taxonomy needed.
- `CAPY-470` — Request cards: Later / Dismiss, synced across devices; Captain gathers crew questions with Dismiss all. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-476` — Codemode: agent writes programs that call tools; inner tool calls shown live. Flotilla equivalent: Thread + event log + web UI; [ADP] native-engine feature; adapters show inner tool calls if CLI emits them.
- `CAPY-601` — Versions. Flotilla equivalent: Public REST + SSE API; [TX] served from Flotilla's own store.
- `CAPY-603` — Cancel queued message. Flotilla equivalent: Public REST + SSE API; [TX] served from Flotilla's own store.
- `CAPY-604` — Send queued message now. Flotilla equivalent: Public REST + SSE API; [TX] served from Flotilla's own store.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-05.md`; never claim unrun behavior.

ROWS: CAPY-004, CAPY-009, CAPY-010, CAPY-026, CAPY-465, CAPY-466, CAPY-467, CAPY-468, CAPY-469, CAPY-470, CAPY-476, CAPY-601, CAPY-603, CAPY-604
