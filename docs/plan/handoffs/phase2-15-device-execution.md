# phase2-15: Runner execution on devices

GOAL: Runner worktrees, identity, isolation, imports, Tailscale transport, device placement. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-15-device-execution
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/device-execution*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/device-execution*` only when this unit has UI rows
- `packages/**/device-execution*` only when this unit owns adapter/package behavior
- `scripts/test-device-execution*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-15-device-execution.md`
- `docs/runlog/phase2-15.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `RunnerDevice`, `WorktreePolicy`, `DevicePlacement`, `ImportRequest`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-244` — Agent runs as you with your git identity; linked folder is not a sandbox. Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user; [BYOM] Flotilla must sandbox (container or dedicated OS user).
- `CAPY-245` — Import local Claude Code and Codex histories as threads. Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user; [TX][NOCLAUDE] import must be explicit opt-in, local only.
- `CAPY-246` — Free models on This Mac with no plan. Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user.
- `CAPY-249` — Worktrees under ~/.capy/worktrees need 1 GB free. Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user.
- `CAPY-423` — Tailscale: machines join tailnet as tagged ephemeral nodes via OAuth client; ACLs; disconnect. Flotilla equivalent: Integrations (Vercel/Paper/etc.); [BYOM] also the transport for BYO machines in Flotilla.
- `CAPY-488` — Worktree folder setting per device. Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user; [BYOM].
- `CAPY-490` — Thread rows show cloud vs paired device; thread waits for device reconnect. Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-15.md`; never claim unrun behavior.

ROWS: CAPY-244, CAPY-245, CAPY-246, CAPY-249, CAPY-423, CAPY-488, CAPY-490
