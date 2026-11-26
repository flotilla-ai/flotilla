import type Docker from 'dockerode';

export async function copyCliHome(docker: Docker, input: { userVolume: string; threadVolume: string; image: string }): Promise<void> {
  await docker.createVolume({ Name: input.threadVolume }).catch(() => undefined);
  const container = await docker.createContainer({
    Image: input.image,
    User: 'root', Cmd: ['sh', '-c', 'mkdir -p /dst && cd /src && tar cf - --exclude=projects . | (cd /dst && tar xf -) && chown -R 1000:1000 /dst'],
    HostConfig: {
      AutoRemove: true,
      Mounts: [
        { Type: 'volume', Source: input.userVolume, Target: '/src', ReadOnly: true },
        { Type: 'volume', Source: input.threadVolume, Target: '/dst' }
      ]
    }
  });
  await container.start();
  const result = await container.wait();
  if (result.StatusCode !== 0) throw new Error(`copyCliHome exited ${result.StatusCode}`);
}
