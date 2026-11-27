# phase2-18: Subagent lifecycle

GOAL: Nested child threads, drafts, placement, parallel/stacked modes, parent wake. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-18-subagent-core
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/subagent-core*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/subagent-core*` only when this unit has UI rows
- `packages/**/subagent-core*` only when this unit owns adapter/package behavior
- `scripts/test-subagent-core*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-18-subagent-core.md`
- `docs/runlog/phase2-18.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `Subagent`, `SubagentPlacement`, `SubagentState`, `SubagentBudget`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-052` — Subagents: full child agents with own conversation/tools, nested up to 3 levels, addressed 'Subagent 1.3'. Flotilla equivalent: Child Thread (parentId) via adapter-native subagents or Flotilla delegate; [ADP] Flotilla spawns child runs via adapters; depth limit in kernel.
- `CAPY-053` — Subagent starts as editable draft (title + prompt) until started. Flotilla equivalent: Child Thread (parentId) via adapter-native subagents or Flotilla delegate.
- `CAPY-054` — Subagent starts from its prompt alone (no parent history). Flotilla equivalent: Child Thread (parentId) via adapter-native subagents or Flotilla delegate.
- `CAPY-055` — Shared-machine (read-only work) vs fresh-machine (writers) placement, chosen explicitly. Flotilla equivalent: Child Thread (parentId) via adapter-native subagents or Flotilla delegate; [BYOM] fresh = new container/worktree.
- `CAPY-056` — Parallel (disjoint files) vs stacked (builds on previous PR branch) subagents. Flotilla equivalent: Child Thread (parentId) via adapter-native subagents or Flotilla delegate.
- `CAPY-057` — Subagent lifecycle draft/working/waiting/idle/done/failed. Flotilla equivalent: Child Thread (parentId) via adapter-native subagents or Flotilla delegate.
- `CAPY-058` — Final summary wakes parent; blocked subagent surfaces its question to parent; interim progress read on demand. Flotilla equivalent: Child Thread (parentId) via adapter-native subagents or Flotilla delegate.
- `CAPY-059` — Parent reviews subagent diff, opens PR from its branch, patches, or sends feedback. Flotilla equivalent: Child Thread (parentId) via adapter-native subagents or Flotilla delegate.
- `CAPY-060` — Per-subagent model (cheaper/stronger/connected subscription). Flotilla equivalent: Child Thread (parentId) via adapter-native subagents or Flotilla delegate; [ADP][CAP] child inherits remaining budget slice, never more.
- `CAPY-061` — Subagent on a named paired device while parent stays in cloud. Flotilla equivalent: Child Thread (parentId) via adapter-native subagents or Flotilla delegate; [BYOM].
- `CAPY-062` — Sibling threads created and messaged by a coordinating agent. Flotilla equivalent: Child Thread (parentId) via adapter-native subagents or Flotilla delegate.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-18.md`; never claim unrun behavior.

ROWS: CAPY-052, CAPY-053, CAPY-054, CAPY-055, CAPY-056, CAPY-057, CAPY-058, CAPY-059, CAPY-060, CAPY-061, CAPY-062
