import http from 'http';
import fs from 'node:fs/promises';
import { extname, join } from 'path';

function usage() {
  console.log(`usage: node serve.mjs [--port PORT] [--dir DIRECTORY]`);
  process.exit(1);
}

const mimeTypes = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/vnd.microsoft.icon',
};

async function tryFile(p) {
  try {
    return [await fs.readFile(p), mimeTypes[extname(p)] ?? 'text/html'];
  } catch {
    return [await fs.readFile(join(p, 'index.html')), 'text/html'];
  }
}

const argv = process.argv.slice(2);
let port = '3001';
let dir = './out';

if (argv.length % 2 != 0) { usage(); }

for (let i = 0; i < argv.length - 1; i += 2) {
  switch (argv[i]) {
    case '--port':
      port = argv[i + 1];
      break;
    case '--dir':
      dir = argv[i + 1];
      break;
    default:
      usage();
  }
}

http.createServer(async (req, res) => {
  const filePath = join(dir, req.url);

  try {
    const [content, contentType] = await tryFile(filePath)
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content, 'utf-8');
  } catch {
    console.log(`for ${req.url} showing 404`);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('404 not found', 'utf-8');
  }
}).listen(port);

console.log(`serving ${dir} at http://localhost:${port}`);
