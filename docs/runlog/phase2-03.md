# phase2-03 runlog: Model catalog, device auth, and free fallback

Rows: CAPY-318, 325, 327-332. Proven offline against a throwaway `postgres:16` container, the fake adapter, a local OpenAI-compatible `/models` HTTP fixture and a fixture catalog file. No vendor calls or logins.

## Focused test (measured)

```text
$ cd apps/server && npx vitest run src/models-catalog --reporter=verbose
✓ src/models-catalog/models-catalog.test.ts > models catalog and connections > CAPY-318: catalog rows are adapter + model id with list price, BYOK and ZDR columns; operator file merges into the free built-ins 23ms
✓ src/models-catalog/models-catalog.test.ts > models catalog and connections > CAPY-328: searchable provider list built from adapter auth capabilities; subscriptions use the CLI device/vendor login 32ms
✓ src/models-catalog/models-catalog.test.ts > models catalog and connections > CAPY-329: check access lists models before connecting; excluded models stay out and new models are covered automatically 43ms
✓ src/models-catalog/models-catalog.test.ts > models catalog and connections > CAPY-330: custom model ids on your key are added and found by id, and then selectable on that connection 14ms
✓ src/models-catalog/models-catalog.test.ts > models catalog and connections > CAPY-325: effort none…max is validated per model; unsupported fails with no fallback; the chosen effort reaches the adapter 250ms
✓ src/models-catalog/models-catalog.test.ts > models catalog and connections > CAPY-327: order is owner → org → free; reorder, per-connection models, edit, test, reconnect, disable 58ms
✓ src/models-catalog/models-catalog.test.ts > models catalog and connections > CAPY-331: a model named on one connection runs only there — no fallback to other keys or free 123ms
✓ src/models-catalog/models-catalog.test.ts > models catalog and connections > CAPY-332: picker badges subscription/key/free with a tooltip naming the connection; favorites carry Alt+1…9 14ms
Test Files  1 passed (1)
Tests  8 passed (8)
```

## Done signal (measured)

```text
$ pnpm --filter @flotilla/server test   (after merging origin/flotilla/p1 8ada8c0)
× git mirror > collects and pushes without token in mirror config or agent hooks/config running 227ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
Test Files  1 failed | 14 passed (15)
Tests  1 failed | 69 passed | 1 skipped (71)
exit=1
```

The single failure is the pre-existing `git/mirror.test.ts` fsmonitor-marker flake already logged in phase2-02 (DECISIONS-LOG 2026-11-27). It reproduces with this unit's test excluded (`npx vitest run src --exclude 'src/models-catalog/**'`: 1 failed | 61 passed) and passes alone (`npx vitest run src/git`: 9 passed). Out of scope; escalated for a parent repair PR.

```text
$ make check   (after merge; typecheck and lint pass, same single mirror flake)
packages/core test:  Test Files  6 passed (6)
packages/core test:       Tests  15 passed (15)
apps/gate test:  Test Files  2 passed (2)
apps/gate test:       Tests  5 passed (5)
apps/web test$ vitest run --passWithNoTests src
packages/adapters/host test:  Test Files  1 passed (1)
packages/adapters/host test:       Tests  3 passed (3)
packages/adapters/codex test:  Test Files  1 passed (1)
packages/adapters/codex test:       Tests  5 passed (5)
packages/adapters/claude-code test:  Test Files  1 passed (1)
packages/adapters/claude-code test:       Tests  7 passed (7)
packages/adapters/generic-cli test:  Test Files  1 passed (1)
packages/adapters/generic-cli test:       Tests  4 passed (4)
packages/adapters/fake test:  Test Files  1 passed (1)
packages/adapters/fake test:       Tests  3 passed (3)
apps/server test:    × git mirror > collects and pushes without token in mirror config or agent hooks/config running 267ms
apps/server test: ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
apps/server test:  Test Files  1 failed | 14 passed (15)
apps/server test:       Tests  1 failed | 69 passed | 1 skipped (71)
exit=2
```

Before the merge, `make check` on `371f16b` passed end to end (`apps/server test: Tests 70 passed | 1 skipped (71)`, exit=0).

## What shipped

- `models-catalog/types.ts`: `ModelCatalogEntry`, `Connection`, `ModelSelection`, `ReasoningEffort` (+ provider, access check, picker item).
- `models-catalog/catalog.ts`: built-in free fake models, operator catalog file `FLOTILLA_MODEL_CATALOG` (JSON `{models}`), providers derived from adapter manifest `auth` (vendor-login → subscription, api-key → key) plus a custom OpenAI-compatible endpoint, effort parsing, access check.
- `models-catalog/store.ts` + migration `0006`: `model_connections` (user/org scope, position, enabled, status, sealed key via the phase2-02 local KMS, available/excluded/custom models) and `model_favorites`; resolve with no fallback when a connection is pinned; picker/favorites; `withConnectionKeys` injects only the pinned connection's key into run env.
- `routes/models-catalog.route.ts`: `/api/v1/models/{catalog,providers,check-access,resolve,picker}`, `/api/v1/connections[/order|/:id|/:id/test|/:id/models]`, `/api/v1/me/model-favorites`; session-gated.
- Thread create resolves `engine` through the catalog; the runner now passes `engine.model`/`engine.effort` to `StartInput`.

## Unverified / needs-human-login

- CAPY-318 real vendor rows and list prices: operator writes `FLOTILLA_MODEL_CATALOG=/etc/flotilla/models.json` with real entries; prices not invented here.
- CAPY-325 effort-to-CLI flag mapping on real CLIs: `claude auth login` then create a thread with `{"engine":{"adapter":"claude-code","model":"<model>","effort":"high"}}`; same with `codex login` for `codex`.
- CAPY-328 subscription device/vendor login: `docker compose exec server claude auth login` and `docker compose exec server codex login`, then `POST /api/v1/connections/:id/test`.
- CAPY-329/330 live key access check: `curl -X POST localhost:8080/api/v1/models/check-access -d '{"provider":"custom-openai","baseUrl":"<url>","apiKey":"<key>"}'` with a real gateway key (mehdi).
- CAPY-332 web picker UI is not wired; API returns badges, tooltips, favorites and Alt+1…9 shortcuts.
