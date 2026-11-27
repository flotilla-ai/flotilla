# Flotilla troubleshooting

Use this operator guide before changing configuration. Prefer thread/machine events and failure cards over guessing; live vendor login still requires a human.

## Machine was replaced
`machine.replaced` or a fresh container id
- Symptoms: workspace files missing, machine state is awake after a failure.
- Recovery: wake the thread machine, confirm `flt-workspace-<thread>` still exists with `docker volume ls`, inspect `machine.state` events, then rebuild the environment if the volume is really gone.

## Setup or dev processes are gone
`environment_processes` rows are stopped/failed
- Symptoms: a port no longer responds after sleep, wake, or container replacement.
- Recovery: wake the machine, rerun the environment startup entries, and inspect the process row/log before editing the command.

## Environment setup failed
setup step exits nonzero or readiness never becomes ready
- Symptoms: machine boots but tests or dev servers do not start.
- Recovery: read the failed step log, fix the setup spec or dependency, create a new environment version, and retry on a fresh machine.

## Snapshot build is failing
snapshot history shows a failed build
- Symptoms: boot still uses the last good image or base image.
- Recovery: open snapshot history, use the failed step log as the repair prompt, and keep the last good image until a replacement succeeds.

## Credits, budget, or usage looks wrong
run paused with budget approval or usage totals look stale
- Symptoms: spent usd/input/output/machine seconds stop increasing.
- Recovery: check `/usage` and cost events. Machine-time charges are separate from model tokens; service users have the lower API RAM admission limit.

## Codex or Claude needs reconnecting
vendor adapter asks for authentication or reports an expired connection
- Symptoms: threads fail before the first agent message.
- Recovery: reconnect with the official vendor CLI inside the thread machine. Flotilla never stores browser session tokens.

## Machine, file, Drive, or upload limits
409/413 responses, Drive full cards, or concurrent RAM failures
- Symptoms: machine start waits then fails, upload too large, file too large.
- Recovery: follow the failure card: delete unused Drive versions, wake fewer machines, split oversized uploads, or raise only documented operator limits.

## CI or review events were ignored
archived threads stay dormant and no autofix run starts
- Symptoms: webhook arrives but the thread does not wake.
- Recovery: unarchive the thread or create a follow-up thread. Archived threads intentionally do not spend money on CI wakes.

## A thread is waiting or appears stuck
approval, plan gate, machine start wait, or queued inbox item
- Symptoms: no agent output even though the run is active.
- Recovery: open Needs-you/requests, inspect thread status and machine state, and do not interrupt during the one-minute machine admission wait.

## Archived thread behavior
thread is archived and hidden from active work
- Symptoms: messages, CI, or timers do not continue.
- Recovery: unarchive before sending work. Archiving is durable dormancy, not just a list filter.

## Ports, previews, or networking do not work
preview/private port is unreachable or public internet is blocked
- Symptoms: server listens inside the machine but the browser cannot connect.
- Recovery: use the preview URL rather than direct container ports and check the per-thread egress allowlist; untrusted project egress is fail-closed.

## MCP server or plugin fails
MCP tools are unavailable, private network access denied, or plugin install fails
- Symptoms: agent cannot call an expected MCP tool.
- Recovery: inspect the MCP registry/plugin state. Private-network MCP endpoints require explicit `FLOTILLA_MCP_ALLOW_PRIVATE=1`.
