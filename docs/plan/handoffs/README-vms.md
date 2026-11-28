# Own-computer VM handoff waves

Parent coordination rules: children do not edit `PARITY-EXT.md` or `PROGRESS-PARALLEL.md`; they write `docs/runlog/<unit>.md` and append-only decisions/notices. All PRs target `flotilla/p1`, never `main`. `parallel-01-seams` covers the vms-01 shared seam work; do not create `vms-01`.

| Wave | Units | Dependencies |
|---|---|---|
| setup | parallel-01-seams | parallel-00-plan |
| 1 | vms-02 quota guard, vms-03 hostd, vms-04 compute seam | vms-02/vms-04 after captain-04 where required; all after parallel-01-seams |
| 2 | vms-05 docker-isolated, vms-06 lima, vms-07 guest image, vms-08 network isolation | vms-05/07 after captain-03; vms-06 after vms-02/03/04; vms-08 after vms-02/03/04+captain-03 |
| 3 | vms-09 routing, vms-10 compute UI, vms-11 doctor remote | vms-09 after vms-02/03/04/05+captain-07; vms-10 after vms-02/09+captain-12; vms-11 after vms-03/09 |
| exit | vms-12 eval exit | every other vms unit and CAPTAIN-EXIT |

Row coverage:

| Rows | Unit |
|---|---|
| VM-001 | vms-04-compute-seam |
| VM-002 | vms-02-quota-guard |
| VM-003 | vms-03-hostd |
| VM-004 | vms-05-docker-isolated |
| VM-005 | vms-06-lima-backend |
| VM-006 | vms-07-guest-image |
| VM-007 | vms-09-routing |
| VM-008 | vms-08-network-isolation |
| VM-009 | vms-10-compute-ui |
| VM-010 | vms-11-doctor-remote |
| VM-011 | vms-12-eval-exit |
