# phase3-14 UI navigation

Rows: CAPY-427..434, CAPY-508, CAPY-509, CAPY-512.

Verification:
- `cd apps/web && pnpm exec vitest run src/features/ui-navigation/ui-navigation.test.tsx` — passed, 1 test.
- `cd apps/web && pnpm exec tsc --noEmit -p tsconfig.json` — passed.

The slice is local-web foundation: grouping, customization, command filtering, tab/pane operations and onboarding state are pure tested behavior persisted in local storage. It does not yet rewire every existing product page or desktop shell; those broader integrations remain future work. No vendor or live service dependency.
