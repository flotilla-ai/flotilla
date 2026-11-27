# phase2-02: Secrets vault and env API

GOAL: Encrypted scoped secrets, write-only APIs, machine preparation without value exposure. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-02-secrets
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/secrets*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/secrets*` only when this unit has UI rows
- `packages/**/secrets*` only when this unit owns adapter/package behavior
- `scripts/test-secrets*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-02-secrets.md`
- `docs/runlog/phase2-02.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `SecretScope`, `SecretRef`, `SecretGrant`, `EnvVarMutation`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-380` — Secrets encrypted with AWS KMS. Flotilla equivalent: Kernel + self-hosted data; self-host: local KMS/age/sops.
- `CAPY-382` — Thread export via API only. Flotilla equivalent: Kernel + self-hosted data; [TX] Flotilla: native export.
- `CAPY-383` — Three scopes: Shared (project), Personal, Thread; precedence Thread>Personal>Shared. Flotilla equivalent: Secrets vault (encrypted at rest, scrubbed from output).
- `CAPY-384` — Model sees names and configured-state, never values. Flotilla equivalent: Secrets vault (encrypted at rest, scrubbed from output); [ADP] adapters must not echo env into prompts.
- `CAPY-385` — Values decrypted only when a machine is prepared; written to protected file outside repos. Flotilla equivalent: Secrets vault (encrypted at rest, scrubbed from output).
- `CAPY-386` — Personal values readable by anyone driving a shared thread. Flotilla equivalent: Secrets vault (encrypted at rest, scrubbed from output).
- `CAPY-387` — GitHub tokens never land on a machine. Flotilla equivalent: Secrets vault (encrypted at rest, scrubbed from output).
- `CAPY-388` — Set/list/delete project env vars via API (values write-only). Flotilla equivalent: Secrets vault (encrypted at rest, scrubbed from output).
- `CAPY-389` — Per-thread write-only env vars on thread create. Flotilla equivalent: Secrets vault (encrypted at rest, scrubbed from output).
- `CAPY-538` — List environment variables. Flotilla equivalent: Public REST + SSE API.
- `CAPY-539` — Set environment variables. Flotilla equivalent: Public REST + SSE API.
- `CAPY-540` — Delete environment variables. Flotilla equivalent: Public REST + SSE API.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-02.md`; never claim unrun behavior.

ROWS: CAPY-380, CAPY-382, CAPY-383, CAPY-384, CAPY-385, CAPY-386, CAPY-387, CAPY-388, CAPY-389, CAPY-538, CAPY-539, CAPY-540
