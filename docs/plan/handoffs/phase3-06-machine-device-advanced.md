GOAL
Implement the smallest fixture-backed Flotilla foundation for advanced cloud machines and desktop devices, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase3-06-machine-device-advanced
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/device-advanced, apps/web/src/features/device-advanced, docs/runlog/phase3-06.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/machine-device-advanced*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-200`: XFCE desktop with Chrome streamed to thread pane — Flotilla equivalent: Machine pool: Docker container per thread on the compose host
- `CAPY-208`: Docker + Compose inside VM; local Kubernetes (Kind/Minikube/k3s) with caveats — Flotilla equivalent: Machine pool: Docker container per thread on the compose host; [BYOM] docker-in-docker needs privileged/sysbox — security tradeoff
- `CAPY-216`: Machines don't share filesystems; ask to transfer files — Flotilla equivalent: Machine pool: Docker container per thread on the compose host
- `CAPY-227`: Desktop app macOS (.dmg, Apple Silicon/Intel), Windows x64, Linux x64/arm64 (.deb, AppImage, .tar.gz); self-updates — Flotilla equivalent: P3: replaced. Installable web app (PWA) instead of native desktop builds; `flotilla-runner` stays a headless CLI.
- `CAPY-237`: Continue on / Move to a device / Return to your device (cloud↔device↔device via cloud) — Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user; [BYOM]
- `CAPY-238`: What moves (branch, commits, staged/unstaged/untracked, workspace files) vs stays (.gitignored, >2 MB untracked, processes) — Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user
- `CAPY-239`: Move refused while repo mid-merge/rebase or other threads on machine — Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user
- `CAPY-241`: System tray keeps device online on Windows/Linux — Flotilla equivalent: P3: replaced. The headless runner (systemd/launchd service) keeps a machine online; no tray app.
- `CAPY-242`: Device access: Personal (approve each request) / Shared (team + org API keys); Agent access Always allow — Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user; [BYOM] Flotilla shared runners need per-user isolation
- `CAPY-243`: Admins see, rename, revoke every paired device — Flotilla equivalent: flotilla-runner on BYO machines (SSH/Tailscale), isolated by container or dedicated user
- `CAPY-247`: Desktop: tabs, multiple windows, split panes — Flotilla equivalent: P3: replaced. Browser tabs/windows of the web UI; split panes in the web UI.
- `CAPY-248`: Desktop logs stay local; Export logs on crash screen — Flotilla equivalent: P3: replaced. Runner logs stay on the machine; `flotilla-runner logs --export`.
- `CAPY-489`: Open files in: choose editor or system default — Flotilla equivalent: P3: replaced. 'Open in editor' links (vscode://, cursor://) from the web UI.
- `CAPY-491`: Dock/taskbar unread mentions count — Flotilla equivalent: P3: replaced. Unread count in the PWA badge / page title.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-200, CAPY-208, CAPY-216, CAPY-227, CAPY-237, CAPY-238, CAPY-239, CAPY-241, CAPY-242, CAPY-243, CAPY-247, CAPY-248, CAPY-489, CAPY-491
