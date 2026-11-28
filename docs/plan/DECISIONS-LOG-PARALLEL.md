# Parallel run decisions log

Append one entry per ambiguity call: question, options, choice, why, how to undo.

## 2026-11-28: active unblock branches

Question: remote branches `flotilla/unblock-01` through `flotilla/unblock-07` still exist and are not ancestors of `flotilla/p1` because their PRs were squash-merged; do they count as unmerged active work for the shared-file protocol?

Options: treat every remote unblock branch as active; treat only branches attached to open unblock PRs or with content absent from `flotilla/p1` as active.

Choice: treat `flotilla/unblock-08-pr-page-wiring` as active because PR #103 is open; treat `unblock-01..07` as merged historical branches because their PR numbers appear as squash merges on `flotilla/p1`.

Why: literal ancestry would permanently block shared files even though the work is already merged, which is not the coexistence intent.

How to undo: if the unblock session reports otherwise, re-scan those branches and avoid any file they uniquely changed.

## 2026-11-28: child-session mode unavailable

Question: the parallel prompt permits up to 4 child sessions, but the available child-session API exposes only Normal/Fast/Fusion/Lite/Ultra/Ultra Fast modes; mehdi's standing rule allows only free mode or explicitly selectable SWE 2.1 for child sessions.

Options: spawn children in a disallowed mode; do all units in the parent session; stop and ask mehdi.

Choice: do all units in the parent session and do not spawn child sessions.

Why: the hard standing rule outranks the optional parallelism permission, and the run rules say never ask/wait.

How to undo: if free or SWE 2.1 becomes selectable in the child-session API, independent later units may be delegated then.

## 2026-11-28: root workspace file already covers seam packages

Question: parallel-01 was told to edit root workspace configuration for future `apps/hostd` and `apps/guestd` packages.

Options: make a no-op edit; leave `package.json`/`pnpm-workspace.yaml` unchanged because `apps/*` already includes them.

Choice: leave them unchanged and record the no-op.

Why: smallest diff; the existing wildcard already provides the needed seam.

How to undo: add explicit workspace entries later if the wildcard pattern changes.
