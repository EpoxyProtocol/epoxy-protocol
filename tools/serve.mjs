// Local static server for dist/ that applies _headers, so CSP is enforced while testing.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(process.env.DIR || join(dirname(fileURLToPath(import.meta.url)), '..', 'dist'));
const port = +process.env.PORT || 4173;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const csp = (readFileSync(join(root, '_headers'), 'utf8').match(/Content-Security-Policy: (.*)/) || [])[1];
createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(root, p);
  if (!f.startsWith(root) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream', 'content-security-policy': csp, 'x-content-type-options': 'nosniff' });
  res.end(readFileSync(f));
}).listen(port, () => console.log('serving dist on http://localhost:' + port));
