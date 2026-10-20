// Main-thread JavaScript profile of a settled stage: self time per function,
// so per-frame CPU cost can be traced to its source.
//   node audit/cpu-profile.mjs [--mobile] [--cpu=4] [--section=<slug>] [--seconds=4]
import {launch, connect, openPage} from './perf-run.mjs';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const wait = ms => new Promise(r => setTimeout(r, ms));
const mobile = !!args.mobile;
const {child, page} = await launch({gpu: args.gpu || 'nvidia', port: 9900 + Math.floor(Math.random() * 90)});
const cdp = await connect(page);
await openPage(cdp, 'http://127.0.0.1:4173/' + (args.section ? `?sectiune=${args.section}` : ''), mobile ? {mobile: true, width: 390, height: 844, dpr: 3} : {width: 1920, height: 1080, dpr: 1});
await wait(5000);
if (args.cpu) await cdp.send('Emulation.setCPUThrottlingRate', {rate: Number(args.cpu)});
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', {interval: 200});
const frames0 = await cdp.evaluate('window.__xperf.frames');
await cdp.send('Profiler.start');
await wait(Number(args.seconds || 4) * 1000);
const {profile} = await cdp.send('Profiler.stop');
const frames = (await cdp.evaluate('window.__xperf.frames')) - frames0;
const byId = new Map(profile.nodes.map(n => [n.id, n]));
const self = new Map();
const dt = profile.timeDeltas;
profile.samples.forEach((id, i) => { const n = byId.get(id); const f = n.callFrame; const key = `${f.functionName || '(anonymous)'} ${f.url.split('/').pop().split('?')[0]}:${f.lineNumber + 1}:${f.columnNumber + 1}`; self.set(key, (self.get(key) || 0) + (dt[i] || 0)); });
const total = [...self.values()].reduce((a, b) => a + b, 0) / 1000;
const idle = (self.get('(idle) :0:0') || 0) / 1000 + (self.get('(program) :0:0') || 0) / 1000 * 0;
console.log(`frames ${frames} in ${args.seconds || 4}s | sampled ${total.toFixed(0)} ms | idle ${idle.toFixed(0)} ms | busy per frame ${((total - idle) / Math.max(1, frames)).toFixed(2)} ms`);
for (const [k, us] of [...self.entries()].filter(([k]) => !/^\(idle\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${(us / 1000 / Math.max(1, frames)).toFixed(3).padStart(7)} ms/frame  ${k}`);
child.kill(); process.exit(0);
