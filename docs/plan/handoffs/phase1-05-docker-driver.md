# UNIT 05: Docker machine driver: hardened container, per-thread network, exec shim, reaper
GOAL: Start, stop and delete one hardened container per thread on its own internal network, run processes in it through an in-container process-group shim (real cancel), copy files in and out, give it a per-thread copy of the CLI login, assert isolation, and reconcile orphans.
BRANCH: flotilla/05-docker-driver   PR TARGET: flotilla/p1 (never main)
REPO: flotilla-ai/flotilla
DEPENDS ON: 01 merged.
SCOPE (you own only these paths): `apps/server/src/machines/{dockerDriver.ts,network.ts,transport.ts,cliHome.ts,reaper.ts,isolation.ts}` + tests, `apps/server/src/modules/reaper.module.ts`, `deploy/thread.Dockerfile`, `deploy/flotilla-exec` (POSIX sh shim), `docs/runlog/05-docker-driver.md`
OUT OF SCOPE: BYO runner (P2), gVisor/Kata, the gate's proxy logic (10), previews (15), running adapters (11), git (09).
SHAPES: `Machine`, `Isolation`, `ProcessTransport` from `@flotilla/core/types`. `startThreadContainer({threadId, code, image, cpus, memMb, env, roMounts?, cliHome?: {userVolume, threadVolume}}) → {containerId}`: creates network `flt-<threadId>` with `internal: true`, connects the compose `gate` container (found by label `flotilla.role=gate`) to it with alias `gate` **and** alias `flotilla-tools`, starts container `flt-<code>` with `--init`, a non-root uid, `/workspace` on a per-thread volume, `HTTPS_PROXY/HTTP_PROXY=http://gate:3128`, `NO_PROXY=flotilla-tools`, label `flotilla.thread=<id>`; `transport(containerId): ProcessTransport` = `DockerExecTransport` over `/opt/flotilla/bin/flotilla-exec` (SPEC §5a comment); `copyIn(containerId, dir, tar)` / `copyOut(containerId, path) → tar` (Docker archive API); `stop`, `remove` (also removes the network); `copyCliHome({userVolume, threadVolume})` = a one-shot init container mounting `userVolume` read-only and copying it into `threadVolume`, excluding session transcripts (Claude `projects/`; list the excluded paths in the runlog as unverified); `assertIsolated(containerInspect, networkInspect) → void | throws KernelDenied('isolation')`; `reconcile(dbThreads, dockerContainers) → actions[]`.
DONE SIGNAL:
```
make check
FLOTILLA_DOCKER_IT=1 pnpm --filter @flotilla/server test -- machines
```
EXPECTED: unit tests on `assertIsolated` with good/bad inspect fixtures: rejects root user, missing CapDrop ALL, missing no-new-privileges, a `docker.sock` mount, no PidsLimit or Memory, privileged, **more than one network, a non-internal network, or any network member besides the gate**. Integration test (only with FLOTILLA_DOCKER_IT=1): container from `deploy/thread.Dockerfile`: `id -u` ≠ 0; `sudo` absent; `/var/run/docker.sock` absent; `wget -T 3 http://1.1.1.1` fails; `getent hosts postgres` fails; a second thread container can't reach the first one's port 3000; cancel through the shim of `sh -c "sleep 600 & sleep 600"` leaves no `sleep` in `ps` within 10 s; `copyCliHome` leaves `projects/` out of the thread copy and the agent container has no mount of the user volume; reaper removes a labelled orphan and its network. If Docker is unavailable in the VM (pre-launch check P1), mark the integration test unverified and paste the unit-test output; mehdi runs it before merging.
DIFF BUDGET: ≤ 16 files / ≤ 900 lines

## Context
- Read first: `AGENTS.md`, `SPEC.md` §4-5 (and the section for this unit), `ROADMAP.md` Phase 1 table.
- dockerode is Apache-2.0 (research/BASE.md §5).
- Why a shim: Docker's exec API has no kill, and closing the stream orphans the process (SPEC §5a). The shim runs argv under `setsid`, writes the pgid to `/run/flotilla/<runId>.pgid`, and `flotilla-exec --signal <runId> <SIG>` does `kill -<SIG> -<pgid>`. Keep it ≤ 40 lines of POSIX sh.
- The thread image: Debian/Ubuntu slim + git + node 22 + python3 + the shim, no sudo (CAPY-199 is replaced). Build args install the official CLIs (`claude`, `codex`) at **local build time** with pinned versions; cite each vendor's install docs in the runlog (unverified here). The project must not publish an image containing them.
- `roMounts` lets unit 11 bind-mount the built `fake-agent` read-only for tests.
- Whether to mount a CLI home at all is the runner's decision (unit 11, from `Project.trust`); this unit only provides `copyCliHome` and never reads the volume's contents from the server process.

## Rules (hard)
- Work on branch `flotilla/05-docker-driver` created from `flotilla/p1` on `flotilla-ai/flotilla`. Push the branch and open a PR against `flotilla/p1` titled "05-docker-driver: Docker machine driver: hardened container, per-thread network, exec shim, reaper" with: goal, diff summary, pasted test output, unverified items (DEVIN-PLAYBOOK.md §3b). Then **stop for mehdi's review**; he reviews and merges himself. Never push to `main` or `flotilla/p1`, never merge any PR (including your own), never force-push, never enable auto-merge. Do not file issues or comment on other PRs.
- Tests use the `fake` adapter, recorded fixtures, or free models only. No paid API calls, no Ollama, no real vendor logins.
- Never print, log or commit secrets. `.env.example` lists names only, never values.
- Touch only the files in SCOPE. If you must touch anything else, stop and report.
- Write the failing test for the DONE SIGNAL first, then the smallest change that passes. Types before logic (SPEC.md §4). Delete dead code.
- Prove it: paste the real command output. Mark anything you couldn't check "unverified". Never invent facts, numbers or APIs; if a vendor flag isn't in the docs cited here, say so.
- Licenses: only MIT / Apache-2.0 / BSD / ISC dependencies. No AGPL. Note any copied code in `THIRD_PARTY_NOTICES.md` with its license.

## Report back (final message)
1. 5 lines: what you built, done signal result, `make check` tail.
2. `git diff --stat flotilla/p1...flotilla/05-docker-driver`.
3. Structured: `{branch, pr_url, tests_passed, summary, unverified[]}`.
4. Decisions you made (from `docs/runlog/05-docker-driver.md` DECISIONS) and anything left unverified.
