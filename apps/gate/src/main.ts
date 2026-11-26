import { createServer } from 'node:http';

createServer((req, res) => {
  res.writeHead(403, { 'content-type': 'text/plain' });
  res.end('gate: not implemented');
}).listen(3128, () => {
  console.log('gate listening on 3128');
});
