// Bytes downloaded until the experience is ready, by file and by type.
//   node audit/load-bytes.mjs [--mobile]
import {launch, connect, openPage} from './perf-run.mjs';
const mobile = process.argv.includes('--mobile');
const {child, page} = await launch({gpu: 'nvidia', port: 9990});
const cdp = await connect(page);
const sizes = new Map();
cdp.on(m => {
  if (m.method === 'Network.responseReceived') sizes.set(m.params.requestId, {url: m.params.response.url, bytes: 0, type: m.params.type});
  if (m.method === 'Network.loadingFinished' && sizes.has(m.params.requestId)) sizes.get(m.params.requestId).bytes = m.params.encodedDataLength;
});
const {loadedMs} = await openPage(cdp, 'http://127.0.0.1:4173/', mobile ? {mobile: true, width: 390, height: 844, dpr: 3} : {width: 1920, height: 1080, dpr: 1});
await new Promise(r => setTimeout(r, 3000));
const rows = [...sizes.values()].filter(r => r.bytes > 0);
const total = rows.reduce((a, r) => a + r.bytes, 0);
const byExt = {};
for (const r of rows) { const ext = (r.url.split('?')[0].match(/\.(\w+)$/) || [, 'other'])[1]; byExt[ext] = (byExt[ext] || 0) + r.bytes; }
console.log(`${mobile ? 'mobile' : 'desktop'}: ready in ${loadedMs} ms, ${rows.length} files, ${(total / 1048576).toFixed(1)} MB`);
console.log('by type:', Object.entries(byExt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / 1048576).toFixed(1)}MB`).join(', '));
for (const r of rows.sort((a, b) => b.bytes - a.bytes).slice(0, 18)) console.log(`${(r.bytes / 1048576).toFixed(2).padStart(6)} MB  ${r.url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]}`);
child.kill(); process.exit(0);
