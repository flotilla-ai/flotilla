# 17 Captain scheduler

Implemented firstmate-style triage vocabulary, 30-second wake coalescing, persistent captain wake rows, exponential heartbeat backoff from 600 to 7,200 seconds, restart-recoverable due-wake polling, digest rendering/update, structured Needs-you synchronization, and wake prompts containing purpose, digest, and crew state. Added a captain module that scans recent crew events, initializes heartbeats, and polls due persistent timers.

Verification:
```text
$ pnpm --filter @flotilla/server exec vitest run src/captain/scheduler/scheduler.test.ts
 Tests  2 passed (2)
```

Unverified/gaps:
- Fake-clock coverage exists for pure backoff/coalescing, not full database timer recovery.
- Live Captain wake execution through Docker is unverified.
- Event scanning is interval-based rather than LISTEN/NOTIFY-triggered.
