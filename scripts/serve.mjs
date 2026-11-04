// Minimal static server for dist/, mounted at the site base like GitHub Pages.
// Used for local preview and the Playwright tests. Never deployed.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';
import { SITE_BASE } from '../site.config.mjs';

const root = new URL('../dist/', import.meta.url).pathname;
const port = Number(process.env.PORT || 4321);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (!path.startsWith(SITE_BASE)) {
    res.writeHead(path === '/' ? 302 : 404, path === '/' ? { Location: SITE_BASE } : {});
    return res.end();
  }
  path = normalize(path.slice(SITE_BASE.length));
  if (path.startsWith('..')) return res.writeHead(400).end();
  let file = join(root, path);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    let body = await readFile(file);
    const headers = { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'max-age=600' };
    // Like GitHub Pages: gzip text responses.
    if (/^(text\/|application\/(json|manifest|xml))|svg/.test(headers['Content-Type']) && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
      body = gzipSync(body);
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    try {
      res.writeHead(404, { 'Content-Type': types['.html'] });
      res.end(await readFile(join(root, '404.html')));
    } catch {
      res.writeHead(404).end('Not found');
    }
  }
}).listen(port, '127.0.0.1', () => console.log(`Serving dist/ at http://127.0.0.1:${port}${SITE_BASE}`));
