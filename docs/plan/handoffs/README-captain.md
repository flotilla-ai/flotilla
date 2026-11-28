# Captain-quality handoff waves

Parent coordination rules: children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`; they write `docs/runlog/<unit>.md` and append-only decisions/notices. All PRs target `flotilla/p1`, never `main`.

| Wave | Units | Dependencies |
|---|---|---|
| setup | parallel-01-seams | parallel-00-plan |
| 1 | captain-02 fixtures, captain-03 computer lifecycle, captain-04 action gate, captain-05 research, captain-06 memory | parallel-01-seams; captain-05 also needs captain-02 |
| 2 | captain-07 computer proxy, captain-08 fencing, captain-09 citation report, captain-10 audit, captain-11 skill capture | captain-07 after 03+04; captain-09 after 05; captain-10 after 04 |
| 3 | captain-12 live takeover, captain-13 done/report/playbook, captain-14 speed | captain-12 after 07; captain-13 after 09+12; captain-14 after 05+07+13 |
| exit | captain-15 eval harness, captain-16 exit | captain-15 after prior dependencies; captain-16 after 15 |

Row coverage:

| Rows | Unit |
|---|---|
| BEYOND-001 | captain-03-computer-lifecycle |
| BEYOND-002 | captain-07-computer-proxy |
| BEYOND-003, BEYOND-004 | captain-12-live-takeover |
| BEYOND-005 | captain-05-research-fetch-search |
| BEYOND-006 | captain-09-citation-report |
| BEYOND-007, BEYOND-014 | captain-13-done-gate-report-playbook |
| BEYOND-008 | captain-06-memory-v2 |
| BEYOND-009 | captain-11-skill-capture |
| BEYOND-010 | captain-04-action-gate |
| BEYOND-011 | captain-08-fencing |
| BEYOND-012 | captain-10-audit |
| BEYOND-013 | captain-14-speed |
| BEYOND-015 | captain-15-eval-harness |
