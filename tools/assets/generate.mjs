import { writeFile, mkdir } from 'node:fs/promises';
import { catalog } from './catalog.mjs';
import { design } from './designs.mjs';
import { exportAsset } from './shared.mjs';
const assets=[];
for(const spec of catalog)assets.push(await exportAsset(spec,design(spec)));
await mkdir('public/models',{recursive:true});
await writeFile('public/models/manifest.json',JSON.stringify({version:1,units:'metres',upAxis:'Y',frontAxis:'+Z',footprintPlane:'XZ',footprintPolicy:'Conservative centred rectangular ground envelope, including roof overhangs.',assets},null,2)+'\n');
console.log(`Generated ${assets.length} assets, ${assets.reduce((n,a)=>n+a.fileSize,0)} GLB bytes.`);
