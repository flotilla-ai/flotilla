# phase2-37: Troubleshooting guide

## Implemented

`docs/TROUBLESHOOTING.md` now gives operator symptoms and recovery steps for machine replacement, missing processes, setup failure, snapshot failure, credits/usage, Codex/Claude reconnect, machine/Drive/upload limits, ignored CI, waiting threads, archived threads, ports/previews/networking, and MCP/plugin failure. `TroubleshootingIndex`/`TroubleshootingEntry` define the exact topic inventory used by the regression test.

## Proof

Red-first before implementation: command exited 1 because `TROUBLESHOOTING_INDEX` did not exist.

Focused green:

```text
Test Files  1 passed (1)
Tests  1 passed (1)
```

Full gate output is pasted in the PR body.

## Decisions

The guide is static operator documentation, so no Postgres table or migration is needed; the typed index is code-owned test inventory rather than mutable runtime state.

## Unverified

No browser rendering or docs-site navigation exists; the row is proven as repository documentation plus exact topic coverage.
