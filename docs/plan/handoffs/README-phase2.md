# Phase 2 unit waves

P2a covers platform/runner/adapters/machines/wakes/subagents/Captains. P2b covers review, automations, Drive, skills, rules, MCP, environments, secrets, usage and supporting APIs. Rows are assigned exactly once; run `python3 docs/plan/scripts/parity_coverage.py P2`.

| Wave | Units | Notes |
|---|---|---|
| 1 serialized foundations | phase2-01, phase2-02, phase2-03, phase2-04 | Shared API/security/model behavior; merge in order. |
| 2 core threads and runner | phase2-05, phase2-06, phase2-07, phase2-08, phase2-09 | Start after phase2-01; independent scopes may run in parallel. |
| 3 execution infrastructure | phase2-10, phase2-11, phase2-12, phase2-13, phase2-14, phase2-15, phase2-16 | Environments before snapshots; machine core before machine UX; devices pairing before execution/dock. |
| 4 orchestration | phase2-17, phase2-18, phase2-19, phase2-20, phase2-21, phase2-22 | Wakes/subagents after runner queue; Captain units after wakes and subagent core. |
| 5 work surfaces | phase2-23, phase2-24, phase2-25, phase2-26, phase2-27, phase2-28 | PR/review/automation surfaces can run in parallel after their core dependencies. |
| 6 knowledge and integrations | phase2-29, phase2-30, phase2-31, phase2-32, phase2-33, phase2-34, phase2-35, phase2-36 | Drive before Drive UX; catalog before usage/API polish. |
| 7 documentation | phase2-37 | Last, after behavior names settle. |

## Units

| Unit | Rows | Title |
|---|---:|---|
| phase2-01-api-platform | 10 | API platform foundation |
| phase2-02-secrets | 12 | Secrets vault and env API |
| phase2-03-models-catalog | 8 | Model catalog and connections |
| phase2-04-model-policy-api | 7 | Model policy and model API |
| phase2-05-runner-queue | 14 | Durable runner queue and steer modes |
| phase2-06-thread-composer | 10 | Composer attachments and reading UX |
| phase2-07-thread-lifecycle | 11 | Thread lifecycle and collaboration |
| phase2-08-thread-api | 11 | Thread lifecycle API |
| phase2-09-previews | 7 | Preview lifecycle and sharing |
| phase2-10-environments | 9 | Development environments |
| phase2-11-snapshots | 6 | Machine snapshots |
| phase2-12-machine-core | 12 | Cloud machine lifecycle |
| phase2-13-machine-ux-network | 5 | Machine UX and networking |
| phase2-14-devices-pairing | 10 | Paired devices |
| phase2-15-device-execution | 7 | Runner execution on devices |
| phase2-16-dock-cli | 11 | Dock CLI |
| phase2-17-wakes | 13 | Wake router and background waits |
| phase2-18-subagent-core | 11 | Subagent lifecycle |
| phase2-19-subagent-forks-api | 8 | Forks, side chats and subagent API |
| phase2-20-captain-create-crew | 10 | Captain creation and crew rules |
| phase2-21-captain-machine-api | 12 | Captain machine, profile and API |
| phase2-22-captain-ops | 14 | Captain digest and operations |
| phase2-23-pr-autofix | 11 | Pull requests and autofix |
| phase2-24-review-core | 13 | Review agent core |
| phase2-25-review-policy | 9 | Review policy and guides |
| phase2-26-automations-core | 13 | Automation triggers and runs |
| phase2-27-automation-control | 7 | Automation operations and webhook safety |
| phase2-28-automation-api | 15 | Automation REST API |
| phase2-29-projects | 6 | Projects |
| phase2-30-drive-core | 10 | Drive storage core |
| phase2-31-drive-ux | 4 | Drive UX and sharing |
| phase2-32-rules | 11 | Instructions and rules |
| phase2-33-skills | 7 | Skills |
| phase2-34-mcp | 11 | MCP registry and plugins |
| phase2-35-github-integration | 8 | GitHub accounts and installations |
| phase2-36-usage-billing-api | 9 | Usage, budgets and API models |
| phase2-37-support-docs | 1 | Troubleshooting guide |
