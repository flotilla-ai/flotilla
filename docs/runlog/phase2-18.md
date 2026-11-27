# phase2-18 runlog: Subagent lifecycle

Rows: CAPY-052 to CAPY-062. Proven offline against a throwaway `postgres:16` container, scripted fake adapters (`plain`, `holder`, `broke`, `pricey`), a fake machine driver, a fake Docker API, a local bare git mirror and a fake GitHub client. No vendor calls or logins.

## Rows

| Row | Status | Proof |
|---|---|---|
| CAPY-052 | done | `CAPY-052` test: Subagent 1/2, 2.1, 2.1.1 at depth 3; level 4 → 403; child runs its own conversation |
| CAPY-053 | done | `CAPY-053` test: draft has no run; PATCH title/prompt; 409 after start |
| CAPY-054 | done | `CAPY-054` test: adapter gets the draft prompt only, `resumeSessionId: null`, no parent text in child events |
| CAPY-055 | done | `CAPY-055` test: placement required; shared → `workspaceFrom` parent, Docker mount read-only, no new volume; fresh → own volume |
| CAPY-056 | done | `CAPY-056` test: overlapping parallel paths → 409; stacked run uses previous sibling branch as base |
| CAPY-057 | done | `CAPY-057/058` test: draft → working → done, failed, idle (stopped), waiting (budget pause) |
| CAPY-058 | done | `CAPY-057/058` test: parent re-runs with `Subagent 1 "scan" finished` + summary; blocked question reaches parent inbox; progress mid-run shows tool calls |
| CAPY-059 | done | `CAPY-059` test: diff from mirror applies with `git apply`; PR opened from child branch; feedback re-runs child |
| CAPY-060 | done | `CAPY-060` test: own model/connection; foreign connection → 404; grant 6 of request 50 (cap 10, spent 4); nothing left → 403 |
| CAPY-061 | blocked | No paired-device machine driver on `flotilla/p1` |
| CAPY-062 | blocked | No agent-callable subagent tool for non-Captain threads (Captain tool registry out of scope) |

## Failing first (measured)

Test file written before the store/route existed:

```text
$ cd apps/server && npx vitest run src/subagent-core
Error: Cannot find module '../routes/subagent-core.route.js' imported from '.../apps/server/src/subagent-core/subagent-core.test.ts'
 Test Files  1 failed (1)
      Tests  no tests
```

## Focused tests (measured, merged with `8aaf37c`, then `0662ec8`)

```text
$ cd apps/server && npx vitest run src/subagent-core --reporter=verbose
 ✓ src/subagent-core/subagent-core.test.ts > subagent core > CAPY-052: child threads nest 3 levels, are addressed "Subagent 1.3"-style, and run their own conversation; level 4 is refused 300ms
 ✓ src/subagent-core/subagent-core.test.ts > subagent core > CAPY-053: a subagent is an editable draft (title + prompt) and does not run until started 442ms
 ✓ src/subagent-core/subagent-core.test.ts > subagent core > CAPY-054: a subagent starts from its prompt alone, with no parent history or session 230ms
 ✓ src/subagent-core/subagent-core.test.ts > subagent core > CAPY-055: placement is explicit; shared mounts the parent workspace read-only, fresh gets its own machine 362ms
 ✓ src/subagent-core/subagent-core.test.ts > subagent core > CAPY-056: parallel subagents must claim disjoint paths; a stacked subagent branches from the previous sibling branch 241ms
 ✓ src/subagent-core/subagent-core.test.ts > subagent core > CAPY-057/058: lifecycle draft→working→done wakes the parent with the summary; progress reads on demand; failed, idle and waiting 1012ms
 ✓ src/subagent-core/subagent-core.test.ts > subagent core > CAPY-059: the parent reviews the diff, applies it as a patch, opens a PR from the subagent branch, or sends feedback 467ms
 ✓ src/subagent-core/subagent-core.test.ts > subagent core > CAPY-060: each subagent picks its own model/connection, and its budget is a slice of what the parent has left 260ms
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

## Done signal (measured)

```text
$ pnpm --filter @flotilla/server test
 Test Files  21 passed (21)
      Tests  129 passed | 1 skipped (130)
EXIT=0

$ make check
apps/gate test:  Test Files  2 passed (2)
apps/gate test:       Tests  5 passed (5)
packages/core test:  Test Files  6 passed (6)
packages/core test:       Tests  15 passed (15)
apps/web test$ vitest run --passWithNoTests src
packages/adapters/host test:  Test Files  1 passed (1)
packages/adapters/host test:       Tests  3 passed (3)
apps/web test:  Test Files  3 passed (3)
apps/web test:       Tests  6 passed (6)
packages/adapters/codex test:  Test Files  1 passed (1)
packages/adapters/codex test:       Tests  5 passed (5)
packages/adapters/claude-code test:  Test Files  1 passed (1)
packages/adapters/claude-code test:       Tests  7 passed (7)
packages/adapters/generic-cli test:  Test Files  1 passed (1)
packages/adapters/generic-cli test:       Tests  4 passed (4)
packages/adapters/fake test:  Test Files  1 passed (1)
packages/adapters/fake test:       Tests  3 passed (3)
apps/server test:  Test Files  21 passed (21)
apps/server test:       Tests  129 passed | 1 skipped (130)
EXIT=0
```

`pnpm -r lint` (inside `make check`): 0 warnings in `apps/server`; one pre-existing `apps/gate` warning (`prefer-string-starts-ends-with`).

## After merging `origin/flotilla/p1` `0662ec8` (measured)

Two-parent merge `faad190` (conflicts only in PROGRESS/DECISIONS-LOG ledgers, both sides kept).

```text
$ make check
apps/gate test:  Test Files  2 passed (2)
apps/gate test:       Tests  5 passed (5)
packages/core test:  Test Files  6 passed (6)
packages/core test:       Tests  15 passed (15)
apps/web test$ vitest run --passWithNoTests src
packages/adapters/host test:  Test Files  1 passed (1)
packages/adapters/host test:       Tests  3 passed (3)
apps/web test:  Test Files  4 passed (4)
apps/web test:       Tests  14 passed (14)
packages/adapters/codex test:  Test Files  1 passed (1)
packages/adapters/codex test:       Tests  5 passed (5)
packages/adapters/claude-code test:  Test Files  1 passed (1)
packages/adapters/claude-code test:       Tests  7 passed (7)
packages/adapters/generic-cli test:  Test Files  1 passed (1)
packages/adapters/generic-cli test:       Tests  4 passed (4)
packages/adapters/fake test:  Test Files  1 passed (1)
packages/adapters/fake test:       Tests  3 passed (3)
apps/server test:  Test Files  23 passed (23)
apps/server test:       Tests  141 passed | 1 skipped (142)
EXIT=0
```

## Unverified

- Real Docker read-only shared mount and real git seeding/branching with a stacked base (proven with a fake Docker API and the runner hook only).
- Real GitHub PR from a subagent branch (fake `openOrFindPr`; pushing still relies on the github module after-run hook).
- Interim prose: the kernel delta scrubber buffers agent text until the run ends, so progress mid-run shows state and tool calls, not text.
- Applying the patch inside the parent's own workspace is left to the parent agent; the API returns an applicable patch.
- Adapter-native subagent events (`t: 'subagent'`) are not mapped to subagent rows.
- No web UI; these rows are API behaviour.

## Review findings

None yet.
