import { fileURLToPath } from 'node:url';
try {
  const status = await (await fetch('http://127.0.0.1:4173/__local/status',{signal:AbortSignal.timeout(1000)})).json();
  if (status.app !== 'cartier-local' || status.root !== fileURLToPath(new URL('../public/',import.meta.url))) throw new Error('Alt server foloseste portul.');
  process.kill(status.pid);
  console.log('Serverul Cartier local a fost oprit.');
} catch (error) { console.log('Serverul Cartier nu este pornit sau nu a putut fi oprit: '+error.message); }
