# phase2-16: Dock CLI

GOAL: Headless runner installer, pairing, dirs, doctor/status/verify/revoke commands. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-16-dock-cli
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/dock-cli*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/dock-cli*` only when this unit has UI rows
- `packages/**/dock-cli*` only when this unit owns adapter/package behavior
- `scripts/test-dock-cli*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-16-dock-cli.md`
- `docs/runlog/phase2-16.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `DockInstall`, `DockCommandResult`, `DockDirectory`, `DeviceRevocation`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-250` — capy dock: headless device for Linux/macOS/Windows (servers, VMs, spare Macs). Flotilla equivalent: flotilla-runner CLI (headless pairing); [BYOM] Flotilla runner agent over SSH/Tailscale instead of outbound pairing.
- `CAPY-251` — Installer: curl|sh (Linux/macOS) and irm|iex (Windows); refuses root/admin. Flotilla equivalent: flotilla-runner CLI (headless pairing).
- `CAPY-252` — Installer verifies sha256 and macOS codesign team; signed-manifest verify. Flotilla equivalent: flotilla-runner CLI (headless pairing); Flotilla: signed releases + checksum.
- `CAPY-253` — Installer env/flags: CAPY_DOCK_BASE, CAPY_DOCK_HOME, CAPY_BIN_DIR, CAPY_DOCK_VERSION, CAPY_NO_MODIFY_PATH / --no-modify-path, CAPY_DOCK_ALLOW_ROOT. Flotilla equivalent: flotilla-runner CLI (headless pairing).
- `CAPY-254` — Installs to ~/.capy/dock-install/<version>, symlink ~/.capy/bin/capy, PATH line in shell rc (bash/zsh/fish/profile). Flotilla equivalent: flotilla-runner CLI (headless pairing).
- `CAPY-255` — Pairing via link/QR/code approved in Settings → Devices; interactive first run. Flotilla equivalent: flotilla-runner CLI (headless pairing).
- `CAPY-256` — --dir to link repo folders; capy dock dirs add/remove. Flotilla equivalent: flotilla-runner CLI (headless pairing).
- `CAPY-257` — Runs in foreground; keep alive with tmux/systemd/launchd. Flotilla equivalent: flotilla-runner CLI (headless pairing).
- `CAPY-258` — Commands: dock, status, doctor, dirs, verify, version; --verbose. Flotilla equivalent: flotilla-runner CLI (headless pairing).
- `CAPY-259` — One device per OS user; recommend dedicated account on shared servers. Flotilla equivalent: flotilla-runner CLI (headless pairing); [BYOM] Flotilla makes dedicated user the default.
- `CAPY-260` — Revoke device; next run re-pairs. Flotilla equivalent: flotilla-runner CLI (headless pairing).

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-16.md`; never claim unrun behavior.

ROWS: CAPY-250, CAPY-251, CAPY-252, CAPY-253, CAPY-254, CAPY-255, CAPY-256, CAPY-257, CAPY-258, CAPY-259, CAPY-260
