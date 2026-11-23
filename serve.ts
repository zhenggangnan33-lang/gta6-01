// Static file server for VERDE BAY v2 (local play + the screenshot
// and autopilot harnesses). Serves ./game and ./screenshots only,
// with the right MIME types for the ES modules.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'game');
const shotsRoot = join(fileURLToPath(new URL('.', import.meta.url)), 'screenshots');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const port = Number(process.env.PORT || 8080);

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    const base = path.startsWith('/screenshots/') ? shotsRoot : root;
    const file = join(base, normalize(path).replace(/^(\.\.[\/\\])+/, ''));
    if (!file.startsWith(base)) { res.writeHead(403); res.end('forbidden'); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(port, () => {
  console.log('VERDE BAY v2 serving on http://localhost:' + port + '/');
});
