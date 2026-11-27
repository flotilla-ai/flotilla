#!/usr/bin/env python3
"""Check that every Appendix A row for a phase appears exactly once in phase handoff ROWS lines.
Usage: python3 docs/plan/scripts/parity_coverage.py P2
"""
import re, sys
from pathlib import Path
phase = sys.argv[1] if len(sys.argv) > 1 else 'P2'
root = Path(__file__).resolve().parents[3]
spec = (root / 'docs/plan/SPEC.md').read_text(encoding='utf-8')
expected = set()
for line in spec.splitlines():
    if not line.startswith('| CAPY-'): continue
    cells = [c.strip().replace('\\|', '|') for c in re.split(r'(?<!\\)\|', line.strip().strip('|'))]
    if len(cells) >= 5 and cells[4] == phase:
        expected.add(cells[0])
seen = {}
for path in sorted((root / 'docs/plan/handoffs').glob(f'phase{phase[1]}-*.md')):
    for line in path.read_text(encoding='utf-8').splitlines():
        if line.startswith('ROWS:'):
            for rid in re.findall(r'CAPY-\d{3}', line):
                seen.setdefault(rid, []).append(path.name)
missing = sorted(expected - set(seen))
extra = sorted(set(seen) - expected)
dupes = sorted(rid for rid, paths in seen.items() if len(paths) > 1)
if missing or extra or dupes:
    if missing: print('missing:', ', '.join(missing))
    if extra: print('not in phase:', ', '.join(extra))
    if dupes: print('duplicate:', ', '.join(dupes))
    raise SystemExit(1)
print(f'{phase}: {len(expected)} rows covered exactly once')
