function header(name: string, size: number, mode = '0000644'): Buffer {
  const h = Buffer.alloc(512);
  h.write(name, 0, 100); h.write(`${mode}\0`, 100); h.write('0001000\0', 108); h.write('0001000\0', 116);
  h.write(size.toString(8).padStart(11, '0') + '\0', 124); h.write('00000000000\0', 136); h.write('        ', 148); h.write('0', 156); h.write('ustar\0', 257); h.write('00', 263);
  let sum = 0; for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return h;
}
export function tarFile(name: string, content: string | Buffer, mode = '0000644'): Buffer {
  const body = Buffer.from(content); const pad = Buffer.alloc((512 - body.length % 512) % 512);
  return Buffer.concat([header(name, body.length, mode), body, pad, Buffer.alloc(1024)]);
}
export function captainMcpTar(token: string | null, extraServers: Record<string, unknown> = {}): Buffer {
  const builtin = token ? { flotilla: { type: 'http', url: 'http://flotilla-tools/mcp/captain', headers: { Authorization: `Bearer ${token}` } } } : {};
  return tarFile('flotilla/mcp.json', JSON.stringify({ mcpServers: { ...extraServers, ...builtin } }), '0000600');
}
