# phase3-16 keyboard shortcuts and notifications

ROWS: CAPY-443..452

Verification:
- `pnpm --filter @flotilla/server exec vitest run src/notifications/notifications.test.ts` — 1 passed
- `cd apps/web && pnpm exec vitest run src/features/keyboard-shortcuts/keyboard-shortcuts.test.tsx src/features/notifications/notifications.test.tsx` — 2 passed
- `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` — passed
- `cd apps/web && pnpm exec tsc --noEmit -p tsconfig.json` — passed

Implemented:
- CAPY-443..447: typed default shortcut map covering command menu, navigation, thread actions and model favorites; normalization, conflict detection, event matching, remap persistence and `/settings/shortcuts` editor.
- CAPY-448: durable per-user notification settings for requests, failures, sounds, system alerts, device push and Slack DM preference.
- CAPY-450: mention parsing notifies matching users by email or email local-part through durable notification rows.
- CAPY-451: unread-count API plus web badge/title helper.
- CAPY-452 partial fixture: deterministic PR merge/close follow-up sentence generator.

Blocked:
- CAPY-449: browser push while closed requires a real Web Push/VAPID sender; this unit only persists subscriptions and does not implement signed push delivery.
- CAPY-452: Slack DM delivery requires the Slack integration/vendor credentials; only local follow-up copy is fixture-proven.

Unverified: no browser end-to-end run; routes are fixture-tested through Hono and Postgres but not through compose.
