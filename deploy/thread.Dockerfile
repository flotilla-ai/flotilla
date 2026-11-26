FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git python3 ca-certificates util-linux wget \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /opt/flotilla/bin /workspace /run/flotilla \
  && chmod 1777 /run/flotilla \
  && chown -R node:node /workspace
COPY deploy/flotilla-exec /opt/flotilla/bin/flotilla-exec
RUN chmod 755 /opt/flotilla/bin/flotilla-exec
USER node
WORKDIR /workspace
CMD ["sleep", "infinity"]
