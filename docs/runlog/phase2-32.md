# phase2-32 instructions and rules

Branch `flotilla/phase2-32-rules` from `origin/flotilla/p1` (merged `eba906f`, then `6b5546a`; real merge commits). Fake adapter + local-process transport, temporary Postgres 16 container, local repo fixture, mocked-API browser test. No vendor calls or logins.

## Rows
- done: CAPY-284, CAPY-285, CAPY-286, CAPY-287, CAPY-288, CAPY-289, CAPY-290, CAPY-291, CAPY-292, CAPY-293, CAPY-294 (notes in `docs/plan/PARITY.md`).
- needs-human-login: none. No row needs a vendor login: rules are prepended to the run prompt, which every adapter receives the same way.

## Changes
- `apps/server/src/rules/types.ts`: `RulesBundle`, `RuleLayer`, `ContextBudget`, `MemoryExperiment`, `KERNEL_RULES`, `RULES_GUIDANCE`, `parseRuleFile`, `globToRegExp`, `buildBundle` (pure loader + shared budget).
- `apps/server/src/rules/store.ts`: `RulesStore` (instructions, experiments, memory, per-run context breakdown), `readRepoRules` (via the thread machine transport), `rulesBeforeRun`.
- `apps/server/src/runner/runner.ts`: `onBeforeRun` seam (mirrors `onAfterRun`); hook text is prepended to every run prompt.
- `apps/server/src/db/migrations/0020_rules.sql`, `apps/server/src/routes/rules.route.ts`, `apps/server/src/modules/rules.module.ts`.
- `apps/web/src/features/rules/index.tsx` (`#/rules`: instructions, guidance, experiments, memory, context breakdown) and `apps/web/e2e/rules.spec.ts`.

## Unverified
- Real Claude Code / Codex tool-call input key names for touched paths (CAPY-286); only the fake adapter's synthetic `agent.tool_call` with `file_path` is proven.
- Token counts are an estimate (chars/4), not a vendor tokenizer.
- Capy Memory scope/retention semantics; Flotilla stores explicit taught facts until forgotten.
- Captain flag has no consumer yet (Captain unit).
- Agent CLIs may also read the repo `AGENTS.md`/`CLAUDE.md` natively, so the root layer can appear twice in vendor context (live behaviour unverified).
- Browser test uses a mocked API; the full UI against a live server was not exercised.

## Red first
`npx vitest run src/rules` with only `types.ts` and the test present:
```
Caused by: Error: Failed to load url ./store.js (resolved id: ./store.js) in /home/ubuntu/repos/flotilla/apps/server/src/rules/rules.test.ts. Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```
The browser spec was written before `features/rules/index.tsx`, but the Vite dev server picked the page up during the first run, so no clean "page missing" red output was captured; its first recorded failure was `locator.check: Clicking the checkbox did not change its state` (test fixed to `click()`).

## Focused (after)
```
✓ src/rules/rules.test.ts > rules loader > CAPY-285: root AGENTS.md wins, CLAUDE.md is the fallback, deprecated per-agent files are not read 26ms
 ✓ src/rules/rules.test.ts > rules loader > CAPY-286: a nested AGENTS.md is injected only once its subtree has been touched 3ms
 ✓ src/rules/rules.test.ts > rules loader > CAPY-287: .capy/rules and .cursor/rules .md/.mdc apply by globs or alwaysApply 19ms
 ✓ src/rules/rules.test.ts > rules loader > CAPY-288: layers share one context budget; an oversized layer is truncated with a visible marker 0ms
 ✓ src/rules/rules.test.ts > rules loader > CAPY-291: the three kernel rules come first, are never truncated or overridable, and are enforced in code 11ms
 ✓ src/rules/rules.test.ts > rules loader > CAPY-289/290: guidance on what goes where, anti-patterns and migration notes is served 3ms
 ✓ src/rules/rules.test.ts > rules in runs > CAPY-284/287/292: org + personal + project instructions and repo rules are injected for every adapter; the context page lists tokens per layer 403ms
 ✓ src/rules/rules.test.ts > rules in runs > CAPY-293/294: Memory is an experiment per user or org; what you teach in one thread reaches the next 443ms
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

## Browser (`pnpm exec playwright test e2e/rules.spec.ts`)
```
✓  1 e2e/rules.spec.ts:3:1 › CAPY-292 context breakdown per layer; CAPY-294 Memory/Captain experiments; CAPY-284 personal instructions; CAPY-289 guidance (599ms)
  1 passed (1.6s)
```

## Devin Review round 1 (commit `1517355`)
- Route clash: `GET /threads/:id/context` shadowed the phase2-05 context meter; moved to `/threads/:id/rules-context`.
- Repo-supplied globs compiled to a backtracking regex; replaced by `globMatch`, a memoized DP (O(glob x path), globs over 256 chars never match). Test covers a 40x `**/` + 40x `*a` glob against a 1400-char path.
- `#/rules` Save buttons stay disabled until instructions load (no blank overwrite on load failure).
- `#/rules` guidance reads `use`/`notes` (the served shape); the mocked e2e now uses that shape.
- Experiments use inherit/on/off selects; `inherit` sends `null`, so org changes reach the user again.

## `pnpm --filter @flotilla/server test` (after merging `origin/flotilla/p1` `9dc39fe` and review fixes)
```
 Test Files  26 passed (26)
      Tests  174 passed | 1 skipped (175)
EXIT 0
```

## `make check` (after merge and review fixes)
```
packages/core test:  Test Files  6 passed (6)
packages/core test:       Tests  15 passed (15)
apps/gate test:  Test Files  2 passed (2)
apps/gate test:       Tests  5 passed (5)
packages/adapters/host test:  Test Files  1 passed (1)
packages/adapters/host test:       Tests  3 passed (3)
apps/web test:  Test Files  6 passed (6)
apps/web test:       Tests  16 passed (16)
packages/adapters/claude-code test:  Test Files  1 passed (1)
packages/adapters/claude-code test:       Tests  7 passed (7)
packages/adapters/codex test:  Test Files  1 passed (1)
packages/adapters/codex test:       Tests  5 passed (5)
packages/adapters/generic-cli test:  Test Files  1 passed (1)
packages/adapters/generic-cli test:       Tests  4 passed (4)
packages/adapters/fake test:  Test Files  1 passed (1)
packages/adapters/fake test:       Tests  3 passed (3)
apps/server test:  Test Files  26 passed (26)
apps/server test:       Tests  174 passed | 1 skipped (175)
EXIT 0
```

## Merge of `origin/flotilla/p1` `9dc39fe` (phase2-29, phase2-18)
Conflicts in `runner.ts` (kept both `onBeforeRun` and `onPlacement` hooks), `DECISIONS-LOG.md` and `PROGRESS.md` (kept both sides). Results above are after this merge.
