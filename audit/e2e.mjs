// End-to-end checks of the experience through Chrome's DevTools protocol.
// No dependencies; the local server must run on 127.0.0.1:4173.
//
//   node audit/e2e.mjs [--gpu=intel|nvidia] [--only=name,name] [--out=audit/perf/e2e.json]
//
// Each test prints PASS/FAIL with its evidence. Console errors from every test
// are collected; the known engine notice from @theatre/studio is reported
// separately because the original bundle emits it on every load.
import fs from 'node:fs';
import {launch, connect, openPage, settledSlug, sample, metrics} from './perf-run.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const GPU = args.gpu || 'nvidia';
const BASE = 'http://127.0.0.1:4173/';
const STAGES = ['intrare', 'spiced-peach-negroni', 'pornstar-martini', 'prosecco-di-cherry', 'maracuja-mojito', 'filmul-xelle', 'galeria-xelle'];
const wait = ms => new Promise(r => setTimeout(r, ms));
const KNOWN = /$^/; // nothing is excused: every console error fails its test
const results = [];

async function session(options = {}) {
  const port = 9700 + Math.floor(Math.random() * 250);
  const browser = await launch({gpu: GPU, port});
  const cdp = await connect(browser.page);
  return {...browser, cdp, port, close: () => { browser.child.kill(); }};
}

async function wheel(cdp, notches, gap = 60, direction = 1) {
  for (let i = 0; i < notches; i++) { await cdp.send('Input.dispatchMouseEvent', {type: 'mouseWheel', x: 960, y: 540, deltaX: 0, deltaY: 120 * direction}); await wait(gap); }
}

async function swipe(cdp, direction = 1, width = 390, height = 844) {
  const x = width / 2, y0 = height * (direction > 0 ? 0.75 : 0.3), y1 = height * (direction > 0 ? 0.3 : 0.75);
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y: y0}]});
  for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x, y: y0 + (y1 - y0) * i / 8}]}); await wait(16); }
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
}

// Waits until the address shows a settled stage different from `from` (or the timeout).
async function settle(cdp, from, timeout = 9000) {
  const start = Date.now();
  let slug = from;
  while (Date.now() - start < timeout) { await wait(250); slug = await settledSlug(cdp); if (slug !== from) break; }
  await wait(1500);
  return settledSlug(cdp);
}

async function drawing(cdp) {
  const a = await cdp.evaluate('window.__xperf.draws');
  await wait(1000);
  return (await cdp.evaluate('window.__xperf.draws')) - a;
}

function record(name, pass, evidence, log) {
  const errors = log ? log.errors.filter(e => !KNOWN.test(e)) : [];
  const ok = pass && errors.length === 0;
  results.push({name, pass: ok, evidence, errors, failed: log ? log.failed : []});
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${typeof evidence === 'string' ? evidence : JSON.stringify(evidence)}${errors.length ? '  errors: ' + JSON.stringify(errors) : ''}${log && log.failed.length ? '  failed: ' + JSON.stringify(log.failed) : ''}`);
}

const tests = {
  async 'initial-load'() {
    const s = await session();
    try {
      const {log, loadedMs} = await openPage(s.cdp, BASE, {width: 1920, height: 1080, dpr: 1});
      const draws = await drawing(s.cdp);
      record('initial-load', loadedMs !== null && draws > 0, {loadedMs, drawsPerSecond: draws, notFound: log.failed.length}, log);
    } finally { s.close(); }
  },

  async 'full-navigation'() {
    const s = await session();
    try {
      const {log} = await openPage(s.cdp, BASE, {width: 1920, height: 1080, dpr: 1});
      const visited = [await settledSlug(s.cdp)];
      for (let i = 1; i < STAGES.length; i++) { await wheel(s.cdp, 4); visited.push(await settle(s.cdp, visited[visited.length - 1])); }
      record('full-navigation', JSON.stringify(visited) === JSON.stringify(STAGES), visited.join(' > '), log);
    } finally { s.close(); }
  },

  async 'slow-scroll'() {
    const s = await session();
    try {
      const {log} = await openPage(s.cdp, BASE, {width: 1920, height: 1080, dpr: 1});
      const seen = [];
      for (let i = 0; i < 30; i++) { await wheel(s.cdp, 1); await wait(300); const slug = await settledSlug(s.cdp); if (seen[seen.length - 1] !== slug) seen.push(slug); }
      await wait(3000); const last = await settledSlug(s.cdp); if (seen[seen.length - 1] !== last) seen.push(last);
      const order = seen.map(slug => STAGES.indexOf(slug));
      const monotonic = order.every((v, i) => i === 0 || v === order[i - 1] + 1);
      record('slow-scroll', monotonic && order[order.length - 1] > 0, seen.join(' > '), log);
    } finally { s.close(); }
  },

  async 'fast-scroll'() {
    const s = await session();
    try {
      const {log} = await openPage(s.cdp, BASE + '?sectiune=spiced-peach-negroni', {width: 1920, height: 1080, dpr: 1});
      await wait(2500);
      const from = await settledSlug(s.cdp);
      await wheel(s.cdp, 30, 10);
      const to = await settle(s.cdp, from);
      record('fast-scroll', STAGES.indexOf(to) === STAGES.indexOf(from) + 1, `${from} > ${to} (30 notches in 0.3 s)`, log);
    } finally { s.close(); }
  },

  async 'reverse-scroll'() {
    const s = await session();
    try {
      const {log} = await openPage(s.cdp, BASE + '?sectiune=prosecco-di-cherry', {width: 1920, height: 1080, dpr: 1});
      await wait(2500);
      const a = await settledSlug(s.cdp);
      await wheel(s.cdp, 4, 60, -1); const b = await settle(s.cdp, a);
      await wheel(s.cdp, 4, 60, 1); const c = await settle(s.cdp, b);
      // Direction change inside one gesture: two notches down then six up (four net).
      await wheel(s.cdp, 2, 40, 1); await wheel(s.cdp, 6, 40, -1); const d = await settle(s.cdp, c);
      record('reverse-scroll', b === 'pornstar-martini' && c === 'prosecco-di-cherry' && d === 'pornstar-martini', `${a} > ${b} > ${c} > (down+up) ${d}`, log);
    } finally { s.close(); }
  },

  async 'resize-during-animation'() {
    const s = await session();
    try {
      const {log} = await openPage(s.cdp, BASE, {width: 1920, height: 1080, dpr: 1});
      const from = await settledSlug(s.cdp);
      await wheel(s.cdp, 4);
      await wait(500);
      for (const [w, h] of [[1280, 720], [1440, 900], [800, 1000], [1920, 1080]]) { await s.cdp.send('Emulation.setDeviceMetricsOverride', {width: w, height: h, deviceScaleFactor: 1, mobile: false}); await wait(300); }
      const to = await settle(s.cdp, from);
      const canvas = await s.cdp.evaluate(`(() => { const c = document.querySelector('.gpuApp canvas'); return [c.clientWidth, c.clientHeight]; })()`);
      const draws = await drawing(s.cdp);
      record('resize-during-animation', to === 'spiced-peach-negroni' && canvas[0] === 1920 && canvas[1] === 1080 && draws > 0, {to, canvas, drawsPerSecond: draws}, log);
    } finally { s.close(); }
  },

  async 'refresh-mid-page'() {
    const s = await session();
    try {
      const {log} = await openPage(s.cdp, BASE + '?sectiune=maracuja-mojito', {width: 1920, height: 1080, dpr: 1});
      await wait(2500);
      const before = await settledSlug(s.cdp);
      await s.cdp.send('Page.reload', {ignoreCache: false});
      await wait(9000);
      await s.cdp.evaluate(`[...document.querySelectorAll('button')].find(b => /f.r. sunet/i.test(b.textContent))?.click()`);
      await wait(2500);
      const after = await settledSlug(s.cdp);
      record('refresh-mid-page', before === 'maracuja-mojito' && after === 'maracuja-mojito', `${before} > reload > ${after}`, log);
    } finally { s.close(); }
  },

  async 'back-forward'() {
    const s = await session();
    try {
      const {log} = await openPage(s.cdp, BASE + '?sectiune=pornstar-martini', {width: 1920, height: 1080, dpr: 1});
      await wait(2500);
      const url = () => s.cdp.evaluate('location.search');
      const shopOpen = () => s.cdp.evaluate(`!!document.querySelector('.xelle-shop-page')`);
      await s.cdp.evaluate(`document.querySelector('.xelle-menu__toggle')?.click()`); await wait(800);
      await s.cdp.evaluate(`[...document.querySelectorAll('.xelle-menu__link')].find(a => /Produse/.test(a.textContent))?.click()`); await wait(1500);
      const products = [await url(), await shopOpen()];
      await s.cdp.evaluate(`document.querySelector('.xelle-shop-card')?.click()`); await wait(1500);
      const product = [await url(), await shopOpen()];
      await s.cdp.evaluate('history.back()'); await wait(1200);
      const back1 = [await url(), await shopOpen()];
      await s.cdp.evaluate('history.back()'); await wait(1500);
      const back2 = [await url(), await shopOpen()];
      await s.cdp.evaluate('history.forward()'); await wait(1500);
      const forward = [await url(), await shopOpen()];
      const draws = (await s.cdp.evaluate('history.back()'), await wait(1500), await drawing(s.cdp));
      const ok = products[1] && /produse/.test(products[0]) && /produs=/.test(product[0]) && back1[1] && /produse/.test(back1[0])
        && !back2[1] && /pornstar-martini/.test(back2[0]) && forward[1] && draws > 0;
      record('back-forward', ok, {products, product, back1, back2, forward, drawsAfterBack: draws}, log);
    } finally { s.close(); }
  },

  async 'repeated-navigation'() {
    const s = await session();
    try {
      const {log} = await openPage(s.cdp, BASE, {width: 1920, height: 1080, dpr: 1});
      const rounds = [];
      for (let round = 0; round < 3; round++) {
        for (let i = 1; i < STAGES.length; i++) { await wheel(s.cdp, 4); await settle(s.cdp, await settledSlug(s.cdp)); }
        for (let i = 1; i < STAGES.length; i++) { await wheel(s.cdp, 4, 60, -1); await settle(s.cdp, await settledSlug(s.cdp)); }
        await s.cdp.send('HeapProfiler.collectGarbage').catch(() => {});
        await wait(1000);
        rounds.push({stage: await settledSlug(s.cdp), ...(await metrics(s.cdp))});
      }
      const growth = rounds[2].heapMB - rounds[0].heapMB;
      record('repeated-navigation', rounds.every(r => r.stage === 'intrare') && growth < 15 && rounds[2].listeners - rounds[0].listeners < 50, {rounds, heapGrowthMB: +growth.toFixed(1)}, log);
    } finally { s.close(); }
  },

  async 'background-tab'() {
    const s = await session();
    try {
      const {log} = await openPage(s.cdp, BASE + '?sectiune=spiced-peach-negroni', {width: 1920, height: 1080, dpr: 1});
      await wait(2000);
      const {targetId} = await s.cdp.send('Target.createTarget', {url: 'about:blank'});
      await wait(4000);
      const hiddenDraws = await drawing(s.cdp);
      await s.cdp.send('Target.closeTarget', {targetId});
      await s.cdp.send('Page.bringToFront');
      await wait(1500);
      const stats = await sample(s.cdp, 2000);
      await wheel(s.cdp, 4); const to = await settle(s.cdp, 'spiced-peach-negroni');
      record('background-tab', stats.fps > 20 && to === 'pornstar-martini', {drawsPerSecondWhileHidden: hiddenDraws, fpsAfterReturn: stats.fps, scrollAfterReturn: to}, log);
    } finally { s.close(); }
  },

  async 'cache-empty-vs-warm'() {
    const s = await session();
    try {
      const cold = await openPage(s.cdp, BASE, {width: 1920, height: 1080, dpr: 1});
      const t0 = Date.now();
      await s.cdp.send('Page.reload', {ignoreCache: false});
      let warmMs = null;
      for (let i = 0; i < 160; i++) { await wait(250); if (await s.cdp.evaluate(`!!document.querySelector('.xelle-audio-prompt')`)) { warmMs = Date.now() - t0; break; } }
      record('cache-empty-vs-warm', cold.loadedMs !== null && warmMs !== null, {coldMs: cold.loadedMs, warmMs}, cold.log);
    } finally { s.close(); }
  },

  async 'slow-connection'() {
    const s = await session();
    try {
      await s.cdp.send('Network.enable');
      // Fast 4G as Chrome's preset describes it: 9 Mbit/s down, 1.5 Mbit/s up, 60 ms latency (here 150 ms).
      await s.cdp.send('Network.emulateNetworkConditions', {offline: false, latency: 150, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8});
      const {log, loadedMs} = await openPage(s.cdp, BASE, {width: 390, height: 844, dpr: 3, mobile: true});
      const draws = await drawing(s.cdp);
      record('slow-connection', loadedMs !== null && draws > 0, {loadedMs, profile: '9 Mbit/s, 150 ms RTT, phone'}, log);
    } finally { s.close(); }
  },

  async 'device-pixel-ratio'() {
    const rows = [];
    let allLogs = {errors: [], failed: []};
    for (const [w, h, dpr, mobile] of [[1440, 900, 1, false], [1440, 900, 2, false], [390, 844, 3, true], [360, 800, 2, true], [768, 1024, 2, false]]) {
      const s = await session();
      try {
        const {log} = await openPage(s.cdp, BASE, {width: w, height: h, dpr, mobile});
        await wait(1500);
        const canvas = await s.cdp.evaluate(`(() => { const c = document.querySelector('.gpuApp canvas'); return [c.width, c.height, c.clientWidth, c.clientHeight]; })()`);
        rows.push({viewport: `${w}x${h}@${dpr}${mobile ? ' mobile' : ''}`, canvas: `${canvas[0]}x${canvas[1]}`, scale: +(canvas[0] / canvas[2]).toFixed(2)});
        allLogs.errors.push(...log.errors); allLogs.failed.push(...log.failed);
      } finally { s.close(); }
    }
    record('device-pixel-ratio', rows.every(r => r.scale >= 1), rows, allLogs);
  },

  async 'webgl-context-loss'() {
    const s = await session();
    try {
      const {log} = await openPage(s.cdp, BASE + '?sectiune=spiced-peach-negroni', {width: 1920, height: 1080, dpr: 1});
      await wait(2000);
      const lost = await s.cdp.evaluate(`(() => { const gl = document.querySelector('.gpuApp canvas').getContext('webgl2'); const ext = gl.getExtension('WEBGL_lose_context'); window.__loseExt = ext; ext.loseContext(); return gl.isContextLost(); })()`);
      await wait(1500);
      await s.cdp.evaluate('window.__loseExt.restoreContext()');
      await wait(4000);
      const draws = await drawing(s.cdp);
      const state = await s.cdp.evaluate(`(() => { const gl = document.querySelector('.gpuApp canvas').getContext('webgl2'); return {lostNow: gl.isContextLost(), contextLostEvents: window.__xperf.contextLost}; })()`);
      record('webgl-context-loss', lost === true && !state.lostNow && draws > 0, {lost, ...state, drawsPerSecondAfterRestore: draws}, log);
    } finally { s.close(); }
  },

  async 'reduced-motion'() {
    const s = await session();
    try {
      await s.cdp.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
      const {log} = await openPage(s.cdp, BASE, {width: 1920, height: 1080, dpr: 1});
      const visited = [await settledSlug(s.cdp)];
      const times = [];
      for (let i = 1; i < STAGES.length; i++) {
        const t0 = Date.now();
        await wheel(s.cdp, 4);
        let slug = visited[visited.length - 1];
        while (Date.now() - t0 < 9000 && slug === visited[visited.length - 1]) { await wait(100); slug = await settledSlug(s.cdp); }
        times.push(Date.now() - t0);
        await wait(800);
        visited.push(slug);
      }
      const matches = await s.cdp.evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches`);
      record('reduced-motion', matches && JSON.stringify(visited) === JSON.stringify(STAGES), {visited: visited.join(' > '), msToSettle: times}, log);
    } finally { s.close(); }
  },

  async 'mobile-swipes'() {
    const s = await session();
    try {
      const {log} = await openPage(s.cdp, BASE, {width: 390, height: 844, dpr: 3, mobile: true});
      const visited = [await settledSlug(s.cdp)];
      for (let i = 1; i < STAGES.length; i++) { await swipe(s.cdp, 1); visited.push(await settle(s.cdp, visited[visited.length - 1])); }
      const back = []; for (let i = 0; i < 2; i++) { await swipe(s.cdp, -1); back.push(await settle(s.cdp, back[back.length - 1] || visited[visited.length - 1])); }
      record('mobile-swipes', JSON.stringify(visited) === JSON.stringify(STAGES) && back[0] === 'filmul-xelle' && back[1] === 'maracuja-mojito', `${visited.join(' > ')} | back: ${back.join(' > ')}`, log);
    } finally { s.close(); }
  },
};

const only = args.only ? String(args.only).split(',') : Object.keys(tests);
for (const name of only) {
  try { await tests[name](); } catch (error) { record(name, false, 'crashed: ' + (error.stack || error).toString().slice(0, 300)); }
}
console.log(`\n${results.filter(r => r.pass).length}/${results.length} passed`);
if (args.out) fs.writeFileSync(args.out, JSON.stringify({when: new Date().toISOString(), gpu: GPU, results}, null, 1));
process.exit(0);
