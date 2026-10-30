import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAdmin } from './admin.mjs';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff':'font/woff', '.woff2':'font/woff2', '.wasm':'application/wasm', '.glb':'model/gltf-binary', '.mp4':'video/mp4', '.webm':'video/webm', '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.wav':'audio/wav', '.ico':'image/x-icon', '.txt':'text/plain; charset=utf-8', '.xml':'application/xml; charset=utf-8', '.webmanifest':'application/manifest+json' };

const server = http.createServer(async (req, res) => {
  if (await handleAdmin(req, res)) return;
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  try {
    if (req.url === '/__local/status') {
      res.writeHead(200, {'Content-Type':'application/json'}).end(JSON.stringify({app:'cartier-local',pid:process.pid,root}));
      return;
    }
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/\/+/g, '/');
    if (pathname === '/' || pathname === '/en-fr/watchesandwonders' || pathname === '/en-fr/watchesandwonders/') pathname = '/index.html';
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    // no-cache with validators: browsers keep their copy and only ask whether it changed.
    const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const headers = { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges':'bytes', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff', 'ETag': etag, 'Last-Modified': info.mtime.toUTCString() };
    const since = Date.parse(req.headers['if-modified-since'] || '');
    if (req.headers['if-none-match'] ? req.headers['if-none-match'].split(/\s*,\s*/).includes(etag) : since >= Math.floor(info.mtimeMs / 1000) * 1000) {
      res.writeHead(304, { ETag: etag, 'Last-Modified': headers['Last-Modified'], 'Cache-Control': 'no-cache' }).end();
      return;
    }
    let start = 0, end = info.size - 1, status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match) { res.writeHead(416, {'Content-Range':`bytes */${info.size}`}).end(); return; }
      if (match[1]) { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), end); }
      else if (match[2]) start = Math.max(0, info.size - Number(match[2]));
      if (start > end || start >= info.size) { res.writeHead(416, {'Content-Range':`bytes */${info.size}`}).end(); return; }
      status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length'] = Math.max(0, end-start+1);
    res.writeHead(status, headers);
    if (req.method === 'HEAD' || !info.size) res.end();
    else createReadStream(file, {start,end}).on('error', () => res.destroy()).pipe(res);
  } catch {
    // Unknown pages (old links still in search results) go to the home page; missing files stay 404.
    const page = req.url.split('?')[0];
    if (!page.startsWith('/api/') && (!/\.[a-z0-9]+$/i.test(page) || /\.(html?|php)$/i.test(page))) {
      res.writeHead(301, { Location: '/', 'Cache-Control': 'max-age=3600' }).end();
      return;
    }
    console.log('MISSING', req.url);
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('Resursa nu a fost gasita in copia locala.');
  }
});
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Cartier local: http://localhost:${port}/`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
