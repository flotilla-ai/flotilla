# phase2-33: Skills

GOAL: Skill discovery/invocation/reuse/markers for built-in, repo, Drive and plugin skills. Prove the row-specific behaviors below with the fake adapter, local fixtures, or offline unit/API tests; vendor/live-service behavior is fixture-backed and marked `needs-human-login` where the run rules require a real login.

BRANCH: flotilla/phase2-33-skills
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: current `flotilla/p1` plus the wave dependencies in `docs/plan/handoffs/README-phase2.md`

SCOPE:
- `apps/server/src/**/skills*` or the smallest existing feature module needed for this unit
- `apps/server/src/db/migrations/` (one new migration only when required)
- `apps/web/src/**/skills*` only when this unit has UI rows
- `packages/**/skills*` only when this unit owns adapter/package behavior
- `scripts/test-skills*.sh` or focused `*.test.ts` files for this unit
- `docs/plan/handoffs/phase2-33-skills.md`
- `docs/runlog/phase2-33.md`
- `docs/plan/PROGRESS.md`, `docs/plan/PARITY.md`, `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: `main`; direct pushes to `flotilla/p1`; real paid vendor calls; unrelated refactors; files owned by another phase 2 unit unless the wave README explicitly sequences the shared file.

SHAPES: define types first, using SPEC section 4 naming where applicable: `Skill`, `SkillSource`, `SkillInvocation`, `SkillLoadState`. Persist durable state in Postgres, expose UI/API behavior through the file-convention module/route extension points, and keep adapter differences behind capabilities rather than adapter-name checks.

DONE SIGNAL:
```sh
pnpm --filter @flotilla/server test
make check
```

EXPECTED: focused tests must prove every row below. Rows that inherently need a human vendor/login/live service must still have fake-adapter or fixture proof and end as `needs-human-login` with the exact operator command in the runlog.

- `CAPY-295` — Invoke skills with $, /, @ (and $name in Slack) or plain words. Flotilla equivalent: P2: invoke skills with $, /, @ or plain words in the web UI; `$name` in Slack arrives with Slack (P3)..
- `CAPY-296` — Built-in skills: artifact, capy-setup, find-mcp-server, gh-stack, make-a-deck/page/prototype, paper, spreadsheets. Flotilla equivalent: Skills folder mounted into thread (agent-native skills).
- `CAPY-297` — Repository skills in .agents/skills or .claude/skills. Flotilla equivalent: Skills folder mounted into thread (agent-native skills).
- `CAPY-298` — Drive skills and plugin skills. Flotilla equivalent: Skills folder mounted into thread (agent-native skills).
- `CAPY-299` — SKILL.md with name + description frontmatter. Flotilla equivalent: Skills folder mounted into thread (agent-native skills).
- `CAPY-300` — Skills page: Not loaded / Replaced-by markers. Flotilla equivalent: Skills folder mounted into thread (agent-native skills).
- `CAPY-301` — Reuse skills from Claude Code/Cursor and the skills CLI by copying. Flotilla equivalent: Skills folder mounted into thread (agent-native skills).

DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated lockfile noise. If the behavior cannot fit, split implementation inside this unit into the smallest vertical slice and mark the unproven remainder `blocked` rather than widening scope.

Context: read `docs/plan/DEVIN-GOAL-ALL.md` sections 3-6, this handoff, and only the SPEC sections for the rows above. Write the failing test first. Paste real outputs in the PR and `docs/runlog/phase2-33.md`; never claim unrun behavior.

ROWS: CAPY-295, CAPY-296, CAPY-297, CAPY-298, CAPY-299, CAPY-300, CAPY-301
