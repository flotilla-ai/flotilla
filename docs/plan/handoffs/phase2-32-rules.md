# phase2-32: Instructions and rules

GOAL: Layered AGENTS/rules loading, context budget, non-overridable kernel rules, memory experiment. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-32-rules
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/rules*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/rules*` only when this unit has UI rows
- `packages/**/rules*` only when this unit owns adapter/package behavior
- `scripts/test-rules*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-32-rules.md`
- `docs/runlog/phase2-32.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `RulesBundle`, `RuleLayer`, `ContextBudget`, `MemoryExperiment`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-284` — Global instructions in Personal or Organization drive AGENTS.md. Flotilla equivalent: Rules loader (AGENTS.md etc. read by the agent CLI natively; Flotilla adds org/project rules).
- `CAPY-285` — Root AGENTS.md, CLAUDE.md fallback; deprecated per-agent files no longer read. Flotilla equivalent: Rules loader (AGENTS.md etc. read by the agent CLI natively; Flotilla adds org/project rules).
- `CAPY-286` — Nested AGENTS.md injected on first touch of that subtree. Flotilla equivalent: Rules loader (AGENTS.md etc. read by the agent CLI natively; Flotilla adds org/project rules).
- `CAPY-287` — Glob rules in .capy/rules and .cursor/rules (.md/.mdc, globs/alwaysApply). Flotilla equivalent: Rules loader (AGENTS.md etc. read by the agent CLI natively; Flotilla adds org/project rules); [ADP] Flotilla injects rules uniformly for every adapter.
- `CAPY-288` — Shared context budget; oversized content truncated with visible marker. Flotilla equivalent: Rules loader (AGENTS.md etc. read by the agent CLI natively; Flotilla adds org/project rules).
- `CAPY-289` — Guidance on what goes where + anti-patterns. Flotilla equivalent: Rules loader (AGENTS.md etc. read by the agent CLI natively; Flotilla adds org/project rules).
- `CAPY-290` — Migration notes from Claude Code, Cursor, AGENTS.md agents. Flotilla equivalent: Rules loader (AGENTS.md etc. read by the agent CLI natively; Flotilla adds org/project rules).
- `CAPY-291` — Three non-overridable rules: no merge without ask, no secrets exposure, no fabrication. Flotilla equivalent: Rules loader (AGENTS.md etc. read by the agent CLI natively; Flotilla adds org/project rules); Flotilla kernel guards (runtime-enforced where possible).
- `CAPY-292` — Context breakdown page: tokens per loaded layer. Flotilla equivalent: Rules loader (AGENTS.md etc. read by the agent CLI natively; Flotilla adds org/project rules).
- `CAPY-293` — Memory (Experiment): keeps what you teach across threads. Flotilla equivalent: Rules loader (AGENTS.md etc. read by the agent CLI natively; Flotilla adds org/project rules); scope/retention unverified.
- `CAPY-294` — Experiments page (Memory, Captain) per user or org. Flotilla equivalent: Rules loader (AGENTS.md etc. read by the agent CLI natively; Flotilla adds org/project rules).

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-32.md`; never claim unrun behavior.

ROWS: CAPY-284, CAPY-285, CAPY-286, CAPY-287, CAPY-288, CAPY-289, CAPY-290, CAPY-291, CAPY-292, CAPY-293, CAPY-294
