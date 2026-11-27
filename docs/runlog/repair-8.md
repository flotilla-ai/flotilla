# repair-8: install official vendor CLIs in the thread image

## Goal
`deploy/thread.Dockerfile` did not install either official vendor CLI, so a real `claude-code` or `codex` adapter selection could not start inside a thread container.

## Before
`deploy/thread.Dockerfile` contained no `claude` or `codex` installation step.

## Proof

```text
$ docker build -f deploy/thread.Dockerfile -t flotilla-thread:repair8 .
#12 naming to docker.io/library/flotilla-thread:repair8 done
#12 DONE 37.4s

$ docker run --rm --user node flotilla-thread:repair8 sh -lc 'command -v claude; command -v codex; claude --version 2>/dev/null | head -1; codex --version 2>/dev/null | head -1'
/usr/local/bin/claude
/usr/local/bin/codex
2.1.332 (Claude Code)
codex-cli 0.172.0
```

`make check` was already green on the base branch; this deploy-only change is proven by the image build and container smoke output above.

## Unverified
- Vendor login/subscription behavior still requires human login and is not tested.
- The CLIs are installed but no paid or real vendor calls were made.

## Decision
Pin exact npm CLI versions in the image for reproducible builds. The Dockerfile instructs each self-hosting machine to download the official unmodified packages at image-build time; Flotilla does not vendor or proxy them.
