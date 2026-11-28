# Parallel run progress

## Next 3 actions

1. Merge wave A units whose dependency `parallel-01-seams` is now merged.
2. Implement Captain fixtures/computer/action-gate and VM quota/hostd seams in dependency order.
3. Keep T3 gated until no active unblock work touches `threads.route.ts` or `models-catalog/store.ts`.

Head SHA at orientation: `61c7aaa` (`unblock-07: issues web board (#102)`). Current head after seam merge batch: `65eb5ca`.

## T2 Captain quality

Status: planned; handoffs merged in PR #105. Rows BEYOND-001..015 are `pending` in `PARITY-EXT.md`.

## T3 Devin CLI adapter

Status: planned, not started. It starts only when no active unblock PR/branch touches `apps/server/src/routes/threads.route.ts` or `apps/server/src/models-catalog/store.ts`; it remains off by default.

## T4 own-computer VMs

Status: planned; handoffs merged in PR #107. Rows VM-001..011 are `pending` in `PARITY-EXT.md`.

## Unit table

| Unit | Track | Status | Attempts | PR | Notes |
|---|---|---|---:|---|---|
| parallel-00-plan | setup | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/104 | sources, state note, extension ledger, coverage script |
| planC | setup | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/105 | Captain handoffs; BEYOND rows covered once |
| planV | setup | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/107 | VM handoffs; VM rows covered once |
| parallel-01-seams | setup | merged | 1 | https://github.com/flotilla-ai/flotilla/pull/109 | migrations, MCP names, fence helper, image/eval seams |

## Notes and surprises

- `docs/plan/PROGRESS.md` still says unblock-07 is in progress even though `unblock-07: issues web board (#102)` is the head squash merge. Treat the merged commit as newer measured state and the text as a stale progress update owned by the unblock run.
- Remote unblock branches `unblock-01` through `unblock-07` still exist, but their PRs are squash-merged on `flotilla/p1`. The active unblock branch/PR at orientation is `flotilla/unblock-08-pr-page-wiring` / PR #103.
- Several old phase-unit PRs remain open even though later squash-merged history contains their work. They are not unblock-owned and are not merge candidates for this run.
