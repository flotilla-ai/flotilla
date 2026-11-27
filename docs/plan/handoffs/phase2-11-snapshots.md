# phase2-11: Machine snapshots

GOAL: Post-setup image capture, tier validation, scrub verification, build history. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-11-snapshots
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/snapshots*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/snapshots*` only when this unit has UI rows
- `packages/**/snapshots*` only when this unit owns adapter/package behavior
- `scripts/test-snapshots*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-11-snapshots.md`
- `docs/runlog/phase2-11.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `SnapshotSpec`, `SnapshotBuild`, `SnapshotTier`, `SnapshotStepLog`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-192` — Snapshots: post-setup filesystem baked into bootable image; hourly rebuild check. Flotilla equivalent: Machine image + setup script + container snapshot (docker commit); [BYOM] Docker image layers / devcontainer equivalent.
- `CAPY-193` — Choose repos in snapshot; disk-budget validation. Flotilla equivalent: Machine image + setup script + container snapshot (docker commit).
- `CAPY-194` — Snapshot disk tiers 64/128/256 GB; 'also snapshot smaller sizes'. Flotilla equivalent: Machine image + setup script + container snapshot (docker commit).
- `CAPY-195` — Secrets in builds scrubbed and verified before capture. Flotilla equivalent: Machine image + setup script + container snapshot (docker commit).
- `CAPY-196` — Snapshot build history with per-step logs; ask why it failed. Flotilla equivalent: Machine image + setup script + container snapshot (docker commit).
- `CAPY-197` — Setup script failure doesn't block boot; agent repairs. Flotilla equivalent: Machine image + setup script + container snapshot (docker commit).

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-11.md`; never claim unrun behavior.

ROWS: CAPY-192, CAPY-193, CAPY-194, CAPY-195, CAPY-196, CAPY-197
