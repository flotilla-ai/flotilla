# vms-02 runlog

## Result

Implemented host capacity detection, quota allocation and the pure kernel compute guard:

- reserves: max(2 GB, 25% RAM), 1 CPU, 20 GB disk by default
- Captain defaults 2 vCPU / 4096 MB / 32 GB and minimum 1 / 2048 / 16
- RAM no overcommit, CPU at most 2x allocatable, disk at most 90% free-after-reserve
- denials create decision cards with the required RAM/CPU/disk explanation
- allocation state API supports budget-stop transitions
- with `FLOTILLA_COMPUTE_ISOLATION` off, evaluation returns zero-impact allow and contacts neither capacity detection nor SQL

## Test output

```text
pnpm --filter @flotilla/core exec vitest run src/kernel/computeGuard.test.ts
Test Files  1 passed (1)
Tests  4 passed (4)

pnpm --filter @flotilla/server exec vitest run src/compute-quota/compute-quota.test.ts
Test Files  1 passed (1)
Tests  4 passed (4)

pnpm -r typecheck
exit 0

make check
exit 0
```
