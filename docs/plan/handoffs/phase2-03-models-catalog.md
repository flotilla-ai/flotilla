# phase2-03: Model catalog and connections

GOAL: Adapter-aware catalog, connection ordering, model selection and effort validation. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-03-models-catalog
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/models-catalog*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/models-catalog*` only when this unit has UI rows
- `packages/**/models-catalog*` only when this unit owns adapter/package behavior
- `scripts/test-models-catalog*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-03-models-catalog.md`
- `docs/runlog/phase2-03.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `ModelCatalogEntry`, `Connection`, `ModelSelection`, `ReasoningEffort`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-318` — ~65-model catalog at provider list price; BYOK and ZDR columns. Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys); [ADP] Flotilla model choice = adapter + model id.
- `CAPY-325` — Reasoning effort none…max; unsupported fails, no fallback. Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys); [ADP] map to each CLI's effort flag.
- `CAPY-327` — Connection order: owner → org → Capy credits; reorder, per-connection model list, edit/test/reconnect/disable. Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys).
- `CAPY-328` — Add a connection: searchable provider list (subscriptions, 14 gateways/coding plans, 5 key providers, custom OpenAI-compatible endpoint). Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys).
- `CAPY-329` — Check access lists models before connecting; exclude models; new models auto-covered. Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys).
- `CAPY-330` — Custom models by id on your key (Find models). Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys).
- `CAPY-331` — Name a catalog model on one connection (no fallback to credits/other keys). Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys).
- `CAPY-332` — Model picker badges (subscription/key/credits), tooltip names connection; favorites with ⌥1–9. Flotilla equivalent: AgentAdapter + per-user connections (vendor login inside the CLI, or API keys).

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-03.md`; never claim unrun behavior.

ROWS: CAPY-318, CAPY-325, CAPY-327, CAPY-328, CAPY-329, CAPY-330, CAPY-331, CAPY-332
