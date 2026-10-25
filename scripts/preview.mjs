import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(projectRoot, 'out');
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const basePath = rawBasePath === '/' ? '' : rawBasePath.replace(/\/$/, '');

if (basePath && (!/^\/[A-Za-z0-9_~./-]+$/.test(basePath) || basePath.split('/').some(part => part === '.' || part === '..'))) {
  throw new Error('NEXT_PUBLIC_BASE_PATH must be an absolute URL path such as /conferences.');
}

let outputRoot;
try {
  outputRoot = await realpath(outputPath);
  if (!(await stat(resolve(outputRoot, 'index.html'))).isFile()) throw new Error('Missing index.html');
} catch {
  console.error('Static export not found. Run npm run build before npm run preview.');
  process.exit(1);
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.ics': 'text/calendar; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function insideOutput(path) {
  const localPath = relative(outputRoot, path);
  return localPath === '' || (!isAbsolute(localPath) && localPath !== '..' && !localPath.startsWith(`..${sep}`));
}

async function findFile(path) {
  let actualPath = await realpath(path);
  if (!insideOutput(actualPath)) return null;
  let info = await stat(actualPath);
  if (info.isDirectory()) {
    actualPath = await realpath(resolve(actualPath, 'index.html'));
    if (!insideOutput(actualPath)) return null;
    info = await stat(actualPath);
  }
  return info.isFile() ? actualPath : null;
}

function respond(request, response, status, body, type = 'text/plain; charset=utf-8') {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(body);
  response.writeHead(status, {
    'Content-Type': type,
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(request.method === 'HEAD' ? undefined : data);
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    respond(request, response, 405, 'Method not allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent((request.url || '/').split('?')[0]);
    if (!pathname.startsWith('/') || /[\\\0:]/.test(pathname) || pathname.split('/').includes('..')) {
      respond(request, response, 400, 'Invalid path');
      return;
    }
  } catch {
    respond(request, response, 400, 'Invalid URL encoding');
    return;
  }

  if (basePath && (pathname === '/' || pathname === basePath)) {
    response.writeHead(302, { Location: `${basePath}/` });
    response.end();
    return;
  }
  if (basePath && !pathname.startsWith(`${basePath}/`)) {
    respond(request, response, 404, 'Not found');
    return;
  }

  const localPath = pathname.slice(basePath.length);
  const target = resolve(outputRoot, `.${localPath}`);
  if (!insideOutput(target)) {
    respond(request, response, 403, 'Forbidden');
    return;
  }

  try {
    const file = await findFile(target);
    if (file) {
      respond(request, response, 200, await readFile(file), contentTypes[extname(file).toLowerCase()] || 'application/octet-stream');
      return;
    }
  } catch (error) {
    if (!['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) {
      console.error('Preview request failed:', error.message);
      respond(request, response, 500, 'Internal server error');
      return;
    }
  }

  try {
    const notFound = await findFile(resolve(outputRoot, '404.html'));
    if (notFound) {
      respond(request, response, 404, await readFile(notFound), contentTypes['.html']);
      return;
    }
  } catch { /* Fall back to a plain 404 if no exported error page exists. */ }
  respond(request, response, 404, 'Not found');
});

server.on('error', error => {
  console.error(`Unable to start preview: ${error.message}`);
  process.exitCode = 1;
});
server.listen(4173, '127.0.0.1', () => {
  console.log(`Preview: http://127.0.0.1:4173${basePath}/`);
});
