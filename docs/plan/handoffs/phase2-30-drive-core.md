# phase2-30: Drive storage core

GOAL: Scoped Drive items, mounting, uploads, versions, storage limits, failure cards. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-30-drive-core
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/drive-core*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/drive-core*` only when this unit has UI rows
- `packages/**/drive-core*` only when this unit owns adapter/package behavior
- `scripts/test-drive-core*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-30-drive-core.md`
- `docs/runlog/phase2-30.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `DriveItem`, `DriveScope`, `DriveVersion`, `DriveMount`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-272` — Drive scopes: Organization, Personal, Project, Project+personal, Automation, per-Captain. Flotilla equivalent: DriveItem store (Postgres + files volume), mounted into threads; [TX] stored on self-host.
- `CAPY-273` — Drive root AGENTS.md supplies instructions to its scope. Flotilla equivalent: DriveItem store (Postgres + files volume), mounted into threads.
- `CAPY-274` — Drive skills at skills/<name>/SKILL.md. Flotilla equivalent: DriveItem store (Postgres + files volume), mounted into threads.
- `CAPY-275` — Save/update files by asking; autosave without git commit. Flotilla equivalent: DriveItem store (Postgres + files volume), mounted into threads.
- `CAPY-276` — Drive page: browse, edit, upload (32 MB per upload), delete. Flotilla equivalent: DriveItem store (Postgres + files volume), mounted into threads.
- `CAPY-277` — Local threads get a copy in ~/.capy/drive/; no background sync. Flotilla equivalent: DriveItem store (Postgres + files volume), mounted into threads; [BYOM].
- `CAPY-278` — History + Restore (versions kept 24 h). Flotilla equivalent: DriveItem store (Postgres + files volume), mounted into threads; Flotilla: longer/unbounded history (git-backed?).
- `CAPY-279` — Storage limits by plan; 100 MiB per file; 'Drive is full' card. Flotilla equivalent: DriveItem store (Postgres + files volume), mounted into threads.
- `CAPY-502` — Drive can grow past 2 GiB up to plan storage. Flotilla equivalent: DriveItem store (Postgres + files volume), mounted into threads.
- `CAPY-503` — Drive save/mount failure card explains next step. Flotilla equivalent: DriveItem store (Postgres + files volume), mounted into threads.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-30.md`; never claim unrun behavior.

ROWS: CAPY-272, CAPY-273, CAPY-274, CAPY-275, CAPY-276, CAPY-277, CAPY-278, CAPY-279, CAPY-502, CAPY-503
