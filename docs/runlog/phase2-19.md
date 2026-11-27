# phase2-19: Forks, side chats and subagent API

## Implemented

- `GET /subagents/:id/messages` validates ownership and serves ordered event-store messages with `after`/`limit` pagination inputs.
- `GET /subagents/:id/stream` serves SSE directly from Flotilla's event store with resume support through `Last-Event-ID`/`after`.
- The existing task stream `GET /threads/:id/stream` is now covered in the same regression test.
- Existing list/get endpoints are covered as part of the public subagent API slice.

## Proof

Red-first focused run exited 1 because `/subagents/:id/messages` and `/subagents/:id/stream` did not exist.

Focused green:

```text
Test Files 1 passed (1)
Tests 1 passed | 11 skipped (12)
```

Full gate output is pasted in the PR body.

## Blocked remainder

CAPY-063/064/065 are blocked, not done: side chat and fork require a same-machine or fresh-machine workspace copy and (for full fork) adapter session copy, plus thread tab/passage UX. Those primitives do not exist yet and did not fit this API vertical slice. Summary-fork can work with any adapter but still needs the missing fork lifecycle/workspace copy.

## Unverified

No browser tab/passage UI and no real workspace/session copy were implemented or tested.
