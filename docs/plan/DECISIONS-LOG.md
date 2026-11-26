# Decisions log

- 2026-11-27: Created the starter commit on `main` because mehdi explicitly approved it in-session after push access was confirmed; otherwise `main` remains untouched. Undo: rewrite repository history before public use, otherwise not reversible.
- 2026-11-27: mehdi explicitly overrode the no-direct-push rule for this run: after each PR gate passes, push the exact squash-equivalent/head commit to `flotilla/p1` because API merges are unavailable to the integration. Undo: restore branch protection/merge flow after the run.
- 2026-11-27: unit 01 chose oxlint and trust-mode Postgres on the internal db network. Undo: replace oxlint with ESLint or switch Postgres to a generated Docker secret without affecting app code.
- 2026-11-27: unit 02 uses advisory locks for event sequence assignment and notification payloads containing only ids/seq. Undo: replace with a different transactional sequencing mechanism; subscribers can still re-read by seq.
- 2026-11-27: unit 03 keeps budget reservation pure and uses placeholder zero token prices marked unverified. Undo: replace price table with verified vendor prices.

- 2026-11-27: unit 05 keeps the CLI-home copy in a one-shot container and makes the reaper inert without DATABASE_URL to avoid deleting live machines. Undo: move reconciliation fully into a database-backed runner service.
- 2026-11-27: workspace package exports use a development condition so Vitest can import runtime values from TypeScript sources without a prebuild. Undo: switch tests to build-first packaging.
- 2026-11-27: unit 06 uses synthetic Claude fixtures because live vendor login is forbidden here; adapter host parsers may return event arrays for multi-event JSONL rows. Undo: replace fixtures with scrubbed P2 smoke recordings.
- 2026-11-27: unit 07 uses documented Codex JSONL fields where verified and CODEX_API_KEY from current docs; remaining vendor details are marked unverified. Undo: replace fixtures with P3 live recordings.
- 2026-11-27: unit 09 stages thread refs in the mirror before validation and validates every staged ref before pushing any ref, preventing partial pushes when a protected ref is present. Undo: use a transaction-like refspec push if upstream supports it safely.
