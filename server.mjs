import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 5173);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };

createServer(async (request, response) => {
  try {
    const urlPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    const requested = resolve(root, `.${urlPath === '/' ? '/index.html' : urlPath}`);
    if (requested !== root && !requested.startsWith(root + sep)) throw new Error('Forbidden');
    const body = await readFile(requested);
    response.writeHead(200, { 'Content-Type': types[extname(requested).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    response.end(body);
  } catch (error) {
    response.writeHead(error.message === 'Forbidden' ? 403 : 404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error.message === 'Forbidden' ? 'Forbidden' : 'Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`RallyUp running at http://localhost:${port}`));
