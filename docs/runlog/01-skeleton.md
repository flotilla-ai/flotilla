# 01-skeleton runlog

## Pre-launch P1

```text
## P1 Docker prelaunch

### docker compose version
Docker Compose version v5.6.1
exit=0

### docker run --rm hello-world
Unable to find image 'hello-world:latest' locally
latest: Pulling from library/hello-world
4f55086f7dd0: Pulling fs layer
4f55086f7dd0: Download complete
4f55086f7dd0: Pull complete
d5e71e642bf5: Download complete
Digest: sha256:1e4c05b897a751332ce85c7e9449da2d93514ea2dea6dbb0e2753c9e949b2bfa
Status: Downloaded newer image for hello-world:latest

Hello from Docker!
This message shows that your installation appears to be working correctly.

To generate this message, Docker took the following steps:
 1. The Docker client contacted the Docker daemon.
 2. The Docker daemon pulled the "hello-world" image from the Docker Hub.
    (amd64)
 3. The Docker daemon created a new container from that image which runs the
    executable that produces the output you are currently reading.
 4. The Docker daemon streamed that output to the Docker client, which sent it
    to your terminal.

To try something more ambitious, you can run an Ubuntu container with:
 $ docker run -it ubuntu bash

Share images, automate workflows, and more with a free Docker ID:
 https://hub.docker.com/

For more examples and ideas, visit:
 https://docs.docker.com/get-started/

exit=0

### internal network egress check
network_create_exit=0 id=86b8ddaddbc296d87ef2289fadf81e4ad33e6a1c299ffe9dd74a28b9c8af23fc
Unable to find image 'alpine:latest' locally
latest: Pulling from library/alpine
881fc932939e: Pulling fs layer
881fc932939e: Download complete
86ff264fe568: Download complete
c35a7d82b8fa: Download complete
881fc932939e: Pull complete
Digest: sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf
Status: Downloaded newer image for alpine:latest
reachable=1
container_exit=0
flotilla-p1-check
network_rm_exit=0
```

## DECISIONS

- Chose oxlint for linting: small, fast, TypeScript-aware default rules, and MIT-licensed.
- Chose `POSTGRES_HOST_AUTH_METHOD=trust` because Postgres is reachable only on the internal `db` network; no database password value is committed.
- The server loader accepts injectable route/module directories so tests prove loading behavior without adding fixture files to production route directories.

## Verification

### `make check` tail

```text
apps/server test: Done
pnpm -r lint
apps/gate lint$ oxlint src
packages/adapters/claude-code lint$ oxlint src
packages/adapters/codex lint$ oxlint src
packages/adapters/fake lint$ oxlint src
apps/gate lint: Done
packages/adapters/generic-cli lint$ oxlint src
packages/adapters/fake lint: Done
packages/adapters/host lint$ oxlint src
packages/adapters/claude-code lint: Done
packages/core lint$ oxlint src
packages/adapters/codex lint: Done
packages/core lint: Done
packages/adapters/host lint: Done
packages/adapters/generic-cli lint: Done
apps/server lint$ oxlint src
apps/server lint: Done
```

### compose/healthz excerpt

```text
#3 [server internal] load metadata for docker.io/library/node:22-bookworm-slim
#6 [gate build 1/8] FROM docker.io/library/node:22-bookworm-slim@sha256:be979e5523c76fa4d5ca4ebd3099078f220aa47ec39c48ad5b5df9314debd6eb
#6 resolve docker.io/library/node:22-bookworm-slim@sha256:be979e5523c76fa4d5ca4ebd3099078f220aa47ec39c48ad5b5df9314debd6eb done
#13 2.141 .../.pnpm/ssh2@1.17.0/node_modules/ssh2 install: gyp info it worked if it ends with ok
#13 2.164 .../.pnpm/ssh2@1.17.0/node_modules/ssh2 install: gyp ERR! not ok 
 Image flotilla-server Built 
 Image flotilla-gate Built 
 Container flotilla-server-1 Healthy 
down_exit=0
```

### compose config checks

```text
$ docker compose config --services
postgres
server
gate

networks:
  db: internal=true
  edge: internal=true
  postgres networks: db only
  gate networks: edge, default (not db)
  server published ports: 8080, 8081; 8082 is not published
```
