GOAL
Implement BEYOND-003 and BEYOND-004: live computer view, human takeover lock, handback, and proof that credentials never reach the agent, database, events, logs or audit.

BRANCH: flotilla/captain-12-live-takeover
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: captain-07 merged
SCOPE: `apps/server/src/computer-live/**`, `apps/server/src/routes/computer-live.route.ts`, `apps/web/src/features/computer-view/**`, route registration in `apps/web/src/main.tsx` if needed, `docs/runlog/captain-12.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor logins; deploys; `main`. No full desktop streaming; no cookie/storage export; no password autofill or Vault; no native browser-dialog claims.
SHAPES
Types for screen stream frames, takeover session, human input event (in-memory only), lock state and handback. Use approval kind `decision` with `detail.kind='takeover'`. WebSocket messages carrying human input are never persisted. CDP screencast frames are proxied only to authenticated live-view clients.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/computer-live/computer-live.test.ts` passes; `pnpm --filter @flotilla/web exec vitest run src/features/computer-view/computer-view.test.tsx` passes; `make check` passes before merge; attach UI screenshots.
EXPECTED
- Read-only live view draws its own address bar/tab strip in greys/black and documents that native dialogs are not shown.
- Agent can ask for takeover; password/OTP/captcha/SSO fixture detection can auto-raise the orange Needs-you card.
- While takeover is open, agent computer calls return `409 human-in-control` and screenshots/frames are refused to agents.
- Human mouse/keyboard events flow browser WebSocket -> CDP and are never stored/logged/echoed; only `takeover.started` and `takeover.ended` persist.
- I'm done closes approval, releases lock, wakes the agent, and causes a fresh snapshot.
- Regression test types known password/TOTP through the harness then greps DB dumps, events, server logs and audit: zero hits.
- Cookies remain only in the browser profile volume; server never mounts/reads it.
DIFF BUDGET: <= 15 files / <= 800 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides the track files. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. Use fake adapters, local fixtures and mocks only. UI: greys/black, orange only for needs-you, no pills. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: BEYOND-003, BEYOND-004
