GOAL
Unblock CAPY-206, CAPY-207, CAPY-208: build the row-specific behavior below and prove each row with a merged test (fake agent, local fixtures or a local mock), or re-block the row with a sharper cause that truly needs mehdi.

BRANCH: flotilla/unblock-37-thread-image-tools
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: none
SCOPE: deploy/thread.Dockerfile, apps/server/src/thread-image, one unit-owned `apps/server/src/routes/*.route.ts` / `modules/*.module.ts` / `db/migrations/00NN_*.sql` where needed, docs/runlog/unblock-37.md
OUT OF SCOPE: shared files (compose, root package.json, server entry, `packages/core` shared types, `deploy/thread.Dockerfile`) unless named in SCOPE; other units' tests; live vendor credentials; paid APIs; deployment; `main`.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in a Postgres migration owned by this unit (next free number). Use the scripted `fake` adapter, recorded fixtures and local mocks (a local HTTP server standing in for the vendor) only.
DONE SIGNAL
The unit's focused tests pass (`pnpm --filter @flotilla/server exec vitest run <unit test files>`), `pnpm -r typecheck` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-206`: Preinstalled toolchain (Node/Python/Go/Rust/Java/Ruby, Docker, k8s tools, DB clients, gh stack…). Test proves: the thread image contains Go, Rust, Java, Ruby, docker CLI, kubectl, psql / mysql / redis clients and gh; a test runs `--version` for each in the built image (or lists them `unverified (no docker in VM)`).
- `CAPY-207`: Auto Node version from .nvmrc/.node-version. Test proves: a repo with `.nvmrc` or `.node-version` gets that Node version on PATH at boot through a version manager in the image.
- `CAPY-208`: Docker + Compose inside VM; local Kubernetes (Kind/Minikube/k3s) with caveats. Test proves: Docker and Compose work inside the machine through a rootless or sidecar daemon when the machine option is on; Kind / k3s caveats are documented and the default machine keeps `--cap-drop ALL`.
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read `docs/plan/DEVIN-GOAL-ALL.md` sections 3 to 6, the `note` of each row in `docs/plan/PARITY.md` (the measured cause), and only the SPEC sections directly relevant to these rows. Never claim live vendor behavior: a fixture-proven row is `done` and its live command goes to `docs/runlog/UNBLOCK-EXIT.md` under "live checks for mehdi". UI: greys and black, orange only for "needs you", no pill badges. New dependencies: MIT / Apache-2.0 / BSD / ISC only, recorded in `THIRD_PARTY_NOTICES.md`. After three failed attempts re-block each row with what was tried and the exact access, tool or decision missing.

ROWS: CAPY-206, CAPY-207, CAPY-208
