import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const {assets}=JSON.parse(await readFile('public/models/manifest.json','utf8'));
const files=['public/models/manifest.json',...assets.map(a=>`public${a.file}`)];
async function hashes(){return Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));}
const before=await hashes();await import('./generate.mjs');assert.deepEqual(await hashes(),before,'Generated output changed');
await writeFile('tools/assets/determinism-report.json',JSON.stringify({algorithm:'SHA-256',matchedFiles:files.length,hashes:before},null,2)+'\n');
console.log(`${files.length} generated files are byte-identical after regeneration.`);
