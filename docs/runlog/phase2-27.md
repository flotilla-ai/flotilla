# phase2-27 Automation control

## Dispositions

- done: CAPY-169, CAPY-170, CAPY-173, CAPY-501
- blocked: CAPY-172 — `machineSize` is durable metadata, but runner machine placement does not consume it yet.
- blocked: CAPY-171 — `driveScope` is durable metadata, but Drive state is not mounted into automation runs yet.
- blocked: CAPY-175 — failed runs and thread references are retained, but runner output/completion is not yet written back to `automation_runs.output`.

## Proof

Focused test:

```text
Test Files  1 passed (1)
Tests  1 passed (1)
```

The test proves webhook payloads remain data rather than prompt instructions, daily caps create skipped records, durable per-run machine size and Drive-scope metadata, pause/resume/delete/restore, manual trigger, run list/cancel, webhook rotation hash storage, project/state/date filters, and retention of runs after soft deletion.

## Unverified

Runner execution does not yet consume `machineSize`/`driveScope` or write terminal output back to automation runs.
