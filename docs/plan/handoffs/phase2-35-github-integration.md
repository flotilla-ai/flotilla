# phase2-35: GitHub accounts and installations

GOAL: Multiple org/account links, commit identity, mention commands, permissions, unlinking. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-35-github-integration
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/github-integration*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/github-integration*` only when this unit has UI rows
- `packages/**/github-integration*` only when this unit owns adapter/package behavior
- `scripts/test-github-integration*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-35-github-integration.md`
- `docs/runlog/phase2-35.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `GitHubAccount`, `GitHubInstallation`, `CommitIdentity`, `PermissionSet`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-399` — Link many GitHub orgs/accounts; manage installations. Flotilla equivalent: GitHub App / PAT integration.
- `CAPY-400` — Connect personal GitHub account to act as you. Flotilla equivalent: GitHub App / PAT integration.
- `CAPY-401` — Commit author options (You+Capy co-author default, You, Capy+you, Capy); per-PR override; API pullRequestAuthor. Flotilla equivalent: GitHub App / PAT integration.
- `CAPY-402` — Commit email; signed commits with Capy-managed GPG key. Flotilla equivalent: GitHub App / PAT integration.
- `CAPY-403` — @capy <message> / @capy review on PRs; 👀 reaction. Flotilla equivalent: GitHub App / PAT integration.
- `CAPY-404` — Dependency reader app (read-only private deps). Flotilla equivalent: GitHub App / PAT integration.
- `CAPY-405` — App permission set (cannot install with fewer). Flotilla equivalent: GitHub App / PAT integration; Flotilla: request minimal scopes.
- `CAPY-518` — Admins can Unlink a GitHub account in Repository access. Flotilla equivalent: GitHub App / PAT integration.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-35.md`; never claim unrun behavior.

ROWS: CAPY-399, CAPY-400, CAPY-401, CAPY-402, CAPY-403, CAPY-404, CAPY-405, CAPY-518
