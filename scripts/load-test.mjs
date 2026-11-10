// Load test: `concurrency` simulated users request the given URLs in turn for `seconds`.
// Usage: node scripts/load-test.mjs <url> [more urls...] [-c 20] [-s 30]
const args = process.argv.slice(2), urls = [];
let concurrency = 20, seconds = 30;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-c') concurrency = Number(args[++i]);
  else if (args[i] === '-s') seconds = Number(args[++i]);
  else urls.push(args[i]);
}
if (!urls.length) { console.log('node scripts/load-test.mjs <url> [more urls...] [-c 20] [-s 30]'); process.exit(1); }

const times = [], statuses = {}, end = Date.now() + seconds * 1000;
let bytes = 0, errors = 0, next = 0, firstError = "";
async function user(id) {
  while (Date.now() < end) {
    const n = ++next, url = urls[(n - 1) % urls.length], start = performance.now();
    try {
      const response = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'xelle-load-test' } });
      bytes += (await response.arrayBuffer()).byteLength;
      statuses[response.status] = (statuses[response.status] || 0) + 1;
      const ms = performance.now() - start;
      times.push(ms);
      console.log(`#${n}  user ${id + 1}  ${response.status}  ${Math.round(ms)} ms  ${url}`);
    } catch (error) {
      errors++; firstError ||= error.cause?.message || error.message;
      console.log(`#${n}  user ${id + 1}  ERROR  ${error.cause?.message || error.message}  ${url}`);
    }
  }
}
console.log(`${concurrency} users, ${seconds} s, ${urls.length} URL(s)...`);
await Promise.all(Array.from({ length: concurrency }, (_, id) => user(id)));
times.sort((a, b) => a - b);
const at = p => Math.round(times[Math.min(times.length - 1, Math.floor(times.length * p))] || 0);
console.log(`requests ${times.length} (${(times.length / seconds).toFixed(1)}/s), errors ${errors}, ${(bytes / 1048576).toFixed(1)} MB`);
if (firstError) console.log("first error:", firstError);
console.log(`latency ms: median ${at(0.5)}, p95 ${at(0.95)}, p99 ${at(0.99)}, max ${at(1)}`);
console.log('status codes', statuses);
