# UNIT 04: Adapter host, LocalTransport, fake + generic-cli adapters
GOAL: Implement the adapter host over the `ProcessTransport` interface (parse a line stream into AdapterEvents, cancel with SIGINT→SIGTERM→SIGKILL in ≤10 s), a `LocalTransport` for tests, and the `fake` and `generic-cli` adapters.
BRANCH: flotilla/04-adapter-host   PR TARGET: flotilla/p1 (never main)
REPO: flotilla-ai/flotilla
DEPENDS ON: 01 merged.
SCOPE (you own only these paths): `packages/adapters/host/**`, `packages/adapters/fake/**` (incl. `fixtures/*.jsonl` and a tiny `fake-agent` bin), `packages/adapters/generic-cli/**`, tests, `docs/runlog/04-adapter-host.md`
OUT OF SCOPE: Real vendor adapters (06, 07), containers and `DockerExecTransport` (05).
SHAPES: SPEC §5a `ProcessTransport`, `ProcessHandle`, `AgentAdapter`, `AgentAdapterManifest`, `StartInput`, `ResumeInput`, `AdapterEvent` from `@flotilla/core/types`. Host API: `runJsonl(input.transport, argv, {cwd, env}, parseLine) → { events: AsyncIterable<AdapterEvent>; cancel(): Promise<void> }`. `LocalTransport` = `child_process.spawn` with `detached: true`; `signal()` = `process.kill(-pgid, sig)`.
DONE SIGNAL:
```
make check
pnpm --filter @flotilla/adapter-host test && pnpm --filter @flotilla/adapter-fake test && pnpm --filter @flotilla/adapter-generic-cli test
```
EXPECTED: fake adapter replays `fixtures/pr-happy.jsonl` → exact AdapterEvent sequence (`session`, text…, `usage`, `done:end_turn`); `fixtures/hang.jsonl` + cancel → `done:cancelled` within 10 s and no child or grandchild process left (`ps` check in test); generic-cli maps stdout lines to `text` and exit code ≠0 to `done:error`; `probe()` never spawns the agent's main command; adapters never import `child_process` (only the transport does; a test greps the adapter sources).
DIFF BUDGET: ≤ 16 files / ≤ 750 lines

## Context
- Read first: `AGENTS.md`, `SPEC.md` §4-5 (and the section for this unit), `ROADMAP.md` Phase 1 table.
- Pattern: firstmate's hermetic fake harness (https://github.com/kunchenguid/firstmate/blob/99313281a8dab2cabecd285fcfcd1da9f9b9058f/tests/t3-fake-server.mjs, MIT).
- `fake-agent` flags: `--usage-usd <n>` (emit usage per step, as `usdMicro`), `--usage-at-end` (usage only in the final line, like agents that report at turn end), `--mcp-config <path>` (script lines `{"mcp":{"tool":"crew.start","args":{…}}}` become MCP `tools/call` JSON-RPC POSTs to the server URL in that config, with its bearer header; used by unit 16), and `--spawn-child` (forks a long `sleep` grandchild, to prove process-group cancel).
- Cancel order: SIGINT first (Claude ends the turn and records a result on SIGINT; on SIGTERM it exits 143 with no result, per https://code.claude.com/docs/en/headless), then SIGTERM, then SIGKILL the process group at 10 s.

## Rules (hard)
- Work on branch `flotilla/04-adapter-host` created from `flotilla/p1` on `flotilla-ai/flotilla`. Push the branch and open a PR against `flotilla/p1` titled "04-adapter-host: Adapter host, LocalTransport, fake + generic-cli adapters" with: goal, diff summary, pasted test output, unverified items (DEVIN-PLAYBOOK.md §3b). Then **stop for mehdi's review**; he reviews and merges himself. Never push to `main` or `flotilla/p1`, never merge any PR (including your own), never force-push, never enable auto-merge. Do not file issues or comment on other PRs.
- Tests use the `fake` adapter, recorded fixtures, or free models only. No paid API calls, no Ollama, no real vendor logins.
- Never print, log or commit secrets. `.env.example` lists names only, never values.
- Touch only the files in SCOPE. If you must touch anything else, stop and report.
- Write the failing test for the DONE SIGNAL first, then the smallest change that passes. Types before logic (SPEC.md §4). Delete dead code.
- Prove it: paste the real command output. Mark anything you couldn't check "unverified". Never invent facts, numbers or APIs; if a vendor flag isn't in the docs cited here, say so.
- Licenses: only MIT / Apache-2.0 / BSD / ISC dependencies. No AGPL. Note any copied code in `THIRD_PARTY_NOTICES.md` with its license.

## Report back (final message)
1. 5 lines: what you built, done signal result, `make check` tail.
2. `git diff --stat flotilla/p1...flotilla/04-adapter-host`.
3. Structured: `{branch, pr_url, tests_passed, summary, unverified[]}`.
4. Decisions you made (from `docs/runlog/04-adapter-host.md` DECISIONS) and anything left unverified.
