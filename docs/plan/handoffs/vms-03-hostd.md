GOAL
Implement VM-003: a non-root host helper (`apps/hostd` unless `apps/runner` already exists) with unix-socket token auth, fixed ComputeDriver verbs, path validation and fake backend.

BRANCH: flotilla/vms-03-hostd
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: parallel-01-seams merged
SCOPE: `apps/hostd/**` (or `apps/runner` only if it already exists on `flotilla/p1`), `deploy/hostd/**` for rendered systemd-user/launchd unit files, `docs/runlog/vms-03.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor/Tailscale logins; deploys; `main`. Never install the systemd/launchd units in tests; no arbitrary host exec; no root requirement; no installer execution.
SHAPES
Define JSON-RPC or equivalent typed verb messages matching ComputeDriver: capacity/create/start/stop/snapshot/restore/recreate/destroy/transport/cdpEndpoint. Token file path comes from env and is never logged. Backend interface includes `fake` first. Rendered service files are text artifacts tested by golden output.
DONE SIGNAL
`pnpm --filter @flotilla/hostd test` passes (or the equivalent workspace package); `pnpm -r typecheck` passes; `make check` passes before merge.
EXPECTED
- Listens on `/run/flotilla/hostd.sock` by default and rejects missing/invalid token.
- Only fixed ComputeDriver verbs exist; unknown verbs and shell strings are refused.
- Path arguments are validated and confined to the hostd data dir/backend-specific roots.
- Runs as a normal user in rendered systemd user unit and launchd agent files; tests never install them.
- Fake backend implements every verb for later tests.
- If `apps/runner` is absent, decision log records the new `apps/hostd` choice and future fold-in follow-up.
DIFF BUDGET: <= 15 files / <= 800 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides `tracks/VMS.md`. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. `FLOTILLA_COMPUTE_ISOLATION` defaults off with zero impact; the dockerode-call snapshot test must stay green. Use fake backends/local fixtures; no Tailscale login, no real VM boot unless `/dev/kvm` or macOS is available. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: VM-003
