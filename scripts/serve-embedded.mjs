import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', 'dist-embedded');
const mountPath = '/projects/poster/';
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1:4174');
    if (!requestUrl.pathname.startsWith(mountPath)) {
      response.writeHead(404).end('Not found');
      return;
    }

    const relativeRequest = decodeURIComponent(requestUrl.pathname.slice(mountPath.length));
    const relativeFile =
      relativeRequest && !relativeRequest.endsWith('/') ? relativeRequest : 'index.html';
    const file = path.resolve(root, relativeFile);
    const relative = path.relative(root, file);

    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    const fileStats = await stat(file);
    if (!fileStats.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'content-length': fileStats.size,
      'content-type': mimeTypes[path.extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

server.listen(4174, '127.0.0.1', () => {
  console.log(`Embedded Poster Forge served at http://127.0.0.1:4174${mountPath}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
