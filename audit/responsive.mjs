// Screenshots of key stages at the five reference viewports, as one contact
// sheet per viewport in audit/perf/responsive-<viewport>.png.
//   node audit/responsive.mjs [--gpu=nvidia]
import fs from 'node:fs';
import {launch, connect, openPage} from './perf-run.mjs';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const wait = ms => new Promise(r => setTimeout(r, ms));
const VIEWPORTS = [
  {name: 'desktop-1920x1080', width: 1920, height: 1080, dpr: 1, mobile: false},
  {name: 'laptop-1440x900', width: 1440, height: 900, dpr: 2, mobile: false},
  {name: 'tablet-768x1024', width: 768, height: 1024, dpr: 2, mobile: false},
  {name: 'phone-390x844', width: 390, height: 844, dpr: 3, mobile: true},
  {name: 'phone-360x800', width: 360, height: 800, dpr: 2, mobile: true},
];
const SHOTS = [['intrare', false], ['pornstar-martini', false], ['maracuja-mojito', true]];
const summary = [];
for (const vp of VIEWPORTS) {
  const shots = [];
  for (const [section, open] of SHOTS) {
    const {child, page} = await launch({gpu: args.gpu || 'nvidia', port: 9800 + Math.floor(Math.random() * 150)});
    const cdp = await connect(page);
    const {log} = await openPage(cdp, `http://127.0.0.1:4173/?sectiune=${section}`, vp);
    await wait(3000);
    if (open) { await cdp.evaluate(`[...document.querySelectorAll('a,button')].find(b => /Descoper. parfumul/i.test(b.textContent))?.click()`); await wait(4500); }
    const overflow = await cdp.evaluate(`document.documentElement.scrollWidth > innerWidth + 1`);
    const shot = await cdp.send('Page.captureScreenshot', {format: 'jpeg', quality: 70});
    const file = `audit/perf/responsive-${vp.name}-${section}${open ? '-open' : ''}.jpg`;
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    shots.push(file);
    summary.push({viewport: vp.name, section, open, horizontalOverflow: overflow, errors: log.errors});
    child.kill();
  }
}
console.log(JSON.stringify(summary.map(s => `${s.viewport} ${s.section}${s.open ? ' (open)' : ''}: overflow ${s.horizontalOverflow}, errors ${s.errors.length}`), null, 1));
process.exit(0);
