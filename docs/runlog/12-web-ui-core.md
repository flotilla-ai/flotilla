# 12 web UI core

## Implemented
- React/Vite SPA with hash routing, login form, thread list, live thread view over SSE, ordered event rendering, cost header, and soft-cap labeling for remote engines.
- Feature extension point via `import.meta.glob('./features/*/index.tsx')`.
- Public static route serving the built SPA with path containment and index fallback.

## Verification
```text
$ pnpm --filter @flotilla/web build
✓ built in 108ms
$ cd apps/web && pnpm test:e2e
2 passed (1.4s)
```
`make check` passes.

## Unverified
- E2E uses Playwright route interception rather than a full server seeded through Postgres; backend-backed setup/login/SSE remains unverified.
- Screenshot capture is not attached in this pass.
