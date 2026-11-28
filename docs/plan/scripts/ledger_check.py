#!/usr/bin/env python3
"""Check BEYOND/VM row coverage in parallel-run handoff ROWS lines.

Usage: python3 docs/plan/scripts/ledger_check.py

Only BEYOND-### and VM-### rows from docs/plan/PARITY-EXT.md are checked.
CAPY row coverage remains owned by parity_coverage.py and the unblock run.
"""
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[3]
ledger_path = root / "docs/plan/PARITY-EXT.md"
handoff_dir = root / "docs/plan/handoffs"

row_re = re.compile(r"\b(?:BEYOND|VM)-\d{3}\b")
expected: set[str] = set()
for line in ledger_path.read_text(encoding="utf-8").splitlines():
    if not line.startswith("| "):
        continue
    cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    if cells and row_re.fullmatch(cells[0]):
        expected.add(cells[0])

seen: dict[str, list[str]] = {}
paths = sorted(
    path
    for pattern in ("captain-*.md", "vms-*.md", "parallel-*.md")
    for path in handoff_dir.glob(pattern)
)
for path in paths:
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.startswith("ROWS:"):
            continue
        for row_id in row_re.findall(line):
            seen.setdefault(row_id, []).append(path.name)

missing = sorted(expected - set(seen))
extra = sorted(set(seen) - expected)
duplicates = sorted(row_id for row_id, owners in seen.items() if len(owners) > 1)

if missing or extra or duplicates:
    if missing:
        print("missing:", ", ".join(missing))
    if extra:
        print("not in PARITY-EXT:", ", ".join(extra))
    if duplicates:
        print("duplicate:", ", ".join(duplicates))
    raise SystemExit(1)

print(f"PARITY-EXT: {len(expected)} rows covered exactly once")
