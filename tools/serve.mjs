#!/usr/bin/env node
/** Zero-dependency static server for local development. */
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.argv[3] ?? '.');
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 5173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let path = join(ROOT, normalize(url).replace(/^(\.\.[/\\])+/, ''));
  try {
    if (statSync(path).isDirectory()) path = join(path, 'index.html');
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('404');
  }
  if (!path.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('403');
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  createReadStream(path).pipe(res);
}).listen(PORT, () => console.log(`→ http://localhost:${PORT}`));
