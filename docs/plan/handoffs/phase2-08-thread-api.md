# phase2-08: Thread lifecycle API

GOAL: REST verbs for rename/archive/read/join/subscribe/takeover/title regeneration. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-08-thread-api
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/thread-api*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/thread-api*` only when this unit has UI rows
- `packages/**/thread-api*` only when this unit owns adapter/package behavior
- `scripts/test-thread-api*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-08-thread-api.md`
- `docs/runlog/phase2-08.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `ThreadMutation`, `ThreadReadState`, `ThreadMembershipMutation`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-544` — Rename thread. Flotilla equivalent: Public REST + SSE API.
- `CAPY-545` — Archive thread. Flotilla equivalent: Public REST + SSE API.
- `CAPY-546` — Unarchive thread. Flotilla equivalent: Public REST + SSE API.
- `CAPY-547` — Take over thread. Flotilla equivalent: Public REST + SSE API.
- `CAPY-548` — Regenerate thread title. Flotilla equivalent: Public REST + SSE API.
- `CAPY-549` — Read. Flotilla equivalent: Public REST + SSE API.
- `CAPY-550` — Unread. Flotilla equivalent: Public REST + SSE API.
- `CAPY-551` — Join. Flotilla equivalent: Public REST + SSE API.
- `CAPY-552` — Leave. Flotilla equivalent: Public REST + SSE API.
- `CAPY-553` — Subscribe. Flotilla equivalent: Public REST + SSE API.
- `CAPY-554` — Unsubscribe. Flotilla equivalent: Public REST + SSE API.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-08.md`; never claim unrun behavior.

ROWS: CAPY-544, CAPY-545, CAPY-546, CAPY-547, CAPY-548, CAPY-549, CAPY-550, CAPY-551, CAPY-552, CAPY-553, CAPY-554
