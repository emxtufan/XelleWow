import { readFile, writeFile, copyFile } from 'node:fs/promises';
const original = new URL('../original/app.js',import.meta.url);
const source = await readFile(original,'utf8');
const remote = 'https://unpkg.com/detect-gpu@5.0.70/dist/benchmarks';
if (!source.includes(remote)) throw new Error('Adresa originala GPU nu a fost gasita.');
await writeFile(new URL('../public/assets/app.js',import.meta.url),source.replaceAll(remote,'/benchmarks'));
await copyFile(new URL('../original/app.css',import.meta.url),new URL('../public/assets/app.css',import.meta.url));
console.log('Aplicatia originala a fost configurata pentru resurse locale.');
