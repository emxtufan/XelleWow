// GitHub push webhook (content type application/json): a signed push to main
// runs deploy.sh. Pushes arriving during a deploy are folded into one more run.
import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const secret = process.env.DEPLOY_SECRET;
if (!secret) { console.error('DEPLOY_SECRET is not set'); process.exit(1); }
const port = Number(process.env.PORT || 9000);
const script = fileURLToPath(new URL('./deploy.sh', import.meta.url));
let running = false, again = false;

function deploy() {
  if (running) { again = true; return; }
  running = true;
  console.log(new Date().toISOString(), 'deploy start');
  execFile('bash', [script], { timeout: 15 * 60 * 1000 }, (error, stdout, stderr) => {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    console.log(new Date().toISOString(), error ? `deploy failed: ${error.message}` : 'deploy done');
    running = false;
    if (again) { again = false; deploy(); }
  });
}

function signed(body, header) {
  const expected = Buffer.from('sha256=' + createHmac('sha256', secret).update(body).digest('hex'));
  const given = Buffer.from(String(header || ''));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/deploy') { res.writeHead(404).end(); return; }
  const chunks = [];
  let size = 0;
  req.on('data', chunk => {
    size += chunk.length;
    if (size > 5e6) req.destroy(); else chunks.push(chunk);
  });
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    if (!signed(body, req.headers['x-hub-signature-256'])) { res.writeHead(401).end('bad signature'); return; }
    const event = req.headers['x-github-event'];
    if (event === 'ping') { res.writeHead(200).end('pong'); return; }
    let ref = '';
    try { ref = JSON.parse(body).ref; } catch { /* not JSON: ignored below */ }
    if (event !== 'push' || ref !== 'refs/heads/main') { res.writeHead(202).end('ignored'); return; }
    deploy();
    res.writeHead(202).end('deploying');
  });
}).listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Deploy webhook on ${port}`));
