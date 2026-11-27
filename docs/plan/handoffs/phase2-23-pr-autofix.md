# phase2-23: Pull requests and autofix

GOAL: PR settings/page/actions, no-CI wake, pull filters, sidebar PR status. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-23-pr-autofix
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/pr-autofix*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/pr-autofix*` only when this unit has UI rows
- `packages/**/pr-autofix*` only when this unit owns adapter/package behavior
- `scripts/test-pr-autofix*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-23-pr-autofix.md`
- `docs/runlog/phase2-23.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `PullRequestSettings`, `PullRequestView`, `MergeAction`, `AutofixWake`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-110` — Branch prefix setting ('release' reserved). Flotilla equivalent: GitHub integration + PR ownership + autofix loop.
- `CAPY-111` — Open PRs as Ready or Draft (org default + personal override, per-PR by asking). Flotilla equivalent: GitHub integration + PR ownership + autofix loop.
- `CAPY-112` — 'Open in Capy' button in PR description (toggle). Flotilla equivalent: GitHub integration + PR ownership + autofix loop.
- `CAPY-113` — Capy PR page at capy.ai/pull/<owner>/<repo>/<n>; Cmd+K by URL/owner/repo#n/title. Flotilla equivalent: GitHub integration + PR ownership + autofix loop.
- `CAPY-114` — Chat with Capy / New thread with PR from the PR page. Flotilla equivalent: GitHub integration + PR ownership + autofix loop.
- `CAPY-115` — Merge menu: squash / merge commit / rebase, comment, Update branch, Enable auto-merge, blocked reason. Flotilla equivalent: GitHub integration + PR ownership + autofix loop.
- `CAPY-117` — Merges/comments post as your connected GitHub account (else as Capy). Flotilla equivalent: GitHub integration + PR ownership + autofix loop.
- `CAPY-120` — No-CI repos: wake with a note ~30 min after last push. Flotilla equivalent: GitHub integration + PR ownership + autofix loop.
- `CAPY-123` — Review button in pull view: summary + comment / request changes / approve as you. Flotilla equivalent: GitHub integration + PR ownership + autofix loop.
- `CAPY-125` — Pulls page lists PRs of all installed repos; filters author:/repo:/status:/label:/since:. Flotilla equivalent: GitHub integration + PR ownership + autofix loop.
- `CAPY-126` — PR status on idle sidebar rows (Checks / PR failing / PR ready). Flotilla equivalent: GitHub integration + PR ownership + autofix loop.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-23.md`; never claim unrun behavior.

ROWS: CAPY-110, CAPY-111, CAPY-112, CAPY-113, CAPY-114, CAPY-115, CAPY-117, CAPY-120, CAPY-123, CAPY-125, CAPY-126
