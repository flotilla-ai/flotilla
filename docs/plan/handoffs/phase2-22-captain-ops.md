# phase2-22: Captain digest and operations

GOAL: Digest fallback/layout/actions, crew notifications, inter-Captain messages, templates. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-22-captain-ops
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/captain-ops*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/captain-ops*` only when this unit has UI rows
- `packages/**/captain-ops*` only when this unit owns adapter/package behavior
- `scripts/test-captain-ops*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-22-captain-ops.md`
- `docs/runlog/phase2-22.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `CaptainDigest`, `DigestItem`, `CaptainRule`, `CaptainTemplate`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-076` — Crew threads open beside the Captain's chat; Captain hears each crew turn end / need. Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-077` — Captain hears when a crew thread answered you directly. Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-078` — Filter Pull requests page by Captain. Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-080` — Digest tab; top five 'Needs you' on Overview; Needs-you pasted into chat with @-tag notification. Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-081` — Answer digest items in one line ('merge capy#3780'); Captain acts and drops item. Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-082` — Change digest layout by telling the Captain (saved as a rule). Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-084` — Digest API falls back DIGEST.md → ONGOING.md → NOTES.md, 64 KiB cap. Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-085` — Change rules by telling the Captain; it writes the right file and confirms. Flotilla equivalent: Captain scheduler + Captain Drive files; Flotilla: versioned + replay-tested + rollback (mehdi's orchestrator goal).
- `CAPY-095` — Captains on a schedule via automations; automations/Slack hand Captain new tickets. Flotilla equivalent: P2: Captains on a schedule via automations; Slack hand-off of tickets arrives with Slack (P3)..
- `CAPY-096` — Captains read and message each other; rule to suppress chatter. Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-098` — Captains-first / Hybrid sidebar, pinned Captain faces, each row shows the question it waits on. Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-099` — Captain starts work on a change you mention in passing. Flotilla equivalent: Captain scheduler + Captain Drive files.
- `CAPY-100` — Example Captain setups: Feature, Triage, Janitor. Flotilla equivalent: Captain scheduler + Captain Drive files; ship as templates.
- `CAPY-495` — Large crews / hundreds of subagents render without freezing. Flotilla equivalent: Captain scheduler + Captain Drive files; Flotilla: virtualized lists.

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-22.md`; never claim unrun behavior.

ROWS: CAPY-076, CAPY-077, CAPY-078, CAPY-080, CAPY-081, CAPY-082, CAPY-084, CAPY-085, CAPY-095, CAPY-096, CAPY-098, CAPY-099, CAPY-100, CAPY-495
