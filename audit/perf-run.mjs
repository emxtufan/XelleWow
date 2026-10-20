// Reproducible performance pass over every scroll stage, through Chrome's
// DevTools protocol (no dependencies). It launches its own Chrome with a fresh
// profile, walks the experience with real wheel or touch input and measures
// each settled stage.
//
//   node audit/perf-run.mjs [--gpu=intel|nvidia] [--size=1920x1080] [--dpr=1]
//                           [--mobile] [--url=http://127.0.0.1:4173/] [--out=file.json]
//
// Per stage: fps, p95 frame time, frames over 50 ms, draw calls and triangles
// per frame, requestAnimationFrame callbacks per frame, long tasks, JS heap.
// Also: load time, console errors, failed requests, WebGL context losses.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const [W, H] = String(args.size || '1920x1080').split('x').map(Number);
const DPR = Number(args.dpr || 1), MOBILE = !!args.mobile, GPU = args.gpu || 'intel';
const URL_BASE = args.url || 'http://127.0.0.1:4173/';
const PORT = 9400 + Math.floor(Math.random() * 400);
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SLUGS = ['intrare', 'spiced-peach-negroni', 'pornstar-martini', 'prosecco-di-cherry', 'maracuja-mojito', 'filmul-xelle', 'galeria-xelle'];
const wait = ms => new Promise(r => setTimeout(r, ms));

export async function launch({gpu = GPU, port = PORT} = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'xelle-perf-'));
  const flags = ['--headless=new', `--user-data-dir=${profile}`, '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist',
    `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required'];
  if (gpu === 'nvidia') flags.push('--force_high_performance_gpu');
  const child = spawn(CHROME, [...flags, 'about:blank'], {stdio: 'ignore'});
  for (let i = 0; i < 50; i++) {
    await wait(200);
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const page = list.find(p => p.type === 'page'); if (page) return {child, profile, page}; } catch {}
  }
  throw new Error('Chrome did not start');
}

export async function connect(page) {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map(), listeners = [];
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message.error ? {error: message.error} : message.result); pending.delete(message.id); }
    else if (message.method) listeners.forEach(fn => fn(message));
  };
  const send = (method, params = {}) => new Promise(resolve => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({id: i, method, params})); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) return {error: result.exceptionDetails.exception?.description || result.exceptionDetails.text};
    return result.result ? result.result.value : result;
  };
  return {ws, send, evaluate, on: fn => listeners.push(fn)};
}

// Counts draw calls, triangles and rAF callbacks per frame; long tasks; context losses.
export const INSTRUMENT = `(() => {
  const stats = window.__xperf = {frames: 0, draws: 0, triangles: 0, rafCallbacks: 0, longTasks: [], contextLost: 0, frameTimes: []};
  const count = (mode, n, instances) => { stats.draws++; if (mode === 4) stats.triangles += n / 3 * (instances || 1); else if (mode === 5 || mode === 6) stats.triangles += Math.max(0, n - 2) * (instances || 1); };
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue;
    const p = C.prototype;
    const de = p.drawElements, da = p.drawArrays, dei = p.drawElementsInstanced, dai = p.drawArraysInstanced;
    p.drawElements = function (m, n) { count(m, n); return de.apply(this, arguments); };
    p.drawArrays = function (m, f, n) { count(m, n); return da.apply(this, arguments); };
    if (dei) p.drawElementsInstanced = function (m, n, t, o, i) { count(m, n, i); return dei.apply(this, arguments); };
    if (dai) p.drawArraysInstanced = function (m, f, n, i) { count(m, n, i); return dai.apply(this, arguments); };
  }
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(t => { stats.rafCallbacks++; cb(t); });
  let last = 0;
  const tick = t => { if (last) stats.frameTimes.push(t - last); if (stats.frameTimes.length > 2000) stats.frameTimes.splice(0, 1000); last = t; stats.frames++; raf(tick); };
  raf(tick);
  try { new PerformanceObserver(list => list.getEntries().forEach(e => stats.longTasks.push({at: Math.round(e.startTime), ms: Math.round(e.duration)}))).observe({type: 'longtask', buffered: true}); } catch (e) {}
  document.addEventListener('webglcontextlost', () => stats.contextLost++, true);
})();`;

export async function sample(cdp, ms = 3000) {
  const cpuBefore = await cpuMetrics(cdp);
  const result = await sampleFrames(cdp, ms);
  const cpuAfter = await cpuMetrics(cdp);
  const frames = Math.max(1, Math.round(result.fps * ms / 1000));
  // Main-thread milliseconds per frame (all JS, style, layout); the rest of a frame is GPU/compositor.
  result.cpuMsPerFrame = +(((cpuAfter.TaskDuration - cpuBefore.TaskDuration) * 1000) / frames).toFixed(2);
  result.scriptMsPerFrame = +(((cpuAfter.ScriptDuration - cpuBefore.ScriptDuration) * 1000) / frames).toFixed(2);
  return result;
}

async function cpuMetrics(cdp) {
  const {metrics: list} = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(list.map(x => [x.name, x.value]));
}

async function sampleFrames(cdp, ms) {
  await cdp.evaluate(`(() => { const s = window.__xperf; s.mark = {frames: s.frames, draws: s.draws, triangles: s.triangles, raf: s.rafCallbacks, long: s.longTasks.length, ft: s.frameTimes.length, t: performance.now()}; })()`);
  await wait(ms);
  return cdp.evaluate(`(() => {
    const s = window.__xperf, m = s.mark, frames = s.frames - m.frames, seconds = (performance.now() - m.t) / 1000;
    const times = s.frameTimes.slice(m.ft).sort((a, b) => a - b);
    const canvas = document.querySelector('.gpuApp canvas');
    return {fps: Math.round(frames / seconds), p95: times.length ? +times[Math.floor(times.length * 0.95)].toFixed(1) : null,
      over50: times.filter(t => t > 50).length, drawsPerFrame: frames ? Math.round((s.draws - m.draws) / frames) : 0,
      trianglesPerFrame: frames ? Math.round((s.triangles - m.triangles) / frames) : 0, rafPerFrame: frames ? +((s.rafCallbacks - m.raf) / frames).toFixed(1) : 0,
      longTasks: s.longTasks.slice(m.long), canvas: canvas ? canvas.width + 'x' + canvas.height : null};
  })()`);
}

export async function settledSlug(cdp) {
  return cdp.evaluate(`new URLSearchParams(location.search).get('sectiune') || 'intrare'`);
}

export async function step(cdp, direction = 1) {
  if (MOBILE) {
    const x = Math.round(W / 2), y0 = Math.round(H * (direction > 0 ? 0.75 : 0.3)), y1 = Math.round(H * (direction > 0 ? 0.3 : 0.75));
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y: y0}]});
    for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x, y: Math.round(y0 + (y1 - y0) * i / 8)}]}); await wait(16); }
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  } else {
    for (let i = 0; i < 4; i++) { await cdp.send('Input.dispatchMouseEvent', {type: 'mouseWheel', x: W / 2, y: H / 2, deltaX: 0, deltaY: 120 * direction}); await wait(60); }
  }
}

export async function waitForSettle(cdp, from, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    await wait(250);
    const slug = await settledSlug(cdp);
    if (slug !== from) { await wait(1200); return {slug, ms: Date.now() - start}; }
  }
  return {slug: from, ms: null};
}

export async function openPage(cdp, url, {mobile = MOBILE, width = W, height = H, dpr = DPR} = {}) {
  const log = {errors: [], failed: [], warnings: []};
  cdp.on(m => {
    if (m.method === 'Runtime.exceptionThrown') log.errors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 240));
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) (m.params.type === 'error' ? log.errors : log.warnings).push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 240));
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) log.failed.push(m.params.response.status + ' ' + m.params.response.url);
    if (m.method === 'Network.loadingFailed' && !m.params.canceled) log.failed.push(m.params.errorText + ' ' + (m.params.requestId));
  });
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable'); await cdp.send('Network.enable'); await cdp.send('Performance.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: dpr, mobile});
  if (mobile) {
    await cdp.send('Emulation.setUserAgentOverride', {userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'});
    await cdp.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
  }
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {source: INSTRUMENT});
  const t0 = Date.now();
  await cdp.send('Page.navigate', {url});
  // Loaded = the loader is done and the sound question (or the scene) is showing.
  let loadedMs = null;
  for (let i = 0; i < 240; i++) {
    await wait(250);
    const ready = await cdp.evaluate(`!!document.querySelector('.xelle-audio-prompt') || (!!document.querySelector('.gpuApp canvas') && !document.querySelector('.mainLoader'))`);
    if (ready === true) { loadedMs = Date.now() - t0; break; }
  }
  await cdp.evaluate(`[...document.querySelectorAll('button')].find(b => /f.r. sunet/i.test(b.textContent))?.click()`);
  await wait(2500);
  return {log, loadedMs};
}

export async function metrics(cdp) {
  const {metrics: list} = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(list.map(x => [x.name, x.value]));
  return {heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), listeners: m.JSEventListeners, nodes: m.Nodes};
}

async function main() {
  const {child, profile, page} = await launch();
  const cdp = await connect(page);
  const report = {when: new Date().toISOString(), gpu: GPU, size: `${W}x${H}`, dpr: DPR, mobile: MOBILE, stages: [], transitions: []};
  try {
    const {log, loadedMs} = await openPage(cdp, URL_BASE);
    report.loadedMs = loadedMs;
    report.renderer = await cdp.evaluate(`(() => { const c = document.querySelector('.gpuApp canvas'); const gl = c && (c.getContext('webgl2')); const d = gl && gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null; })()`);
    await wait(3000);
    report.memoryStart = await metrics(cdp);
    let slug = await settledSlug(cdp);
    for (let i = 0; i < SLUGS.length; i++) {
      const stats = await sample(cdp, 3000);
      report.stages.push({slug, ...stats});
      console.log(`${slug.padEnd(22)} fps ${String(stats.fps).padStart(3)}  p95 ${String(stats.p95).padStart(6)}ms  >50ms ${String(stats.over50).padStart(3)}  draws/frame ${String(stats.drawsPerFrame).padStart(5)}  tris/frame ${String(stats.trianglesPerFrame).padStart(8)}  cpu ${stats.cpuMsPerFrame}ms (js ${stats.scriptMsPerFrame})  raf/frame ${stats.rafPerFrame}  canvas ${stats.canvas}  longTasks ${stats.longTasks.length}`);
      if (i === SLUGS.length - 1) break;
      const before = await cdp.evaluate(`window.__xperf.longTasks.length`);
      await step(cdp, 1);
      const moved = await waitForSettle(cdp, slug);
      const longDuring = await cdp.evaluate(`window.__xperf.longTasks.slice(${before})`);
      report.transitions.push({from: slug, to: moved.slug, ms: moved.ms, longTasks: longDuring});
      if (moved.slug === slug) { console.log('  (did not advance from ' + slug + ')'); break; }
      slug = moved.slug;
    }
    report.memoryEnd = await metrics(cdp);
    report.errors = log.errors; report.failed = log.failed; report.warnings = log.warnings.slice(0, 20);
    report.contextLost = await cdp.evaluate('window.__xperf.contextLost');
    console.log(`load ${loadedMs} ms | renderer ${report.renderer}`);
    console.log('transitions', report.transitions.map(t => `${t.from}->${t.to} ${t.ms}ms long:${t.longTasks.map(l => l.ms).join('/') || 0}`).join(' | '));
    console.log('memory', JSON.stringify(report.memoryStart), '->', JSON.stringify(report.memoryEnd));
    console.log('errors', JSON.stringify(report.errors), 'failed', JSON.stringify(report.failed));
  } finally {
    if (args.out) fs.writeFileSync(args.out, JSON.stringify(report, null, 1));
    child.kill();
    setTimeout(() => { try { fs.rmSync(profile, {recursive: true, force: true}); } catch {} process.exit(0); }, 500);
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) main();
