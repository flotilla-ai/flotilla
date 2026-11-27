# phase1fix-02: Captain five-crew relay

GOAL: prove the Captain relay end to end with the scripted fake agent: five crew run, a sixth is denied by the kernel, crew completion/budget events coalesce into one Captain wake, the digest is rewritten, and Needs-you items reach the Captain row.

BRANCH: flotilla/phase1fix-02-captain-relay
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase1fix-01-scheduler-restart

SCOPE:
- `packages/adapters/fake/`
- `docker-compose.yml`
- `scripts/test-captain-e2e.sh`
- `docs/plan/handoffs/phase1fix-02-captain-relay.md`
- `docs/runlog/phase1fix-02.md`
- `docs/plan/PROGRESS.md`
- `docs/plan/PARITY.md`
- `docs/plan/DECISIONS-LOG.md`

OUT OF SCOPE: durable runner inbox redesign, real vendor adapters, Captain Drive, UI polish, Slack.

DONE SIGNAL:
```sh
./scripts/test-captain-e2e.sh
make check
```

EXPECTED:
- compose builds the `flotilla-thread:dev` image before the server starts, so a fresh clone does not depend on a stale local image;
- the fake Captain uses the crew-start fixture for its initial purpose and a digest-only fixture for wake prompts;
- five crew threads exist after the run and no second batch is started by the wake;
- the sixth `crew.start` call is denied with the crew-limit kernel denial;
- one wake prompt is appended even though several crew events arrive together;
- one crew deliberately pauses on a low budget so its approval appears in Captain `needs_you` and in the digest;
- the script tears down its compose project.

ROWS: CAPY-066, CAPY-071, CAPY-079, CAPY-086, CAPY-097
