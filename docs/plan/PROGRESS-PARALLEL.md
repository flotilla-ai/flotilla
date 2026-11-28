# Parallel run progress

## Next 3 actions

1. Merge PR 0a (`flotilla/plan-parallel`) with the split sources, state note, extension ledger and coverage script.
2. Open the two plan PRs: `planC` (`captain-02..16` plus `parallel-01-seams`) and `planV` (`vms-02..12`).
3. After both merge, run serialized `parallel-01-seams`, skipping any shared file still held by an active unblock PR.

Head SHA at orientation: `61c7aaa` (`unblock-07: issues web board (#102)`).

## T2 Captain quality

Status: planned, not started. Rows BEYOND-001..015 are `pending` in `PARITY-EXT.md`.

## T3 Devin CLI adapter

Status: planned, not started. It starts only when no active unblock PR/branch touches `apps/server/src/routes/threads.route.ts` or `apps/server/src/models-catalog/store.ts`; it remains off by default.

## T4 own-computer VMs

Status: planned, not started. Rows VM-001..011 are `pending` in `PARITY-EXT.md`.

## Unit table

| Unit | Track | Status | Attempts | PR | Notes |
|---|---|---|---:|---|---|
| parallel-00-plan | setup | running | 1 |  | sources split; awaiting PR |
| parallel-01-seams | setup | pending | 0 |  | serialized shared seams |

## Notes and surprises

- `docs/plan/PROGRESS.md` still says unblock-07 is in progress even though `unblock-07: issues web board (#102)` is the head squash merge. Treat the merged commit as newer measured state and the text as a stale progress update owned by the unblock run.
- Remote unblock branches `unblock-01` through `unblock-07` still exist, but their PRs are squash-merged on `flotilla/p1`. The active unblock branch/PR at orientation is `flotilla/unblock-08-pr-page-wiring` / PR #103.
- Several old phase-unit PRs remain open even though later squash-merged history contains their work. They are not unblock-owned and are not merge candidates for this run.
