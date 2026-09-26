/**
 * A STATIC SERVER FOR THE BUILT APP, FOR BROWSER QA.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS (added v1.6.1)
 *
 * `browser-qa.mjs` spawned `/home/claude/serve.mjs` — a scratch file that
 * lived OUTSIDE the repository and was never committed. The QA gate
 * therefore ran only on a machine that happened to have that file sitting
 * in a home directory, and died with ERR_CONNECTION_REFUSED anywhere else.
 *
 * That is the project's recurring failure in miniature: a gate that reports
 * nothing wrong because it never ran. A quality check with an untracked
 * dependency is not a check, it is a check-shaped hole, and it is worse
 * than none because its presence in `package.json` implies coverage.
 *
 * The server is thirty lines and belongs beside the script that needs it.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * SPA FALLBACK IS THE WHOLE POINT. Gati is client-routed, so a request for
 * /nifty50/all has no file behind it. Without the fallback every deep route
 * in the QA sweep would 404 and the run would report an empty page rather
 * than a broken one — which looks identical to a screen that failed to
 * render, and is exactly the confusion this suite exists to remove.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('../dist/', import.meta.url).pathname;
const PORT = Number(process.argv[2] ?? 4181);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

createServer(async (req, res) => {
  // Strip the query and normalise, so `..` cannot climb out of dist/.
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const target = join(ROOT, path);

  try {
    const body = await readFile(target);
    res.writeHead(200, { 'Content-Type': TYPES[extname(target)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    // Anything without a file behind it is a client route, not a 404.
    try {
      const html = await readFile(join(ROOT, 'index.html'));
      res.writeHead(200, { 'Content-Type': TYPES['.html'] });
      res.end(html);
    } catch {
      res.writeHead(500);
      res.end('dist/ not built — run `npm run build` first.');
    }
  }
}).listen(PORT);
