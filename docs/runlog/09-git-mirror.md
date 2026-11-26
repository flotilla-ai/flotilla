# 09 git mirror

## Implemented
- Server-owned bare mirrors keyed by project id, cloned/fetched with the token supplied only through per-command `http.extraHeader` environment config.
- Thread seeding through a mirror-generated bundle copied into the container and cloned onto `flotilla/<code>-<slug>`.
- Collection through a container-generated bundle, staging into `refs/incoming/<thread>/`, protected-ref validation before any push, and pushes using disabled hooks/fsmonitor, no system config, and an empty temporary HOME.
- Per-repository push serialization.

## Verification
```text
$ pnpm --filter @flotilla/server test -- git/mirror
 Test Files  4 passed (4)
      Tests  23 passed | 1 skipped (24)
```
The tests use a local bare repository and FakeDriver. They verify seed branch/content, push sha, protected-ref rejection, no token in mirror config, and non-execution of executable hooks / sshCommand / fsmonitor / credential helper planted in the thread worktree.

## Gaps
- The real-container variant is `unverified` here; Docker copyOut/tar shape is shared with unit 05 but not yet rerun for this unit.
- GitHub visibility checking is implemented but not covered against the live GitHub API.
