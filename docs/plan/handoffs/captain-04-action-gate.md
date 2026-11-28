GOAL
Implement BEYOND-010: kernel-enforced consequential action classification, approval cards, user rules, denial memory and expiry.

BRANCH: flotilla/captain-04-action-gate
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: parallel-01-seams merged
SCOPE: `packages/core/src/kernel/actionGate.ts`, `packages/core/src/kernel/actionGate.test.ts`, `apps/server/src/action-gate/**`, `apps/server/src/routes/action-gate.route.ts`, `docs/runlog/captain-04.md`
OUT OF SCOPE: unblock-owned files (`PARITY.md`, `PROGRESS.md`, `BLOCKED-TRIAGE.md`, `tracks/UNBLOCK.md`, `handoffs/unblock-*`, `docs/runlog/unblock-*`, `README.md`, `deploy/thread.Dockerfile`); CAPY rows; paid APIs; real vendor logins; deploys; `main`. No model-based reviewer; no browser proxy enforcement (captain-07); no UI page beyond using existing approval cards.
SHAPES
Pure kernel types: `ActionClass = read | write-local | consequential` with consequential kinds `send|publish|purchase|delete|permission|credential-entry|legal-accept`; deterministic `classifyAction`; `decideAction` combining ask-first rules, allow rules and hard always-ask classes. Server stores decisions using approval kind `decision` and `detail.kind='action'`.
DONE SIGNAL
`pnpm --filter @flotilla/core exec vitest run src/kernel/actionGate.test.ts` passes; `pnpm --filter @flotilla/server exec vitest run src/action-gate/action-gate.test.ts` passes; `make check` passes before merge.
EXPECTED
- Classification uses deterministic tool name, URL, button/link text and form field-type rules from CAPTAIN-QUALITY §8.
- Up to 20 ask-first and 20 allow patterns per user; keyword matching in v1; ask-first beats allow.
- Allow automatically never overrides credential-entry, purchase or delete; those always ask.
- Approval card offers Allow once / Always allow / Deny, and Always allow is absent for purchase/delete/credential.
- After Deny the same action is refused until the next human message in that thread.
- Background cards expire after 30 minutes.
- Tests prove hooks cannot loosen the kernel decision.
DIFF BUDGET: <= 12 files / <= 700 lines
Context
Read `docs/plan/DEVIN-GOAL-PARALLEL.md` first; it overrides the track files. Children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`: write `docs/runlog/<unit>.md`, and append only to `DECISIONS-LOG-PARALLEL.md` / `THIRD_PARTY_NOTICES.md` when needed. Use fake adapters, local fixtures and mocks only. UI: greys/black, orange only for needs-you, no pills. Before editing any pre-existing non-docs file, re-check active unblock PRs/branches and skip or split held files per the shared-file protocol.

ROWS: BEYOND-010
