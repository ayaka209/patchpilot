import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_DIR = path.join(__dirname, 'fixtures');

function getMimeType(filePath: string): string {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

export type FixtureServer = {
  server: Server;
  port: number;
  close: () => Promise<void>;
};

export async function startFixtureServer(): Promise<FixtureServer> {
  const server = createServer(async (req, res) => {
    try {
      const rawPath = req.url ?? '/';
      const pathname = rawPath === '/' ? '/test-page.html' : rawPath;
      const normalizedPath = path.normalize(pathname).replace(/^\/+/, '');
      const filePath = path.join(FIXTURE_DIR, normalizedPath);

      if (!filePath.startsWith(FIXTURE_DIR)) {
        res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      const content = await readFile(filePath);
      res.writeHead(200, { 'content-type': getMimeType(filePath) });
      res.end(content);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind fixture server to a TCP port');
  }

  return {
    server,
    port: address.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
  };
}
