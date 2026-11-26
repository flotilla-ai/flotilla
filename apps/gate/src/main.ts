import { createServer } from 'node:http';

const server = createServer((req, res) => {
  res.writeHead(403, { 'content-type': 'text/plain' });
  res.end('gate: not implemented');
});

server.on('connect', (req, socket) => {
  socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\ngate: not implemented');
});

server.listen(3128, () => {
  console.log('gate listening on 3128');
});
