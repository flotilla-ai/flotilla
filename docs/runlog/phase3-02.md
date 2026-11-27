# phase3-02 watches and captain sharing

Implemented durable agent-set watches for GitHub events, Slack channel ids and HTTPS webhook URLs with a hard 30-day expiry bound, cancellation, and fixture-backed event matching (`src/watches/watches-captain-sharing.test.ts`: 2 passed). Implemented Captain org/user sharing with narrowing confirmation, access checks, audited owner-only rename/face/crew placement/transfer/demote/delete actions, and `captain=` plus `!queue`/`!steer` command parsing.

Rows: CAPY-042, CAPY-087 and CAPY-089 done. CAPY-093 remains blocked because no Slack inbound integration exists to deliver commands. CAPY-494 remains blocked because no Linear mention integration exists.
