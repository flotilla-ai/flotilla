# phase2-33 skills

Branch `flotilla/phase2-33-skills` from `origin/flotilla/p1` (`ea9ec15`), then real-merged `eba906f` (phase2-17). Fake adapter, fake machine driver recording `copyIn` tars, local process transport over a fixture git repo, temporary Postgres 16 container. No vendor calls or logins.

## Rows
- done: CAPY-295, CAPY-296, CAPY-297, CAPY-298, CAPY-299, CAPY-300, CAPY-301 (see PARITY notes for the exact boundary of each).

## Changes
- `apps/server/src/db/migrations/0021_skills.sql`: `skills` (repo/Drive/plugin folders, files jsonb), `skill_disabled`, `skill_invocations`.
- `apps/server/src/skills/types.ts`: `Skill`, `SkillSource`, `SkillLoadState`, `SkillInvocation`; `parseSkillMd`, `validateSkill`, `resolveSkills` (precedence + markers), `parseInvocations`, `skillsTar`, `BUILTIN_SKILLS`.
- `apps/server/src/skills/store.ts`: `SkillStore` (list, save, import, disable, resolve, repo scan, `prepareRun`).
- `apps/server/src/routes/skills.route.ts`: `GET/POST /skills`, `POST /skills/import`, `PUT /skills/disabled`, `POST /skills/resolve`, `DELETE /skills/:id`, `GET /threads/:id/skills` (all `/api/v1`, session-only).
- `apps/server/src/modules/skills.module.ts` + `apps/server/src/runner/runner.ts`: new `onBeforePrompt` hook (after machine/workspace/attachments, before adapter start; hook failures are logged and the run continues).
- `apps/web/src/features/skills/index.tsx`: `#/skills` page with markers and Turn on/off.

## Red first
`npx vitest run src/skills` (server) before `types.ts` existed:
```
 FAIL  src/skills/skills.test.ts
Error: Cannot find module './types.js' imported from '/home/ubuntu/repos/flotilla/apps/server/src/skills/skills.test.ts'
 Test Files  1 failed (1)
      Tests  no tests
```
`npx vitest run src/features/skills` (web) before `index.tsx` existed:
```
 FAIL  src/features/skills/skills.test.tsx [ src/features/skills/skills.test.tsx ]
Error: Cannot find module './index.js' imported from '/home/ubuntu/repos/flotilla/apps/web/src/features/skills/skills.test.tsx'
      Tests  no tests
```

## Focused (after)
```
 ✓ src/skills/skills.test.ts > skills > CAPY-299: SKILL.md needs name + description frontmatter; a bad file is listed as Not loaded with the reason 42ms
 ✓ src/skills/skills.test.ts > skills > CAPY-296: built-in skills are listed, loaded and mounted into the thread in agent-native skills folders 131ms
 ✓ src/skills/skills.test.ts > skills > CAPY-297: repository skills in .agents/skills and .claude/skills are discovered from the checkout and mounted 113ms
 ✓ src/skills/skills.test.ts > skills > CAPY-298: Drive (personal and project) and plugin skills load and mount 121ms
 ✓ src/skills/skills.test.ts > skills > CAPY-300: Skills page markers: Replaced by a higher source, and Not loaded when turned off 125ms
 ✓ src/skills/skills.test.ts > skills > CAPY-295: $, /, @ or plain words invoke a skill; the agent is told which SKILL.md to read and the invocation is recorded 114ms
 ✓ src/skills/skills.test.ts > skills > CAPY-301: skills from Claude Code, Cursor and the skills CLI are reused by copying their folders 119ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
```
```
 ✓ src/features/skills/skills.test.tsx (1 test) 11ms
 Test Files  1 passed (1)
      Tests  1 passed (1)
```

## Done signal
Branch real-merged `6b5546a` (repair-10/12) on top of `eba906f`, then `2aefb24` (phase2-18; runner keeps both the `createThread` draft/placement changes and `onBeforePrompt`). Final head after the Devin Review fix round (folder size cap on save, binary repo files skipped, shebang files mounted 0755, import uses the root-most `skills` dir and validates every folder before saving any, Skills page project picker; each with a red-first assertion in the focused tests). `pnpm --filter @flotilla/server test` lines from the `make check` run:
```
apps/server test:  Test Files  25 passed (25)
apps/server test:       Tests  165 passed | 1 skipped (166)
```
`make check` (lint, typecheck, every package's tests):
```
apps/gate test:       Tests  5 passed (5)
packages/core test:       Tests  15 passed (15)
packages/adapters/host test:       Tests  3 passed (3)
apps/web test:       Tests  17 passed (17)
packages/adapters/codex test:       Tests  5 passed (5)
packages/adapters/claude-code test:       Tests  7 passed (7)
packages/adapters/generic-cli test:       Tests  4 passed (4)
packages/adapters/fake test:       Tests  3 passed (3)
apps/server test:       Tests  165 passed | 1 skipped (166)
exit=0
```
An earlier `make check` (before repair-12 merged) failed once in phase2-17's CAPY-041 wake timer test (out of scope; 3 isolated reruns passed 13/13; repair-12 since synchronized that test).

## Unverified
- Real Docker `putArchive` of the skills tar into `/home/node` in `flotilla-thread:dev` (directory ownership, and whether Claude Code / Codex CLIs pick skills up from `~/.claude/skills` / `~/.agents/skills` / `~/.codex/skills`) — needs a live thread with vendor login: `claude auth login` / `codex login` in a thread, then ask "list your skills".
- Binary repo skill files (any NUL byte) are skipped, not mounted; text files only.
- Repo scan runs `bash`, `find` and `base64 -w0` on the machine; proven on the local transport only.
- Slack `$name` resolution (P3 Slack unit), Drive file browser / plugin installer UI, and a local-folder picker or CLI for import are not built.
