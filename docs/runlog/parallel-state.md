# Parallel-run orientation state

Measured on 2026-11-28 10:21 UTC in this session VM.

## Head and baseline

- Repository: `flotilla-ai/flotilla`
- Branch: `flotilla/p1`
- Head: `61c7aaae8646582acfe1bb7c02993f1180f962b1` (`61c7aaa`, `unblock-07: issues web board (#102)`)
- Dependency install: `corepack enable && pnpm install --frozen-lockfile` exited 0; lockfile already up to date.
- Baseline gate: `make check` exited 0. Measured totals included server `56` test files passed, `271` tests passed, `1` skipped; web `31` files/`63` tests passed; typecheck and lint completed. Lint warnings only, no errors.

## Unblock-run state read from `docs/plan/PROGRESS.md`

- Current phase: unblock run, clearing rows blocked at `f08de2a`.
- The file says the last unit is `unblock-07-issues-web-board` and that it is `in progress`; it says unblock units merged or blocked: 6 of 52.
- Its next actions are finish/merge unblock-07, then unblock-08, then unblock-09.
- Surprise: `flotilla/p1` head is already the squash merge `unblock-07: issues web board (#102)`, so the progress file appears stale by one update. The unblock run owns that file; this run does not edit it.

## Open unblock PRs and active unblock branches

Open unblock PR at orientation:

### PR #103: `unblock-08: pr page wiring`

- URL: https://github.com/flotilla-ai/flotilla/pull/103
- Branch: `flotilla/unblock-08-pr-page-wiring` -> `flotilla/p1`
- Changed files:
  - `apps/server/src/db/migrations/0051_pr_page.sql`
  - `apps/server/src/github/client.ts`
  - `apps/server/src/pr-autofix/index.ts`
  - `apps/server/src/pr-page/index.ts`
  - `apps/server/src/pr-page/pr-page.test.ts`
  - `apps/server/src/routes/pr-page.route.ts`
  - `apps/web/src/features/pr-page/index.tsx`
  - `apps/web/src/features/pr-page/pr-page.test.tsx`
  - `apps/web/src/features/thread-composer/index.tsx`
  - `apps/web/src/main.tsx`
  - `docs/plan/PARITY.md`
  - `docs/plan/PROGRESS.md`
  - `docs/runlog/assets/unblock-08-pr-page.png`
  - `docs/runlog/unblock-08.md`

Remote branches named `flotilla/unblock-*` at orientation:

- `flotilla/unblock-01-readme-quickstart` — corresponding PR #96 is squash-merged on `flotilla/p1`
- `flotilla/unblock-02-web-composer-queue` — corresponding PR #97 is squash-merged on `flotilla/p1`
- `flotilla/unblock-03-web-composer-cards` — corresponding PR #98 is squash-merged on `flotilla/p1`
- `flotilla/unblock-04-web-settings-models` — corresponding PR #99 is squash-merged on `flotilla/p1`
- `flotilla/unblock-05-web-captain-automations` — corresponding PR #100 is squash-merged on `flotilla/p1`
- `flotilla/unblock-06-issues-web-list` — corresponding PR #101 is squash-merged on `flotilla/p1`
- `flotilla/unblock-07-issues-web-board` — corresponding PR #102 is squash-merged on `flotilla/p1`
- `flotilla/unblock-08-pr-page-wiring` — active open PR #103

Decision recorded in `DECISIONS-LOG-PARALLEL.md`: only branches attached to open unblock PRs, or branches with unique unmerged content, are treated as active for shared-file conflicts. At orientation that set contains only `flotilla/unblock-08-pr-page-wiring`.

## Other open PRs observed

These open PRs are not unblock-owned and are not merge candidates for this run. Several are old phase-unit branches whose work appears in later squash-merged history. They are listed so future conflict checks do not mistake them for the active unblock run.

| PR | Title | Branch |
|---:|---|---|
| #70 | `phase2-14: devices pairing (CAPY-228..236,240)` | `flotilla/phase2-14-devices-pairing` |
| #69 | `phase2-21: captain machine api (CAPY-094,492,493,555..561)` | `flotilla/phase2-21-captain-machine-api` |
| #68 | `phase2-26: automations core (CAPY-152,154,155,159..162,164..166,500)` | `flotilla/phase2-26-automations-core` |
| #18 | `17-captain-scheduler: Captain scheduler: wakes, coalescing, heartbeat backoff, digest` | `flotilla/17-captain-scheduler` |
| #17 | `16-captain-tools: Captain tools: MCP endpoint, scoped run tokens, crew limits, Captain API` | `flotilla/16-captain-tools` |
| #16 | `13-web-ui-actions: Web UI actions: Needs-you, approvals, new thread, projects, message modes` | `flotilla/13-web-ui-actions` |
| #15 | `14-github-autofix: GitHub PR + CI wake + autofix loop guard` | `flotilla/14-github-autofix` |
| #14 | `15-previews: Preview proxy on a separate origin (private by default)` | `flotilla/15-previews` |
| #13 | `12-web-ui-core: Web UI core: login, thread list, live thread view, cost meter` | `flotilla/12-web-ui-core` |
| #12 | `11-thread-runner: Thread runner loop (container + adapter + kernel + events)` | `flotilla/11-thread-runner` |
| #11 | `10-egress-gate: Egress gate: per-thread allowlist proxy and internal tools relay` | `flotilla/10-egress-gate` |
| #10 | `09-git-mirror: mirror seeding and guarded pushes` | `flotilla/09-git-mirror` |
| #9 | `08-auth-projects-api: Auth (first-run admin, sessions), projects, read APIs` | `flotilla/08-auth-projects-api` |
| #8 | `07-codex-adapter: codex adapter (official CLI, fixture-tested)` | `flotilla/07-codex-adapter` |
| #7 | `06-claude-code-adapter: claude-code adapter (official CLI, fixture-tested)` | `flotilla/06-claude-code-adapter` |
| #6 | `05-docker-driver: Docker machine driver: hardened container, per-thread network, exec shim, reaper` | `flotilla/05-docker-driver` |
| #5 | `04-adapter-host: Adapter host, LocalTransport, fake + generic-cli adapters` | `flotilla/04-adapter-host` |
| #4 | `03-kernel-budget: Kernel: budget meter, reservations, caps, secret scrubber, branch guard` | `flotilla/03-kernel-budget` |
| #3 | `02-event-store: Event store + P1 schema + SSE` | `flotilla/02-event-store` |

## Files most relevant to parallel-run conflict checks

From active unblock PR #103:

- `apps/server/src/github/client.ts`
- `apps/server/src/pr-autofix/index.ts`
- `apps/server/src/routes/pr-page.route.ts`
- `apps/web/src/features/thread-composer/index.tsx`
- `apps/web/src/main.tsx`
- unblock-owned ledgers/runlogs (`PARITY.md`, `PROGRESS.md`, `docs/runlog/unblock-08.md`)

No active unblock PR currently touches the T3 gate files `apps/server/src/routes/threads.route.ts` or `apps/server/src/models-catalog/store.ts` (measured from PR #103's file list). T3 still waits for the explicit pre-start check required by `DEVIN-GOAL-PARALLEL.md`.

## Orientation reading performed

Read or inspected before this note:

- `README.md`
- `AGENTS.md`
- `docs/plan/PARITY.md` (format and row samples; full ledger remains unblock-owned)
- `docs/plan/PROGRESS.md`
- `docs/runlog/P1-EXIT.md` through `P4-EXIT.md`
- `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6
- open PR file lists via GitHub metadata
- remote `flotilla/unblock-*` branch list and recent unblock merge log

## Surprises and cautions

- Stale progress text: `PROGRESS.md` says unblock-07 is in progress although PR #102 is already the head squash merge.
- Old open phase-unit PRs remain open despite later merged history. They are left untouched.
- `parity_coverage.py` remains unblock-owned and is not modified. The parallel run uses the new `ledger_check.py` only for BEYOND/VM rows.
- `ledger_check.py` is expected to fail until 0b writes the Captain and VM handoffs; that is a planning coverage check, not a baseline `make check` failure.
