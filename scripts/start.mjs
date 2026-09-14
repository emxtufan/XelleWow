import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../', import.meta.url));
const original = process.argv.includes('--original');
const url = original ? 'http://localhost:4173/cartier.html#/' : 'http://localhost:4173/#/';
const name = original ? 'Cartier local' : 'Xelle local';
async function running() {
  try { return (await (await fetch('http://127.0.0.1:4173/__local/status',{signal:AbortSignal.timeout(1000)})).json()).app === 'cartier-local'; }
  catch { return false; }
}
if (!(await running())) {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {cwd:directory,env:{...process.env,PORT:'4173'},detached:true,windowsHide:true,stdio:'ignore'});
  child.unref();
  let ready = false;
  for (let attempt=0;attempt<30;attempt++) {
    if (await running()) { ready=true; break; }
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  if (!ready) { console.error('Serverul nu a pornit. Verifica daca portul 4173 este ocupat.'); process.exit(1); }
}
if (!process.argv.includes('--no-open')) spawn('cmd.exe',['/d','/c','start','',url],{windowsHide:true,stdio:'ignore'}).unref();
console.log(name+' este disponibil la '+url);
