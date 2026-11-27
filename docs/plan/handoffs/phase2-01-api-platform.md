# phase2-01: API platform foundation

GOAL: Public REST/SSE conventions, typed errors, idempotency, pagination, upload URLs. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-01-api-platform
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/api-platform*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/api-platform*` only when this unit has UI rows
- `packages/**/api-platform*` only when this unit owns adapter/package behavior
- `scripts/test-api-platform*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-01-api-platform.md`
- `docs/runlog/phase2-01.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `ApiKey`, `ApiPrincipal`, `ApiError`, `Page<T>`, `UploadGrant`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-453` — Base https://api.capy.ai/api/v1; Bearer capy_ keys minted only in app; optional expiry; no rotate verb. Flotilla equivalent: Public REST + SSE API.
- `CAPY-454` — Keys act as a principal (human or service user); authorId/userId attribution. Flotilla equivalent: Public REST + SSE API.
- `CAPY-455` — Idempotent requestId on creates. Flotilla equivalent: Public REST + SSE API.
- `CAPY-456` — Cursor pagination {items, cursor}; bounded lists return {items}. Flotilla equivalent: Public REST + SSE API.
- `CAPY-457` — SSE stream frames status/run/turn/tool_call/assistant/transcript with resume id, retry 2000. Flotilla equivalent: Public REST + SSE API; [TX].
- `CAPY-458` — Typed errors capy/* (Unauthorized, Forbidden, RateLimited, PaidFeatureUnavailable, CrewRefused, BillingAuthorityUnavailable…). Flotilla equivalent: Public REST + SSE API.
- `CAPY-459` — Legacy API migration guide (/tasks still served). Flotilla equivalent: Public REST + SSE API.
- `CAPY-460` — Common flows doc (scripts). Flotilla equivalent: Public REST + SSE API.
- `CAPY-461` — Automation webhook endpoint POST /webhooks/automations/{secret}. Flotilla equivalent: Public REST + SSE API.
- `CAPY-462` — File upload via presigned URLs then attach by fileId. Flotilla equivalent: Public REST + SSE API.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-01.md`; never claim unrun behavior.

ROWS: CAPY-453, CAPY-454, CAPY-455, CAPY-456, CAPY-457, CAPY-458, CAPY-459, CAPY-460, CAPY-461, CAPY-462
