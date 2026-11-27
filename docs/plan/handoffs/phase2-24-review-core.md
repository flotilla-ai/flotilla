# phase2-24: Review agent core

GOAL: Head-pinned read-only review threads, findings, rounds, effort, triage, incremental state. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-24-review-core
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/review-core*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/review-core*` only when this unit has UI rows
- `packages/**/review-core*` only when this unit owns adapter/package behavior
- `scripts/test-review-core*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-24-review-core.md`
- `docs/runlog/phase2-24.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `ReviewRun`, `ReviewFinding`, `ReviewRound`, `ReviewTriage`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-130` — Dedicated review agent in a real checkout at the PR's exact head. Flotilla equivalent: Review agent = a read-only Thread on the PR head; [ADP] review agent = any adapter + review prompt.
- `CAPY-131` — Findings: category Bug/Risk/Maintainability/Refactor, severity High/Med/Low, confidence confirmed/investigate, file+line. Flotilla equivalent: Review agent = a read-only Thread on the PR head.
- `CAPY-132` — Notes: anchored observations with no failure. Flotilla equivalent: Review agent = a read-only Thread on the PR head.
- `CAPY-133` — Per-repo automatic mode Off / Once / Every push. Flotilla equivalent: Review agent = a read-only Thread on the PR head.
- `CAPY-134` — Start review from PR page, '@capy review <instructions>', or API. Flotilla equivalent: Review agent = a read-only Thread on the PR head.
- `CAPY-135` — Push during review starts a fresh round. Flotilla equivalent: Review agent = a read-only Thread on the PR head.
- `CAPY-136` — Effort tiers Low/Med/High = 1/5/10 credits; Flex (first Medium, follow-ups Low). Flotilla equivalent: Review agent = a read-only Thread on the PR head; [CAP] reviews count against hard caps too.
- `CAPY-137` — Reviews never run on your own keys/subscriptions. Flotilla equivalent: Review agent = a read-only Thread on the PR head; [ADP] Flotilla: reviews run on any adapter the user picks.
- `CAPY-138` — Posting threshold (default medium), toggle investigate findings, opt-in notes. Flotilla equivalent: Review agent = a read-only Thread on the PR head.
- `CAPY-139` — No double-flagging; resolving/irrelevant resolves the GitHub thread. Flotilla equivalent: Review agent = a read-only Thread on the PR head.
- `CAPY-140` — Triage statuses Open/Resolved/Irrelevant; owner thread triages and fixes High before 'ready'; override from dashboard. Flotilla equivalent: Review agent = a read-only Thread on the PR head.
- `CAPY-141` — Incremental re-reviews; irrelevant never re-flagged; failed fix returns as new finding. Flotilla equivalent: Review agent = a read-only Thread on the PR head.
- `CAPY-498` — API reads PR review state and sets finding triage status. Flotilla equivalent: Review agent = a read-only Thread on the PR head.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-24.md`; never claim unrun behavior.

ROWS: CAPY-130, CAPY-131, CAPY-132, CAPY-133, CAPY-134, CAPY-135, CAPY-136, CAPY-137, CAPY-138, CAPY-139, CAPY-140, CAPY-141, CAPY-498
