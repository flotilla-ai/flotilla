import type Docker from 'dockerode';

export async function createThreadNetwork(docker: Docker, threadId: string): Promise<Docker.Network> {
  const name = `flt-${threadId}`;
  const existing = (await docker.listNetworks({ filters: { name: [name] } })).map((n) => docker.getNetwork(n.Id));
  const network = existing[0] ?? await docker.createNetwork({ Name: name, Internal: true, Labels: { 'flotilla.thread': threadId } });
  const gates = await docker.listContainers({ filters: { label: ['flotilla.role=gate'] } });
  for (const gate of gates) {
    try { await network.connect({ Container: gate.Id, EndpointConfig: { Aliases: ['gate', 'flotilla-tools'] } }); } catch { /* already connected */ }
  }
  return network;
}
