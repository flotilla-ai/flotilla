# phase2-09: Preview lifecycle and sharing

GOAL: Port detection, share links, access states, expiry, failure cards. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-09-previews
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/previews*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/previews*` only when this unit has UI rows
- `packages/**/previews*` only when this unit owns adapter/package behavior
- `scripts/test-previews*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-09-previews.md`
- `docs/runlog/phase2-09.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `Preview`, `PreviewShare`, `PreviewAccess`, `PreviewStatus`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-218` — OOM stops largest process instead of freezing. Flotilla equivalent: Machine pool: Docker container per thread on the compose host.
- `CAPY-219` — Cloud machines Linux only (macOS/iOS via your Mac). Flotilla equivalent: Machine pool: Docker container per thread on the compose host; [BYOM].
- `CAPY-221` — Port suggestions in in-app browser; reserved ports. Flotilla equivalent: Preview proxy (P1: server's own :8081 origin via the gate; P2: Caddy wildcard hosts).
- `CAPY-223` — Each request keeps machine awake 5 more min, up to 4 h; 'Start the machine' link when asleep. Flotilla equivalent: Preview proxy (P1: server's own :8081 origin via the gate; P2: Caddy wildcard hosts); [CAP].
- `CAPY-224` — Stable URL across sleeps; reruns start command if nothing listening. Flotilla equivalent: Preview proxy (P1: server's own :8081 origin via the gate; P2: Caddy wildcard hosts).
- `CAPY-225` — Portless-style hostname routers supported. Flotilla equivalent: Preview proxy (P1: server's own :8081 origin via the gate; P2: Caddy wildcard hosts).
- `CAPY-226` — In-machine preview before a PR (machine browser/desktop). Flotilla equivalent: Preview proxy (P1: server's own :8081 origin via the gate; P2: Caddy wildcard hosts).

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-09.md`; never claim unrun behavior.

ROWS: CAPY-218, CAPY-219, CAPY-221, CAPY-223, CAPY-224, CAPY-225, CAPY-226
