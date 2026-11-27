# phase2-29 projects

Branch `flotilla/phase2-29-projects` from `origin/flotilla/p1` `505d663`. Local git fixture repos, a fixture GitHub repo list, a temporary Postgres 16 container, and the web UI with a Playwright-mocked API. No vendor calls, logins or network clones.

## Rows
- CAPY-177, CAPY-178, CAPY-179, CAPY-180: `done` (pending merge).
- CAPY-181: `needs-human-login`. The live GitHub list and live remote clones are unproven (see below). Members adding GitHub repos with their own access is blocked on per-user GitHub identity (P3).
- CAPY-182: `blocked` (parent gate). Private-by-default, owner-only projects are proven. Teammates can see `shared` projects but cannot start threads in them, so collaborator use is not claimed.

## Changes
- `apps/server/src/projects/types.ts`: `Project`, `ProjectRepository` (`role` primary|lazy, `provider` github|git|local), `ProjectIdentity`, `ProjectVisibility`, `ProjectSource`, `RepoSuggestion`.
- `apps/server/src/db/migrations/0014_projects.sql`: `projects.repo` nullable; adds `repos`, `source`, `icon`, `code` (unique, `^[A-Z][A-Z0-9]{1,5}$`), `visibility`, `thread_seq`; backfills code and `repos` for existing rows; a `threads` BEFORE INSERT trigger sets `code = <project code>-<n>`.
- `apps/server/src/routes/projects.route.ts` (extended, same table and routes): `POST /projects {name, source, lazy?, icon?, code?, visibility?}` (the legacy `repo` body still works), `GET /projects/suggestions`, `POST /projects/:id/repos/:repoId/clone`, PATCH name/icon/code/visibility, and list/get show the caller's projects plus shared ones.
- `apps/server/src/projects/describe.ts`: `describeRepo` / `describeMirror` (one sentence from manifests or README, read from the server-owned bare mirror with `git show`).
- `apps/server/src/git/mirror.ts`: `remoteAllowed` accepts https hosts listed in `FLOTILLA_GIT_HOSTS` (no credentials in the URL; the GitHub token is still sent only to GitHub). `ensureMirror` refuses repoless projects.
- `apps/web/src/features/projects/index.tsx` + `apps/web/e2e/projects.spec.ts`: create from GitHub/Git URL/folder (+machine)/empty; icon, code, shared toggle; recently pushed list; repos with role/description and a Clone button for lazy repos.

## Red first
`npx vitest run src/projects/projects.test.ts` with the old route and a stub `describeRepo` that returns null:
```
   × describeRepo (CAPY-179) > prefers manifest descriptions, then the first README sentence, as one sentence 8ms
     → expected null to be 'HTTP API for the Acme storefront.' // Object.is equality
   × projects (phase2-29) > CAPY-177: creates a repoless project; its threads get project codes and the mirror refuses to clone 11ms
     → expected 400 to be 201 // Object.is equality
   × projects (phase2-29) > CAPY-180: name, emoji icon and uppercase code; threads are numbered per project 6ms
     → expected { error: 'name and repo required' } to match object { name: 'Web App', icon: '🚀', …(1) }
   × projects (phase2-29) > CAPY-178/179/181: primary repo mirrors and is described at creation; lazy repos clone on demand 2ms
     → expected 400 to be 201 // Object.is equality
   × projects (phase2-29) > CAPY-181: validates GitHub, git URL and folder sources and suggests recently pushed repos 4ms
     → expected 400 to be 201 // Object.is equality
   × projects (phase2-29) > CAPY-182: projects are private by default; shared projects are visible but only the owner edits 1ms
     → expected undefined to be 'private' // Object.is equality
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 6 ⎯⎯⎯⎯⎯⎯⎯
 Test Files  1 failed (1)
      Tests  6 failed (6)
```

## Focused (after)
```
 ✓ src/projects/projects-read.test.ts (2 tests) 1656ms
 ✓ src/projects/projects.test.ts (6 tests) 2277ms
 Test Files  2 passed (2)
      Tests  8 passed (8)
```
`pnpm --filter @flotilla/web exec playwright test e2e/projects.spec.ts`:
```
  ✓  1 e2e/projects.spec.ts:3:1 › CAPY-177..182 create from sources, identity, private/shared, lazy clone and suggestions (950ms)
  1 passed (2.6s)
```
The existing `e2e/features.spec.ts` (which includes project trust confirmation) still passes: 4 passed.

## Done signal: `pnpm --filter @flotilla/server test`
```
 ✓ src/api-platform/api-platform.test.ts (9 tests) 2292ms
 ✓ src/thread-api/thread-api.test.ts (8 tests) 2377ms
 ✓ src/projects/projects.test.ts (6 tests) 2333ms
 ✓ src/machines/machines.test.ts (12 tests | 1 skipped) 9ms
 ✓ src/models-catalog/models-catalog.test.ts (8 tests) 2528ms
 ✓ src/git/mirror.test.ts (4 tests) 621ms
 ✓ src/thread-lifecycle/thread-lifecycle.test.ts (11 tests) 3303ms
 ✓ src/secrets/secrets.test.ts (10 tests) 3408ms
 ✓ src/github/github.test.ts (5 tests) 40ms
 ✓ src/captain/tools/captain-tools.test.ts (2 tests) 38ms
 ✓ src/loader.test.ts (3 tests) 38ms
 ✓ src/previews/previews.test.ts (1 test) 5ms
 ✓ src/captain/scheduler/scheduler.test.ts (2 tests) 1837ms
 ✓ src/events/store.test.ts (6 tests) 2141ms
 ✓ src/gateClient/gateClient.test.ts (1 test) 4ms
 ✓ src/runner/runner.test.ts (4 tests) 2510ms
 ✓ src/projects/projects-read.test.ts (2 tests) 1985ms
 ✓ src/auth/auth.test.ts (2 tests) 1986ms
 ✓ src/runner/runner-queue.test.ts (12 tests) 5604ms
 Test Files  19 passed (19)
      Tests  107 passed | 1 skipped (108)
exit=0
```

## `make check`
```
apps/web typecheck: Done
apps/server typecheck: Done
apps/web test:  RUN  v3.2.7 /home/ubuntu/repos/flotilla/apps/web
apps/web test:  ✓ src/features/thread-lifecycle/selection.test.ts (2 tests) 4ms
apps/web test:  Test Files  1 passed (1)
apps/web test:       Tests  2 passed (2)
apps/web test:    Start at  11:29:17
apps/web test:    Duration  369ms (transform 63ms, setup 0ms, collect 40ms, tests 4ms, environment 0ms, prepare 95ms)
apps/server test:  RUN  v3.2.7 /home/ubuntu/repos/flotilla/apps/server
apps/server test:  ✓ src/thread-api/thread-api.test.ts (8 tests) 2509ms
apps/server test:  ✓ src/projects/projects.test.ts (6 tests) 2535ms
apps/server test:  ✓ src/runner/runner.test.ts (4 tests) 2533ms
apps/server test:  ✓ src/models-catalog/models-catalog.test.ts (8 tests) 2580ms
apps/server test:  ✓ src/thread-lifecycle/thread-lifecycle.test.ts (11 tests) 3478ms
apps/server test:    ✓ thread lifecycle > CAPY-017: rename, regenerate with org+personal instructions (<=50 chars), regenerate-when setting  708ms
apps/server test:  ✓ src/secrets/secrets.test.ts (10 tests) 3587ms
apps/server test:    ✓ secrets vault > vault failures fail closed: a failed thread-env write leaves no thread; an unreadable vault fails the thread without a run or retry loop  437ms
apps/server test:    ✓ secrets vault > CAPY-385: a failed secrets-file copy fails machine preparation before the agent starts  431ms
apps/server test:  ✓ src/git/mirror.test.ts (4 tests) 666ms
apps/server test:  ✓ src/projects/projects-read.test.ts (2 tests) 1857ms
apps/server test:  ✓ src/auth/auth.test.ts (2 tests) 2033ms
apps/server test:  ✓ src/api-platform/api-platform.test.ts (9 tests) 2318ms
apps/server test:  ✓ src/events/store.test.ts (6 tests) 2215ms
apps/server test:  ✓ src/github/github.test.ts (5 tests) 37ms
apps/server test:  ✓ src/captain/tools/captain-tools.test.ts (2 tests) 115ms
apps/server test:  ✓ src/previews/previews.test.ts (1 test) 3ms
apps/server test:  ✓ src/gateClient/gateClient.test.ts (1 test) 4ms
apps/server test:  ✓ src/loader.test.ts (3 tests) 69ms
apps/server test:  ✓ src/machines/machines.test.ts (12 tests | 1 skipped) 8ms
apps/server test:  ✓ src/captain/scheduler/scheduler.test.ts (2 tests) 1779ms
apps/server test:  ✓ src/runner/runner-queue.test.ts (12 tests) 5864ms
apps/server test:    ✓ runner queue > CAPY-004: steer reaches a steer-capable agent mid-turn; without the capability it falls back to the queue  558ms
apps/server test:    ✓ runner queue > CAPY-009/468/603/604: queued messages fold behind a count, can be edited, discarded back to the composer, or sent now  477ms
apps/server test:    ✓ runner queue > CAPY-465: /plan explores first, holds changes and further messages until the plan is approved  759ms
apps/server test:    ✓ runner queue > CAPY-467: a message sent while its file uploads waits durably and goes out after upload, even after a restart  544ms
apps/server test:    ✓ runner queue > CAPY-469: a provider error is classified and Retry re-sends the last message, optionally on another model  360ms
apps/server test:  Test Files  19 passed (19)
apps/server test:       Tests  107 passed | 1 skipped (108)
apps/server test:    Start at  11:29:19
apps/server test:    Duration  6.89s (transform 1.11s, setup 0ms, collect 3.39s, tests 34.19s, environment 4ms, prepare 1.88s)
apps/web lint: Done
apps/server lint: Done
exit=0
```

## needs-human-login (CAPY-181)
Run these with a real token on a running stack:
```sh
GITHUB_TOKEN=<token> docker compose up -d
curl -fsS -b cookies.txt localhost:8080/api/v1/projects/suggestions            # recently pushed repos, newest first
curl -fsS -b cookies.txt -H 'x-flotilla-csrf: <csrf>' -H 'content-type: application/json' \
  -d '{"name":"Live","source":{"kind":"github","fullName":"<owner>/<repo>"}}' localhost:8080/api/v1/projects
FLOTILLA_GIT_HOSTS=gitlab.com  # then create {"kind":"git-url","url":"https://gitlab.com/<group>/<repo>.git"}
```
Expected: suggestions list the account's repos by `pushed_at`. The project's primary repo shows `clonedAt` and a `description` within seconds.

## Unverified
- The default `recentRepos` (`GET https://api.github.com/user/repos?sort=pushed` with `GITHUB_TOKEN`) is not exercised. Tests inject a fixture list.
- Live github.com and `FLOTILLA_GIT_HOSTS` https clones are not run. Only `file://` and absolute-path fixtures are cloned.
- A folder on a paired device (`machineId` set) is stored, but cloning it returns 409 until the device runner (phase2-14/15) clones on that machine.
- Repoless threads: the runner's existing `seedWorkspace(...).catch` and after-run hook `.catch` absorb the new `no repository` refusal (inferred from code; no runner test added).
- In headless Chrome on this VM the emoji icon renders as a box (no emoji font). The DOM text is correct (`🛒 Shop`).

## Escalations (out of scope, not fixed)
- Members cannot add GitHub repos while `GITHUB_TOKEN` is set. Letting them do so with their own GitHub access needs per-user GitHub identity (P3). Projects that members created from GitHub repos before this unit still mirror with the server token.
- Teammates can see shared projects but cannot start threads in them, because `ThreadRunner.create` and Captain creation still require `projects.owner_id`. A P3 org/membership unit should decide this.
- `apps/server/src/db/schema.ts` (Drizzle; not imported anywhere) does not list the new columns.

## Merge of `origin/flotilla/p1` 4c8a0ed (phase2-04, phase2-09)
Conflicts were in docs only (`DECISIONS-LOG.md`, `PROGRESS.md`), and both sides' entries are kept. Row counts were recounted from `PARITY.md`: done 99, pending 481, needs-human-login 17, n-a 22, blocked 13. Migration `0014_projects.sql` now runs after `0010_model_policy.sql`.

`make check`:
```
apps/server test:  Test Files  21 passed (21)
apps/server test:       Tests  124 passed | 1 skipped (125)
apps/server lint: Done
exit=0
```

## Devin Review round 1 (on b6ae207)
- Repoless threads started the agent in `/workspace/repo`, which is never created. The runner now seeds and uses `/workspace/repo` only when `project.repo` is set; otherwise it uses `/workspace`. New test in `runner.test.ts`. Fixed in e3c848e.
- A reused project code could generate a thread code an older thread already holds (for example, after `WEB` is renamed and a new project takes `WEB`). The trigger now skips sequence numbers already used. The backfill uses `P00001...` by creation order instead of an md5 prefix, which could collide. Fixed in b1654a8. The backfill has no test (tests migrate an empty database).
- A repo created without a base branch defaulted to `main` even when the remote only has `master`. When the requested branch is missing in the mirror, `materialize` now uses the mirror's default branch and stores it (also in `projects.repo` for the primary). Fixed in b1654a8.
- Escalated in round 1, then fixed after the parent gate (see below): suggestions and clones used the server's `GITHUB_TOKEN` without checking the member's GitHub access.

Red before the fixes (`npx vitest run src/projects/projects.test.ts`, `-t repoless` in runner):
```
   × projects (phase2-29) > CAPY-180: name, emoji icon and uppercase code; threads are numbered per project 25ms
     → duplicate key value violates unique constraint "threads_code_key"
   × projects (phase2-29) > CAPY-178/179/181: primary repo mirrors and is described at creation; lazy repos clone on demand 309ms
     → expected [ 'main', 'main', …(1) ] to deeply equal [ 'master', 'master', …(1) ]
   × thread runner > starts repoless project threads in /workspace without seeding a repo (CAPY-177) 135ms
     → expected [ '/workspace/repo' ] to deeply equal [ '/workspace' ]
```
After (`npx vitest run src/projects src/runner`):
```
 ✓ src/projects/projects-read.test.ts (2 tests) 1544ms
 ✓ src/projects/projects.test.ts (6 tests) 1958ms
 ✓ src/runner/runner.test.ts (5 tests) 2178ms
 ✓ src/runner/runner-queue.test.ts (12 tests) 5191ms
 Test Files  4 passed (4)
      Tests  25 passed (25)
```
`make check`:
```
apps/web test:  Test Files  3 passed (3)
apps/web test:       Tests  6 passed (6)
apps/server test:  Test Files  21 passed (21)
apps/server test:       Tests  125 passed | 1 skipped (126)
apps/server lint: Done
exit=0
```

## Parent gate: token access and CAPY-182 (merged `origin/flotilla/p1` 0662ec8)
- When `GITHUB_TOKEN` is set, a non-admin gets `[]` from `GET /projects/suggestions`. They also get 403 for any GitHub repo, whether a `github` source, a `git-url` on github.com, the legacy `repo` body or a `lazy` entry, and when cloning one. Admins are the operators who configure the server token. Without a token, nobody uses it, so members can add public GitHub repos. Fixed in 893bd47.
- CAPY-182 is downgraded to `blocked`. Teammates cannot start threads in `shared` projects, so no collaborator use is claimed.
- The merge of p1 had conflicts in docs only (PARITY, PROGRESS, DECISIONS-LOG); both sides were kept. Counts after the merge: done 110, pending 462, needs-human-login 17, n-a 22, blocked 21.

Red first (`npx vitest run src/projects/projects.test.ts -t "only admins"`, before the route change):
```
   × projects (phase2-29) > CAPY-181: only admins may use the server GitHub token for suggestions, GitHub sources and clones 24ms
     → expected [ Array(3) ] to deeply equal []
      Tests  1 failed | 6 skipped (7)
```
After (`npx vitest run src/projects`):
```
 ✓ src/projects/projects-read.test.ts (2 tests) 1542ms
 ✓ src/projects/projects.test.ts (7 tests) 1961ms
 Test Files  2 passed (2)
      Tests  9 passed (9)
```
`make check`:
```
apps/web test:  Test Files  4 passed (4)
apps/web test:       Tests  14 passed (14)
apps/server test:  Test Files  23 passed (23)
apps/server test:       Tests  141 passed | 1 skipped (142)
apps/web lint: Done
apps/server lint: Done
exit=0
```
`npx playwright test e2e/projects.spec.ts e2e/features.spec.ts`: `5 passed (2.8s)`.

## Devin Review round 3 (f27e78d)
- Fixed in 5869f88: when a user chose a branch the repo doesn't have, `materialize` saved the mirror default instead. A user-chosen branch is now marked `branchPinned`, and a missing pinned branch returns 409 `base branch <name> not found`. Only an unspecified branch falls back to the mirror default (as with master-only repos). Test: `CAPY-178/179/181` in `projects.test.ts`.

## Devin Review round 4 (f7d068)
- Fixed in 33e21e9: creating a project whose primary branch was chosen but doesn't exist used to return 201, and threads then used the missing branch. A pinned primary is now mirrored before responding. A missing branch returns 409 `base branch <name> not found` and the project row is deleted. A primary with no chosen branch still mirrors in the background.
- Fixed in ccaedec: a failed lazy clone used to fail silently in the UI. It now shows `Could not clone <repo> on branch <branch> (<status>)`. Browser proof: `npx playwright test e2e/projects.spec.ts` gives `2 passed (3.2s)`.
