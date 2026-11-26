#!/usr/bin/env python3
"""Usage: check_spec_ts.py [SPEC.md]. Concatenate every ```ts block in SPEC.md and run `tsc --strict --noEmit` on it.
Needs TypeScript: set TSC=/path/to/tsc or have `tsc` on PATH (e.g. `npm i -g typescript`)."""
import os, re, subprocess, sys, tempfile, shutil
here = os.path.dirname(os.path.abspath(__file__))
spec = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "..", "SPEC.md")
blocks = re.findall(r"```ts\n(.*?)```", open(spec, encoding="utf-8").read(), re.S)
d = tempfile.mkdtemp()
src = os.path.join(d, "spec.ts")
open(src, "w").write("export {};\n" + "\n".join(blocks))
tsc = os.environ.get("TSC") or shutil.which("tsc") or "/tmp/tsc/node_modules/.bin/tsc"
r = subprocess.run([tsc, "--strict", "--noEmit", "--target", "es2022", "--lib", "es2022", src], capture_output=True, text=True)
sys.stdout.write(r.stdout + r.stderr)
print(f"{len(blocks)} ts blocks; tsc exit {r.returncode}")
sys.exit(r.returncode)
