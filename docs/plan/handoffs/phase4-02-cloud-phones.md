GOAL
Implement the smallest fixture-backed Flotilla foundation for cloud phone provider foundation, honestly terminalizing every assigned parity row as done, blocked or needs-human-login.

BRANCH: flotilla/phase4-02-cloud-phones
PR TARGET: flotilla/p1 (never main)
DEPENDS ON: phase2 exit merged unless the row implementation only uses earlier merged foundations.
SCOPE: apps/server/src/cloud-phones, apps/web/src/features/cloud-phones, docs/runlog/phase4-02.md
OUT OF SCOPE: shared files except the unit-owned route/module registration when required; live vendor credentials; deployment; changes to main.
SHAPES
Define TypeScript row/result types first in the owning module. Persist durable state in Postgres migrations owned by this unit. Use fake adapters and local fixtures only.
DONE SIGNAL
`pnpm --filter @flotilla/server exec vitest run src/cloud-phones*` or the unit's focused test passes, `pnpm --filter @flotilla/server exec tsc --noEmit -p tsconfig.json` passes, and `make check` passes before PR merge.
EXPECTED
- `CAPY-261`: Attach iOS/Android cloud phones to a thread (Revyl); screen only — Flotilla equivalent: Mobile QA on BYO KVM host / Mac (emulator + Maestro/Appium); third-party dependency; Flotilla needs pluggable device provider (Appium/Maestro/emulator)
- `CAPY-262`: Revyl auto-connects on first use; admin approval if user already has Revyl — Flotilla equivalent: Mobile QA on BYO KVM host / Mac (emulator + Maestro/Appium)
- `CAPY-263`: Admins disconnect / toggle Mobile builds and devices — Flotilla equivalent: Mobile QA on BYO KVM host / Mac (emulator + Maestro/Appium)
- `CAPY-264`: Device models (iPhone 18 Pro Max…iPad Pro, Pixel 7) — Flotilla equivalent: Mobile QA on BYO KVM host / Mac (emulator + Maestro/Appium)
- `CAPY-265`: Mobile builds on Revyl runners (Expo/RN, native iOS, native Android) with build row in chat — Flotilla equivalent: Mobile QA on BYO KVM host / Mac (emulator + Maestro/Appium)
- `CAPY-266`: Build limits: queue cancel after 2 h, one infra retry — Flotilla equivalent: Mobile QA on BYO KVM host / Mac (emulator + Maestro/Appium)
- `CAPY-267`: iOS runner spec (macOS 26.6.2, Xcode 27.0…) — Flotilla equivalent: Mobile QA on BYO KVM host / Mac (emulator + Maestro/Appium)
- `CAPY-268`: Watch/use phone live; Home/Back/Rotate/Open URL toolbar — Flotilla equivalent: Mobile QA on BYO KVM host / Mac (emulator + Maestro/Appium)
- `CAPY-269`: Sessions ≤60 min; sleep keeps build, not app data; shared slots; 'Waiting for a phone' — Flotilla equivalent: Mobile QA on BYO KVM host / Mac (emulator + Maestro/Appium); [CAP] phone $/h counts
- `CAPY-270`: Read app logs (logcat; iOS os_log/NSLog) — Flotilla equivalent: Mobile QA on BYO KVM host / Mac (emulator + Maestro/Appium)
- `CAPY-271`: Phone pricing iPhone $5.40/h, Android $3.60/h; Pro+ — Flotilla equivalent: Mobile QA on BYO KVM host / Mac (emulator + Maestro/Appium)
DIFF BUDGET: <= 15 files / <= 800 lines, excluding generated fixtures only when necessary.
Context
Read SPEC Appendix A rows listed below and only the SPEC sections directly relevant to those rows. Do not claim live vendor behavior without a fixture-independent implementation. Rows requiring a real vendor login must carry exact operator verification commands.

ROWS: CAPY-261, CAPY-262, CAPY-263, CAPY-264, CAPY-265, CAPY-266, CAPY-267, CAPY-268, CAPY-269, CAPY-270, CAPY-271
