# phase2-09 runlog: Preview lifecycle and sharing

Rows: CAPY-218, 219, 221, 223, 224, 225, 226. Proven offline with a throwaway `postgres:16` container, a fake `PreviewMachine`, a local upstream HTTP server and a mocked dockerode for the pool limits. No vendor calls, so no row needs a human login.

## Focused tests (measured)

```text
$ cd apps/server && npx vitest run src/previews src/machines/machines.test.ts --reporter=verbose
✓ src/machines/machines.test.ts > pool machine limits > CAPY-218: memory limit has no swap headroom and the kernel OOM killer stays on, so the largest process is killed instead of the machine freezing 1ms
✓ src/machines/machines.test.ts > pool machine limits > CAPY-219: the pool only runs Linux; macOS/iOS requests are refused and pointed at a paired device 1ms
✓ src/previews/lifecycle.test.ts > preview lifecycle > CAPY-221: suggests listening ports from the machine, hides reserved ports and refuses to expose them 50ms
✓ src/previews/lifecycle.test.ts > preview lifecycle > CAPY-226: a thread without a PR has an in-machine URL for the machine browser plus the private preview URL 2ms
✓ src/previews/lifecycle.test.ts > preview lifecycle > CAPY-223: each request keeps the machine awake 5 more minutes up to 4 h; an asleep machine shows a Start the machine link 81ms
✓ src/previews/lifecycle.test.ts > preview lifecycle > CAPY-224: the URL is stable across sleeps and the start command reruns when nothing is listening 87ms
✓ src/previews/lifecycle.test.ts > preview lifecycle > CAPY-225: portless-style hostname routers get the configured Host header 24ms
✓ src/previews/lifecycle.test.ts > preview lifecycle > share links flip access to shared, expire, and are revoked when access goes back to private 55ms
Test Files  3 passed (3)
Tests  20 passed | 1 skipped (21)
```

The lifecycle test was written first and failed to load (`Failed to load url ./machine.js`) before `machine.ts`/`store.ts` existed.

## CAPY-218 live container check (measured, local Docker)

Same HostConfig flags as `DockerMachineDriver` (`Memory == MemorySwap`, OOM killer on, `--init`):

```text
$ docker run --rm -m 64m --memory-swap 64m --init --name oomdemo -d node:22-alpine sh -c 'sleep infinity'
$ docker exec -d oomdemo sh -c 'sleep 600'
$ docker exec oomdemo node -e 'const a=[];for(;;)a.push(Buffer.alloc(8<<20,1))'; echo "allocator exit=$?"
allocator exit=137
container running=true oomkilled=true
    9 sleep 600
Memory=67108864 MemorySwap=67108864 OomKillDisable=<nil>
```

## Done signal (measured)

```text
$ pnpm --filter @flotilla/server test
 Test Files  1 failed | 14 passed (15)
      Tests  1 failed | 69 passed | 1 skipped (71)
   × git mirror > collects and pushes without token in mirror config or agent hooks/config running
exit=1
$ cd apps/server && npx vitest run src/git/mirror.test.ts
 ✓ git mirror > collects and pushes without token in mirror config or agent hooks/config running  310ms
      Tests  4 passed (4)
```

`make check`: typecheck passes in all packages; tests fail only on the same `git/mirror.test.ts` case; `pnpm -r lint` exit 0 when run alone. The failure is pre-existing and already logged in DECISIONS-LOG (phase2-02). It reproduces on unchanged `origin/flotilla/p1` (`8ada8c0`, separate worktree and stashed checkout): 2 of 6 full-suite runs failed with the same assertion (`flotilla-fs-ran` marker exists). On this branch it failed in every full-suite run tried (8), including with `lifecycle.test.ts` excluded (3 of 3), so the new preview test is not the trigger; cause unverified. It passes alone. Escalated for a git-mirror repair unit; not touched here (outside scope).

## Unverified

- Real Docker end-to-end of `dockerPreviewMachine` (`/proc/net/tcp` read and `docker exec` start command inside a real thread container) - unit-tested parser only. Local command: `docker compose up -d`, start a fake thread, run `python3 -m http.server 3000` in `flt-<code>`, then `curl -b <preview cookie> http://localhost:8081/p/<code>/3000/`.
- Machine sleep/wake itself (stopping containers after `awake_until`) is owned by the machine-core unit; this unit records `awake_until` and shows the Start link only.
- No web UI controls for listing/exposing/sharing previews; rows are proven through the API.
- P2 wildcard host + Caddy TLS (`p<port>-<code>.<FLOTILLA_PREVIEW_DOMAIN>`) not implemented here.

## Review round 1

Devin Review found 4 issues and all 4 are fixed in one commit, each with a new failing-first assertion in `lifecycle.test.ts` (which failed 2 of 7 before the fix and passed 7 of 7 after):
- Share links set a path-scoped `flotilla_share` cookie, so follow-up asset requests no longer get 401. Revocation still blocks the cookie.
- The start command is not shown on the 503 card.
- The start command runs from `/workspace/repo` when it exists.
- Default links use `FLOTILLA_DOMAIN` instead of always using `localhost`.

```text
$ pnpm --filter @flotilla/server test   (after round-1 fixes)
      Tests  70 passed | 1 skipped (71)
$ pnpm -r lint
lint=0
```

## Review round 2

- Fixed: a revoked share cookie no longer overrides a valid private cookie (new assertion failed 401, then passed).
- Escalated: shared/private previews share one origin (`:8081`); per-preview origin isolation needs the P2 wildcard-host design.
