# phase2-06: Composer attachments and reading UX

GOAL: Keyboard remaps, uploads, request cards, deep links, sections, reading place. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-06-thread-composer
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/thread-composer*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/thread-composer*` only when this unit has UI rows
- `packages/**/thread-composer*` only when this unit owns adapter/package behavior
- `scripts/test-thread-composer*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-06-thread-composer.md`
- `docs/runlog/phase2-06.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `Attachment`, `ComposerKeymap`, `RequestCard`, `ReadingPlace`, `ThreadSection`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-007` — Remappable send keys, incl. Enter for newline, per browser. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-012` — Attach images/files; they land on the agent's machine. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-015` — Requests say exactly what is needed (e.g. 'Waiting on you to merge capy#8426'); env-var and desktop requests open inline; dismiss with Undo. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-016` — Thread codes (PROJECT-123) usable in Cmd+K and @-mentions. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-027` — Agent replies read as sections; Reply to a section quotes it; work between messages folds into one line. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-032` — Threads without a project (no repo) on This Mac. Flotilla equivalent: Thread + event log + web UI; [BYOM].
- `CAPY-033` — Message ticks on the left edge to jump to each human message. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-034` — Threads hold your reading place when a turn closes. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-471` — capy.ai/new?prompt= deep link pre-fills composer. Flotilla equivalent: Thread + event log + web UI.
- `CAPY-472` — Ask Capy to send product feedback; owner approves report before sending. Flotilla equivalent: Thread + event log + web UI; Flotilla: feedback goes to user's own tracker.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-06.md`; never claim unrun behavior.

ROWS: CAPY-007, CAPY-012, CAPY-015, CAPY-016, CAPY-027, CAPY-032, CAPY-033, CAPY-034, CAPY-471, CAPY-472
