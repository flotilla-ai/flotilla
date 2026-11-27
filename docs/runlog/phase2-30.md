# phase2-30 Drive core

Branch `flotilla/phase2-30-drive-core` from `origin/flotilla/p1`, then real-merged `eba906f` (phase2-17). Temporary Postgres 16 container, temp blob dir, fake machine driver, fake adapter, Playwright with mocked API. No vendor calls or logins.

## Rows
- done: CAPY-272, CAPY-273, CAPY-274, CAPY-275, CAPY-276, CAPY-278, CAPY-279, CAPY-502, CAPY-503.
- blocked: CAPY-277 (point-in-time tar served by `GET /threads/:id/drive/copy`; no BYOM machine unpacks it into `~/.flotilla/drive` yet).

## Changes
- `apps/server/src/db/migrations/0019_drive.sql`: `drive_items`, `drive_versions`.
- `apps/server/src/drive-core/types.ts`, `store.ts`: scopes/access, blobs, save/versions/restore, quota, thread view, mount, write-back, local copy, failure cards.
- `apps/server/src/routes/drive-core.route.ts`: `/drive/scopes`, `/drive/items`, `PUT /drive/files`, `/drive/items/:id{,/content,/versions,/restore}`, `DELETE /drive/items/:id`, `/threads/:id/drive{,/copy}`.
- `apps/server/src/modules/drive-core.module.ts`; `apps/server/src/runner/runner.ts`: new `onBeforeRun` hook (note appended to the prompt).
- `apps/web/src/features/drive-core/index.tsx` (`/#/drive`), `apps/web/e2e/drive-core.spec.ts`.

## Red first
`npx vitest run src/drive-core` before `store.ts` existed: `Failed to load url ./store.js ... src/drive-core/drive-core.test.ts` (Test Files 1 failed).

## Focused (after)
```
✓ src/drive-core/drive-core.test.ts > drive core > CAPY-272: org, personal, project, project+personal, automation and per-Captain drives are separate and access-checked 85ms
 ✓ src/drive-core/drive-core.test.ts > drive core > CAPY-273/274: root AGENTS.md and skills/<name>/SKILL.md of each thread scope are mounted and supplied to the run 42ms
 ✓ src/drive-core/drive-core.test.ts > drive core > CAPY-275: files the thread saves into its Drive are autosaved as versions by the thread, with no git commit 21ms
 ✓ src/drive-core/drive-core.test.ts > drive core > CAPY-276: browse folders, edit, upload up to 32 MB, delete 89ms
 ✓ src/drive-core/drive-core.test.ts > drive core > CAPY-277: a local copy is a point-in-time archive of the thread Drives, with no background sync 13ms
 ✓ src/drive-core/drive-core.test.ts > drive core > CAPY-278: history keeps every version (no 24 h expiry) and restore makes a new version 18ms
 ✓ src/drive-core/drive-core.test.ts > drive core > CAPY-279/502: 100 MiB per file, quota per Drive with a Drive is full card, and usage past 2 GiB 51ms
 ✓ src/drive-core/drive-core.test.ts > drive core > CAPY-503: mount and save failures open a card that explains the next step; runs still start 19ms
 ✓ src/drive-core/drive-core.test.ts > drive core > runner seam: Drive is copied in before the run, its note reaches the prompt, and edits are saved after it 134ms
 Test Files  1 passed (1)
      Tests  9 passed (9)
  ✓  1 e2e/drive-core.spec.ts:2:1 › CAPY-276 Drive page browses, edits, uploads and deletes; CAPY-279 shows the Drive is full card (864ms)
```

## `pnpm --filter @flotilla/server test`
First run after merging phase2-17: `Tests 1 failed | 154 passed | 1 skipped (156)`; the failure was `wakes.test.ts` CAPY-041 (`expected 2 to be 1`, archived-thread timer run count). That file passed 3/3 alone and in `make check` below; it is the phase2-17 timer race that open PR #49 (repair-12) targets, not Drive code.

## `make check`
```
packages/core test:  Test Files  6 passed (6)
packages/core test:       Tests  15 passed (15)
apps/gate test:  Test Files  2 passed (2)
apps/gate test:       Tests  5 passed (5)
packages/adapters/host test:  Test Files  1 passed (1)
packages/adapters/host test:       Tests  3 passed (3)
apps/web test:  Test Files  5 passed (5)
apps/web test:       Tests  15 passed (15)
packages/adapters/claude-code test:  Test Files  1 passed (1)
packages/adapters/claude-code test:       Tests  7 passed (7)
packages/adapters/codex test:  Test Files  1 passed (1)
packages/adapters/codex test:       Tests  5 passed (5)
packages/adapters/generic-cli test:  Test Files  1 passed (1)
packages/adapters/generic-cli test:       Tests  4 passed (4)
packages/adapters/fake test:  Test Files  1 passed (1)
packages/adapters/fake test:       Tests  3 passed (3)
apps/server test:  Test Files  24 passed (24)
apps/server test:       Tests  155 passed | 1 skipped (156)
make check exit=0
```

## Unverified
- Real Docker `putArchive`/`getArchive` of `/run/flotilla/drive` (fake driver only); a real thread image writing into the mount.
- Blob dir on the compose volume (`FLOTILLA_DRIVE_DIR`, default `/data/drive`) after restart; blobs are never garbage-collected.
- Uploads near 32 MB / files near 100 MiB through the browser (limits tested with small configured limits; 2 GiB+ usage via recorded sizes).
- Drive failure cards rendered in the thread request list (stored as `approvals` rows; not checked in the browser).
- CAPY-277 on a local (BYOM) machine.
