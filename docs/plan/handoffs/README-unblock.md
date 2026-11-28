# Unblock run: handoffs and waves

Units clear the 199 `blocked` rows of groups A and B (see `docs/plan/BLOCKED-TRIAGE.md`). They are named `unblock-*` so `docs/plan/scripts/parity_coverage.py` (which globs `phaseN-*`) is unaffected. Each row belongs to exactly one unit.

A unit starts when its DEPENDS ON units are merged. Units in the same wave own disjoint paths; `deploy/thread.Dockerfile` is owned by unblock-37 only, `apps/runner` units (33, 35, 36) and `issues-web` / `pr-page` / `device-plane` pairs are serialized by their dependencies. Migration numbers are taken at branch time from the current `flotilla/p1`.

| Wave | Unit | Group | Depends on | Rows |
|---|---|---|---|---|
| 1 | [unblock-01-readme-quickstart](unblock-01-readme-quickstart.md) | README | plan PR merged | - |
| 1 | [unblock-02-web-composer-queue](unblock-02-web-composer-queue.md) | A1 | none | 009, 010, 026, 467, 468 |
| 1 | [unblock-03-web-composer-cards](unblock-03-web-composer-cards.md) | A1 | none | 465, 466, 469, 470, 476 |
| 1 | [unblock-04-web-settings-models](unblock-04-web-settings-models.md) | A1 | none | 043, 050, 332, 485 |
| 1 | [unblock-05-web-captain-automations](unblock-05-web-captain-automations.md) | A1 | none | 067, 078, 098, 153, 495 |
| 1 | [unblock-06-issues-web-list](unblock-06-issues-web-list.md) | A2 | none | 101, 102, 103, 107 |
| 1 | [unblock-07-issues-web-board](unblock-07-issues-web-board.md) | A2 | unblock-06 | 104, 105, 106, 496 |
| 1 | [unblock-08-pr-page-wiring](unblock-08-pr-page-wiring.md) | A3 | none | 111, 112, 113, 114, 126 |
| 1 | [unblock-09-pr-review-mentions](unblock-09-pr-review-mentions.md) | A3 | unblock-08 | 134, 401, 403 |
| 1 | [unblock-10-agent-tools](unblock-10-agent-tools.md) | A4 | none | 062, 070, 190, 317 |
| 1 | [unblock-11-captain-lifecycle](unblock-11-captain-lifecycle.md) | A4 | unblock-10 | 069, 072, 076, 077, 095, 099 |
| 1 | [unblock-12-background-model](unblock-12-background-model.md) | A4 | none | 163, 338 |
| 1 | [unblock-13-machine-jobs](unblock-13-machine-jobs.md) | A5 | none | 046, 171, 172, 175 |
| 1 | [unblock-14-review-machine](unblock-14-review-machine.md) | A6 | none | 130, 137, 151 |
| 1 | [unblock-15-env-pool-machine](unblock-15-env-pool-machine.md) | A6 | none | 183, 184, 185, 187, 188, 212 |
| 1 | [unblock-16-forks-side-chat](unblock-16-forks-side-chat.md) | A7 | none | 063, 064, 065 |
| 1 | [unblock-21-viewers](unblock-21-viewers.md) | A10 | none | 435, 504, 505, 507 |
| 1 | [unblock-22-pwa-push-docs](unblock-22-pwa-push-docs.md) | A10 | none | 440, 441, 442, 449, 511 |
| 1 | [unblock-23-gemini-plugin-verify](unblock-23-gemini-plugin-verify.md) | B7 | none | 031, 312 |
| 1 | [unblock-24-github-gpg-depreader](unblock-24-github-gpg-depreader.md) | B7 | none | 402, 404 |
| 1 | [unblock-25-vendor-connectors](unblock-25-vendor-connectors.md) | B7 | none | 422, 424, 425, 426 |
| 1 | [unblock-26-sso-oidc-saml](unblock-26-sso-oidc-saml.md) | B8 | none | 368, 369, 370 |
| 1 | [unblock-27-two-step](unblock-27-two-step.md) | B8 | unblock-26 | 371, 372, 514 |
| 1 | [unblock-28-oidc-issuer](unblock-28-oidc-issuer.md) | B9 | none | 390, 395, 396, 397 |
| 1 | [unblock-29-cloud-federation](unblock-29-cloud-federation.md) | B9 | unblock-28 | 391, 392, 393, 394 |
| 1 | [unblock-30-dictation](unblock-30-dictation.md) | B11 | none | 011 |
| 2 | [unblock-17-org-core](unblock-17-org-core.md) | A8 | none | 357, 358, 359, 360, 364 |
| 2 | [unblock-18-org-admin](unblock-18-org-admin.md) | A8 | unblock-17 | 361, 362, 363, 365, 366, 367 |
| 2 | [unblock-19-shared-projects](unblock-19-shared-projects.md) | A8 | unblock-17 | 182 |
| 2 | [unblock-20-org-models](unblock-20-org-models.md) | A9 | unblock-17 | 323, 324, 326, 334, 482 |
| 2 | [unblock-33-runner-device-plane](unblock-33-runner-device-plane.md) | B1 | none | 228, 250, 255, 257, 260 |
| 2 | [unblock-34-device-execution](unblock-34-device-execution.md) | B1 | unblock-33 | 061, 091, 092, 232, 233, 244, 246, 490 |
| 2 | [unblock-35-device-resilience](unblock-35-device-resilience.md) | B1 | unblock-34 | 234, 235, 236, 240, 245 |
| 2 | [unblock-36-byom-transfer-installers](unblock-36-byom-transfer-installers.md) | B1 | unblock-33 | 051, 251, 277 |
| 2 | [unblock-37-thread-image-tools](unblock-37-thread-image-tools.md) | B3 | none | 206, 207, 208 |
| 2 | [unblock-38-desktop-stream-transfer](unblock-38-desktop-stream-transfer.md) | B3 | unblock-37 | 200, 215, 216, 436 |
| 2 | [unblock-39-slack-connector](unblock-39-slack-connector.md) | B4 | none | 406, 407, 409, 415, 515 |
| 2 | [unblock-40-slack-commands](unblock-40-slack-commands.md) | B4 | unblock-39 | 093, 408, 410, 411 |
| 2 | [unblock-41-slack-tools-read](unblock-41-slack-tools-read.md) | B4 | unblock-39 | 029, 412, 414, 516 |
| 2 | [unblock-42-slack-pr-cards](unblock-42-slack-pr-cards.md) | B4 | unblock-39 | 413, 452, 517 |
| 2 | [unblock-43-linear-connector](unblock-43-linear-connector.md) | B5 | none | 416, 417, 418, 419 |
| 2 | [unblock-44-linear-sync](unblock-44-linear-sync.md) | B5 | unblock-43 | 420, 421, 494 |
| 2 | [unblock-45-phones-provider](unblock-45-phones-provider.md) | B10 | none | 261, 262, 263, 264, 271 |
| 2 | [unblock-46-phones-builds-control](unblock-46-phones-builds-control.md) | B10 | unblock-45 | 265, 266, 267, 268, 269, 270 |
| 3 | [unblock-31-pr-advanced](unblock-31-pr-advanced.md) | B11 | unblock-08 | 116, 121, 122, 124, 127 |
| 3 | [unblock-32-visual-check](unblock-32-visual-check.md) | B11 | unblock-08, unblock-37 | 147 |
| 3 | [unblock-47-automation-vendor-triggers](unblock-47-automation-vendor-triggers.md) | B6 | unblock-39, unblock-43 | 156, 157, 158, 174 |
| 3 | [unblock-48-automation-principal](unblock-48-automation-principal.md) | B6 | unblock-18 | 167, 168 |
| 3 | [unblock-49-desktop-shell](unblock-49-desktop-shell.md) | B2 | unblock-33 | 227, 241, 247, 248, 489, 491 |
| 3 | [unblock-50-desktop-transfer](unblock-50-desktop-transfer.md) | B2 | unblock-34, unblock-49 | 237, 238, 239, 242, 243 |
| 3 | [unblock-51-slack-linear-tails](unblock-51-slack-linear-tails.md) | tails | unblock-07, unblock-20, unblock-39, unblock-43 | 483, 497 |
| 4 | [unblock-52-unblock-exit](unblock-52-unblock-exit.md) | EXIT | all units merged or blocked | - |

Total: 52 units, 199 rows.
