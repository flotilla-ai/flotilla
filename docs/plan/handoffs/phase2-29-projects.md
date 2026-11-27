# phase2-29: Projects

GOAL: Repoless/private/multi-repo projects, lazy clones, identity, creation sources, descriptions. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-29-projects
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/projects*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/projects*` only when this unit has UI rows
- `packages/**/projects*` only when this unit owns adapter/package behavior
- `scripts/test-projects*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-29-projects.md`
- `docs/runlog/phase2-29.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `Project`, `ProjectRepository`, `ProjectIdentity`, `ProjectVisibility`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-177` — Repoless projects. Flotilla equivalent: Project (repo + defaults).
- `CAPY-178` — Primary vs lazy repositories (lazy clone on demand). Flotilla equivalent: Project (repo + defaults).
- `CAPY-179` — Auto one-sentence description of each repo from README/manifests. Flotilla equivalent: Project (repo + defaults).
- `CAPY-180` — Identity: name, icon/emoji, uppercase thread code. Flotilla equivalent: Project (repo + defaults).
- `CAPY-181` — New project from GitHub repo, folder on a machine, Git URL, or empty; suggests recently pushed repos. Flotilla equivalent: Project (repo + defaults); [BYOM] git URL support = other hosts possible in Flotilla.
- `CAPY-182` — Private projects. Flotilla equivalent: Project (repo + defaults).

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-29.md`; never claim unrun behavior.

ROWS: CAPY-177, CAPY-178, CAPY-179, CAPY-180, CAPY-181, CAPY-182
