# repair-6: isolate git hook test from external repository scans

## Scope

Repair the intermittent `git/mirror.test.ts` failure where the repository-controlled `core.fsmonitor` marker sometimes appeared under full-suite load.

## Root cause

The failure was not caused by Flotilla's mirror commands. Instrumenting the fsmonitor hook showed it being invoked by `git status --porcelain ...` whose parent was `/mnt/host_share/devin-remote`, not the test or any `collectAndPush` git process. The external daemon occasionally scans newly created temporary repositories. Once the test writes hostile config, that scan can execute the fsmonitor hook and create the marker, making the test flaky even though Flotilla's own commands are correctly hardened.

A controlled probe with an environment-gated hook confirmed `git -c core.fsmonitor=false status` does **not** execute the repository hook when invoked by the test process.

## Changes

- `apps/server/src/git/mirror.test.ts`: hook/config marker scripts now create markers only when `FLOTILLA_UNDER_TEST` is present. Flotilla-spawned git commands inherit that variable; the external scanner does not. The test therefore distinguishes hook execution caused by this code path from unrelated environmental repository scans.
- The hostile repo config is written directly instead of running extra `git config` commands after the hostile values are in place.
- No production mirror code changes: the existing explicit `core.fsmonitor=false` hardening is correct.

## Verification

Controlled probe in a temporary repository:
```text
plain core.fsmonitor hook + git status       -> marker created
git -c core.fsmonitor=false status           -> marker absent
git -c core.fsmonitor= status                -> marker absent
```

```text
$ cd apps/server && npx vitest run src/git/mirror.test.ts --reporter=dot
 Test Files  1 passed (1)
      Tests  4 passed (4)
exit=0
```

```text
$ cd apps/server && for i in 1 2 3 4 5 6; do npx vitest run src --reporter=dot; done
exit 0, 6/6 full server-suite runs
```

## Unverified

- Long-run CI flake rate after merge; the external-scanner mechanism is proven by process-parent instrumentation and six local full-suite runs, not by a large CI sample.
