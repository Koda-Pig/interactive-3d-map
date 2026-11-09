import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import validator from 'gltf-validator';
import assert from 'node:assert/strict';
import { catalog } from './catalog.mjs';
import { palette, budgets } from './shared.mjs';

const manifest=JSON.parse(await readFile('public/models/manifest.json','utf8'));
const io=new NodeIO(), reports=[];let total=0;
assert.equal(manifest.assets.length,catalog.length);
assert.equal(new Set(manifest.assets.map(a=>a.id)).size,catalog.length);
const close=(a,b,epsilon=.002)=>Math.abs(a-b)<epsilon;
for(const spec of catalog){
 const a=manifest.assets.find(a=>a.id===spec.id);assert(a,`Missing ${spec.id}`);
 assert.equal(a.file,`/models/${spec.category}/${spec.id}.glb`);
 const bytes=await readFile(`public${a.file}`),report=await validator.validateBytes(new Uint8Array(bytes),{uri:a.file});
 reports.push({id:a.id,errors:report.issues.numErrors,warnings:report.issues.numWarnings,messages:report.issues.messages});
 assert.equal(report.issues.numErrors,0,`${a.id}: ${JSON.stringify(report.issues.messages)}`);
 const doc=await io.readBinary(bytes),root=doc.getRoot();
 assert.equal(root.listScenes().length,1);const nodes=root.listScenes()[0].listChildren();
 assert.equal(nodes.length,1);assert.equal(root.listNodes().length,1);assert.equal(nodes[0].getName(),a.id);
 assert.deepEqual(nodes[0].getTranslation(),[0,0,0]);assert.deepEqual(nodes[0].getRotation(),[0,0,0,1]);assert.deepEqual(nodes[0].getScale(),[1,1,1]);
 assert.equal(root.listTextures().length,0);assert.equal(root.listExtensionsUsed().length,0);
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let triangles=0;const materials=[];let skirtFaces=0;const vertices=[];
 for(const p of nodes[0].getMesh().listPrimitives()){
  assert.equal(p.getMode(),4);const mat=p.getMaterial(),name=mat.getName();assert(name in palette);assert(!materials.includes(name),`${a.id}: unmerged material`);materials.push(name);
  const pos=p.getAttribute('POSITION'),norm=p.getAttribute('NORMAL');assert(norm);const indices=p.getIndices();triangles+=(indices?indices.getCount():pos.getCount())/3;
  const ar=pos.getArray(),nr=norm.getArray();if(spec.tileable)for(let i=0;i<ar.length;i+=3)vertices.push([ar[i],ar[i+1],ar[i+2]]);
  for(let i=0;i<ar.length;i+=3){for(let j=0;j<3;j++){assert(Number.isFinite(ar[i+j]));min[j]=Math.min(min[j],ar[i+j]);max[j]=Math.max(max[j],ar[i+j]);}assert(close(Math.hypot(nr[i],nr[i+1],nr[i+2]),1,.002));}
  // Check nondegenerate triangles, face orientation and flat vertex normals.
  const count=indices?indices.getCount():pos.getCount(),ix=indices?.getArray();
  for(let i=0;i<count;i+=3){const ids=[0,1,2].map(j=>(ix?ix[i+j]:i+j)*3),[u,v,t]=ids;
   const ab=[ar[v]-ar[u],ar[v+1]-ar[u+1],ar[v+2]-ar[u+2]],ac=[ar[t]-ar[u],ar[t+1]-ar[u+1],ar[t+2]-ar[u+2]];
   const n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];assert(Math.hypot(...n)>1e-8,`${a.id}: degenerate triangle`);assert(n.reduce((sum,x,j)=>sum+x*nr[u+j],0)>0,`${a.id}: reversed normals`);
   for(const vi of ids)for(let j=0;j<3;j++)assert(close(nr[u+j],nr[vi+j]),`${a.id}: smooth-shaded triangle`);
   if(ids.every(k=>close(ar[k+1],-3)))skirtFaces++;
  }
 }
 assert(triangles<=budgets[spec.kind],`${a.id}: ${triangles} > ${budgets[spec.kind]} triangles`);
 for(const [j,expected]of [[0,spec.w],[2,spec.d]])assert(Math.abs((max[j]-min[j])/expected-1)<=.1,`${a.id}: dimension ${j}`);
 assert(Math.abs(max[1]/spec.h-1)<=.1,`${a.id}: height`);
 assert(close(min[0]+max[0],0)&&close(min[2]+max[2],0),`${a.id}: footprint not centred`);
 assert(close(min[1],spec.skirt?-3:0),`${a.id}: ground or skirt`);if(spec.skirt)assert(skirtFaces>=2,`${a.id}: missing solid skirt bottom`);
 if(spec.tileable){const boundary=x=>[...new Set(vertices.filter(v=>close(v[0],x)).map(v=>v.slice(1).map(n=>n.toFixed(3)).join(',')))].sort();assert.deepEqual(boundary(min[0]),boundary(max[0]),`${a.id}: mismatched tile boundaries`);}
 assert.equal(a.triangleCount,triangles);assert.equal(a.fileSize,bytes.length);assert.deepEqual(a.materials,materials);
 for(let j=0;j<3;j++){assert(close(a.boundingBox.min[j],min[j]));assert(close(a.boundingBox.max[j],max[j]));}
 assert.deepEqual(a.footprint,[[-spec.w/2,-spec.d/2],[spec.w/2,-spec.d/2],[spec.w/2,spec.d/2],[-spec.w/2,spec.d/2]]);
 assert.equal(a.tileable,!!spec.tileable);assert.equal(a.instanced,spec.kind==='instanced');
 total+=bytes.length;
}
async function glbs(dir){const out=[];for(const ent of await readdir(dir,{withFileTypes:true})){const p=`${dir}/${ent.name}`;if(ent.isDirectory())out.push(...await glbs(p));else if(p.endsWith('.glb'))out.push(p);}return out;}
assert.equal((await glbs('public/models')).length,catalog.length,'Unexpected stale GLBs');
total+=(await stat('public/models/manifest.json')).size;assert(total<15000000,`Kit ${total} bytes exceeds 15 MB`);
const result={assetCount:reports.length,totalBytesIncludingManifest:total,errors:reports.reduce((n,r)=>n+r.errors,0),warnings:reports.reduce((n,r)=>n+r.warnings,0),reports};
await writeFile('tools/assets/validation-report.json',JSON.stringify(result,null,2)+'\n');
console.log(`${reports.length} assets passed. ${total} bytes including manifest. ${result.errors} validator errors, ${result.warnings} warnings.`);
