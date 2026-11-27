# phase2-26 automation triggers and runs

## Dispositions

- done: CAPY-152, CAPY-154, CAPY-155, CAPY-159, CAPY-160, CAPY-161, CAPY-162, CAPY-164, CAPY-165, CAPY-166, CAPY-500
- blocked: CAPY-153 — automation CRUD/trigger APIs exist, but neither an Automations page nor agent-accessible full management tools are implemented.
- blocked: CAPY-163 — `run_when` is durable, configurable and injectable for fixture proof, but production does not yet wire a free fast-model adapter as the gate.

## Proof

Focused server test:

```text
Test Files  1 passed (1)
Tests  1 passed (1)
```

Server typecheck after the focused test: `tsc --noEmit` rc=0.

The test proves validation of 1–20 triggers, cron field/IANA timezone validation, the 5-minute floor and a DST transition case; GitHub webhook fixture mapping and delivery idempotency; webhook HMAC, 256 KB cap, no-match and duplicate outcomes; batching list/flush/cancel; manual triggers; substring/regex/list conditions; pinned-model failure without substitution; new/standing/existing/private thread modes; normal thread creation and runner start handoff; and multiple schedules with same-minute duplicate suppression.

## Unverified

The production `run_when` gate is fail-closed because no free fast-model adapter is wired. GitHub trigger proof uses signed-route fixture bodies, not a live GitHub App delivery. Scheduler proof calls the durable scan directly; the module timer wiring is typechecked but not run for a full minute.
