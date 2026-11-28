# Parallel run decisions log

Append one entry per ambiguity call: question, options, choice, why, how to undo.

## 2026-11-28: active unblock branches

Question: remote branches `flotilla/unblock-01` through `flotilla/unblock-07` still exist and are not ancestors of `flotilla/p1` because their PRs were squash-merged; do they count as unmerged active work for the shared-file protocol?

Options: treat every remote unblock branch as active; treat only branches attached to open unblock PRs or with content absent from `flotilla/p1` as active.

Choice: treat `flotilla/unblock-08-pr-page-wiring` as active because PR #103 is open; treat `unblock-01..07` as merged historical branches because their PR numbers appear as squash merges on `flotilla/p1`.

Why: literal ancestry would permanently block shared files even though the work is already merged, which is not the coexistence intent.

How to undo: if the unblock session reports otherwise, re-scan those branches and avoid any file they uniquely changed.
