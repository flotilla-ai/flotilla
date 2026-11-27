# phase2-14: Paired devices

GOAL: Device pairing, trust states, device list/status, reconnect behavior. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-14-devices-pairing
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/devices-pairing*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/devices-pairing*` only when this unit has UI rows
- `packages/**/devices-pairing*` only when this unit owns adapter/package behavior
- `scripts/test-devices-pairing*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-14-devices-pairing.md`
- `docs/runlog/phase2-14.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `PairedDevice`, `DevicePairing`, `DeviceTrust`, `DeviceStatus`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-228` — Sign in with Google, GitHub or email; computer pairs as a device. Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user.
- `CAPY-229` — Machine picker: cloud, another device, or this computer. Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user; [BYOM].
- `CAPY-230` — Workspace: New worktree (default) / Existing worktree / Current checkout. Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user; [BYOM] worktree inside container/dedicated user.
- `CAPY-231` — Scan a folder to link existing clones by remote; Project folders setting. Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user.
- `CAPY-232` — No machine-time charge for local threads. Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user.
- `CAPY-233` — Follow/reply to local threads from any browser incl. phone. Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user; [TX] Flotilla web UI served by self-host.
- `CAPY-234` — Local thread waits while device asleep/offline up to 24 h. Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user.
- `CAPY-235` — Cloud checkpoints of uncommitted local work (on by default, can turn off). Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user; [TX] Flotilla: checkpoints stay on user's infra, opt-in.
- `CAPY-236` — Automatic move to cloud when offline device blocks work (toggle). Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user.
- `CAPY-240` — Keep awake while agents are running (device setting; Mac lid closed, on power). Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-14.md`; never claim unrun behavior.

ROWS: CAPY-228, CAPY-229, CAPY-230, CAPY-231, CAPY-232, CAPY-233, CAPY-234, CAPY-235, CAPY-236, CAPY-240
