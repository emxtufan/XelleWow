// GPU cost of each render pass, measured with EXT_disjoint_timer_query_webgl2.
// A pass is everything drawn into one framebuffer binding; it is labelled by
// its target size and the shaders it uses (uniform/sampler names).
//
//   node audit/gpu-passes.mjs [--gpu=intel|nvidia] [--size=1920x1080] [--dpr=1] [--mobile] [--section=<slug>]
import {launch, connect, openPage} from './perf-run.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const [W, H] = String(args.size || '1920x1080').split('x').map(Number);
const wait = ms => new Promise(r => setTimeout(r, ms));

const PROFILER = `(() => {
  const P = window.__gpuPasses = {on: false, frames: 0, passes: {}, pending: []};
  const proto = WebGL2RenderingContext.prototype;
  const programs = new WeakMap(), shaders = new WeakMap();
  const shaderSource = proto.shaderSource;
  proto.shaderSource = function (shader, source) { shaders.set(shader, source); return shaderSource.apply(this, arguments); };
  const attach = proto.attachShader;
  proto.attachShader = function (program, shader) {
    const source = shaders.get(shader) || '';
    if (/gl_FragColor|out vec4|FragColor/.test(source) && !/gl_Position/.test(source)) {
      const names = [...source.matchAll(/uniform\\s+(?:sampler2D|samplerCube|sampler3D|vec[234]|float|mat[34])\\s+(t[A-Z]\\w*|u[A-Z]\\w*)/g)].map(m => m[1]);
      const defines = [...source.matchAll(/#define\\s+([A-Z_]{4,})/g)].map(m => m[1]).filter(d => !/^(GLSLIFY|PI|HALF_PI|TWO_PI|RECIPROCAL_PI|EPSILON|LOG2|saturate)$/.test(d));
      programs.set(program, [...new Set(defines.slice(0, 3).concat(names.slice(0, 5)))].join(','));
    }
    return attach.apply(this, arguments);
  };
  let current = null, ext = null, viewport = [0, 0];
  const close = gl => {
    if (!current) return;
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    P.pending.push(current);
    current = null;
  };
  const open = (gl, label) => {
    if (!P.on) return;
    ext = ext || gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext) return;
    const query = gl.createQuery();
    gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    current = {query, label, programs: new Set(), draws: 0, size: viewport.join('x')};
  };
  const bind = proto.bindFramebuffer;
  proto.bindFramebuffer = function (target, fb) {
    close(this);
    const result = bind.apply(this, arguments);
    if (!fb || !fb.__xid) { if (fb) fb.__xid = 'fb' + (++P.fbCount || (P.fbCount = 1)); }
    open(this, fb ? fb.__xid : 'screen');
    return result;
  };
  const vp = proto.viewport;
  proto.viewport = function (x, y, w, h) { viewport = [w, h]; if (current && !current.draws) current.size = w + 'x' + h; return vp.apply(this, arguments); };
  let used = null;
  const use = proto.useProgram;
  proto.useProgram = function (program) { used = program; return use.apply(this, arguments); };
  for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
    const original = proto[name];
    proto[name] = function () { if (current) { current.draws++; current.programs.add(programs.get(used) || '?'); } return original.apply(this, arguments); };
  }
  // Collect finished queries every frame.
  const raf = window.requestAnimationFrame.bind(window);
  const collect = () => {
    const canvas = document.querySelector('.gpuApp canvas');
    const gl = canvas && canvas.getContext('webgl2');
    if (gl && ext) {
      P.pending = P.pending.filter(pass => {
        if (!gl.getQueryParameter(pass.query, gl.QUERY_RESULT_AVAILABLE)) return true;
        const ms = gl.getQueryParameter(pass.query, gl.QUERY_RESULT) / 1e6;
        gl.deleteQuery(pass.query);
        if (gl.getParameter(ext.GPU_DISJOINT_EXT)) return false;
        const key = pass.size + ' | ' + [...pass.programs].slice(0, 3).join(' + ');
        const entry = P.passes[key] = P.passes[key] || {ms: 0, n: 0, draws: 0};
        entry.ms += ms; entry.n++; entry.draws += pass.draws;
        return false;
      });
    }
    if (P.on) P.frames++;
    raf(collect);
  };
  raf(collect);
})();`;

const {child, page} = await launch({gpu: args.gpu || 'intel', port: 9600 + Math.floor(Math.random() * 300)});
const cdp = await connect(page);
await cdp.send('Page.enable');
await cdp.send('Page.addScriptToEvaluateOnNewDocument', {source: PROFILER});
const url = 'http://127.0.0.1:4173/' + (args.section ? `?sectiune=${args.section}` : '');
await openPage(cdp, url, {mobile: !!args.mobile, width: W, height: H, dpr: Number(args.dpr || 1)});
await wait(6000);
await cdp.evaluate('window.__gpuPasses.on = true');
await wait(3000);
await cdp.evaluate('window.__gpuPasses.on = false');
await wait(500);
const result = await cdp.evaluate(`(() => { const P = window.__gpuPasses; const frames = P.frames || 1; const rows = Object.entries(P.passes).map(([k, v]) => ({pass: k, msPerFrame: +(v.ms / frames).toFixed(2), passesPerFrame: +(v.n / frames).toFixed(1), drawsPerFrame: +(v.draws / frames).toFixed(1)})).sort((a, b) => b.msPerFrame - a.msPerFrame); return JSON.stringify({frames, totalMs: +rows.reduce((a, r) => a + r.msPerFrame, 0).toFixed(2), canvas: document.querySelector('.gpuApp canvas').width + 'x' + document.querySelector('.gpuApp canvas').height, rows}); })()`);
const data = JSON.parse(result);
console.log(`section ${args.section || 'intrare'} | canvas ${data.canvas} | frames ${data.frames} | GPU total ${data.totalMs} ms/frame`);
for (const row of data.rows.slice(0, 18)) console.log(`${String(row.msPerFrame).padStart(6)} ms  x${row.passesPerFrame}  draws ${String(row.drawsPerFrame).padStart(5)}  ${row.pass.slice(0, 150)}`);
child.kill();
process.exit(0);
