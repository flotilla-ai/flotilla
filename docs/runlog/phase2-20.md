# phase2-20: Captain creation and crew rules

## Implemented

- `POST /captains/promote` promotes an uncrewed root thread in place. Because it remains the same `threads` row, its event history, PR list, machine id, engine/model and member references are preserved by identity.
- `POST /captains/:id/crew/:threadId` adds an existing thread with enumerated refusal reasons: wrong owner, wrong project, subagent, Captain, itself, or already in another crew. Re-adding is idempotent.
- `POST /captains/:id/crew/:threadId/archive` archives a finished crew thread; existing delete release clears `crew_of`.
- Project and owner equality are hard requirements, so Captains act as their owner and take crew only from their own project.

## Proof

Red-first focused run exited 1 before the endpoints existed.

Focused green:

```text
Test Files 1 passed (1)
Tests 1 passed (1)
```

Full gate output is pasted in the PR body.

## Blocked remainder

- CAPY-067: no New Captain dialog/avatar/machine/model/access web UI.
- CAPY-069: Flotilla has no folder entity or folder-removal workflow.
- CAPY-070: no natural-language “Make a Captain…” flow through an existing thread.
- CAPY-072: Captain archive does not put crew machines to sleep; delete/demote lifecycle incomplete.

## Unverified

Real browser drag/move actions and machine sleep integration are unverified.
