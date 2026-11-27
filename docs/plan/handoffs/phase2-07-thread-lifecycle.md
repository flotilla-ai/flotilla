# phase2-07: Thread lifecycle and collaboration

GOAL: Titles, archive/delete, membership, ownership, bulk operations, read state. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-07-thread-lifecycle
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/thread-lifecycle*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/thread-lifecycle*` only when this unit has UI rows
- `packages/**/thread-lifecycle*` only when this unit owns adapter/package behavior
- `scripts/test-thread-lifecycle*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-07-thread-lifecycle.md`
- `docs/runlog/phase2-07.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `ThreadLifecycle`, `ThreadMember`, `OwnershipTransfer`, `BulkThreadAction`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-017` — Auto titles (≤50 chars), rename, regenerate title; org/personal title instructions and 'regenerate when' setting. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-018` — Archive (dormant; events become context; message unarchives) / Unarchive without a run / Undo. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-019` — Bulk select: archive, tag, file, pin, delete; shift-click range. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-020` — Delete a thread (owner-only for private threads). Flotilla equivalent: Thread + event log + web UI; [TX] real hard delete locally.
- `CAPY-021` — Read / unread state, unread mention badge. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-022` — Join / leave / subscribe / unsubscribe a thread. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-023` — Take over a thread (become owner/driver). Flotilla equivalent: Thread + event log + web UI.
- `CAPY-024` — Transfer ownership from the share dialog. Flotilla equivalent: Thread + event log + web UI; [NOCLAUDE] owner's connections change; never move a user's vendor login to another user.
- `CAPY-473` — Archive idle threads after N days (skips pinned / open PR); off by default. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-474` — Mark all as read (incl. archived). Flotilla equivalent: Thread + event log + web UI.
- `CAPY-475` — Ask cost of a thread → tokens by kind, model and machine. Flotilla equivalent: Thread + event log + web UI; [CAP].

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-07.md`; never claim unrun behavior.

ROWS: CAPY-017, CAPY-018, CAPY-019, CAPY-020, CAPY-021, CAPY-022, CAPY-023, CAPY-024, CAPY-473, CAPY-474, CAPY-475
