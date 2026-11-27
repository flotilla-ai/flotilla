# phase2-04: Model policy and model API

GOAL: Run-out policy, connection pinning, base URLs, model list endpoint. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-04-model-policy-api
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/model-policy-api*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/model-policy-api*` only when this unit has UI rows
- `packages/**/model-policy-api*` only when this unit owns adapter/package behavior
- `scripts/test-model-policy-api*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-04-model-policy-api.md`
- `docs/runlog/phase2-04.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `RunOutPolicy`, `ConnectionTest`, `ModelListItem`, `ConnectionPatch`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-333` — Run-out policy Ask me / Ask before credits / Keep going; Wait/Use card; /wait /continue in CLI. Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys); [CAP] Flotilla default = pause and ask.
- `CAPY-335` — Never use Capy credits / exclude a company's models. Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys).
- `CAPY-336` — Model list endpoint. Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys).
- `CAPY-337` — Full 1.05M context for GPT-6 on Codex. Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys).
- `CAPY-338` — Background requests (titles, PR summaries) on Capy's ZDR accounts. Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys); [TX] Flotilla: titles via user's chosen model, local.
- `CAPY-484` — One row per Claude model; connected Claude subscription runs it first. Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys); [NOCLAUDE].
- `CAPY-485` — Change a connection's Base URL. Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys).

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-04.md`; never claim unrun behavior.

ROWS: CAPY-333, CAPY-335, CAPY-336, CAPY-337, CAPY-338, CAPY-484, CAPY-485
