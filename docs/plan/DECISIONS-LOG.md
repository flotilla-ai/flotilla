# Decisions log

- 2026-11-27: Created the starter commit on `main` because mehdi explicitly approved it in-session after push access was confirmed; otherwise `main` remains untouched. Undo: rewrite repository history before public use, otherwise not reversible.
- 2026-11-27: mehdi explicitly overrode the no-direct-push rule for this run: after each PR gate passes, push the exact squash-equivalent/head commit to `flotilla/p1` because API merges are unavailable to the integration. Undo: restore branch protection/merge flow after the run.
- 2026-11-27: unit 01 chose oxlint and trust-mode Postgres on the internal db network. Undo: replace oxlint with ESLint or switch Postgres to a generated Docker secret without affecting app code.
- 2026-11-27: unit 04 centralizes process-group cancellation in adapter host; adapters remain transport-only. Undo: move cancellation into adapters if vendor-specific semantics require it.
