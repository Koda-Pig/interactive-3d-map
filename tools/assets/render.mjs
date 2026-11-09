import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { serve } from './serve.mjs';
const server=await serve(0);let browser;
try {
 browser=await chromium.launch({executablePath:process.env.ASSET_BROWSER||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1800,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const {assets}=JSON.parse(await readFile('public/models/manifest.json','utf8'));await mkdir('tools/assets/previews',{recursive:true});
 for(const category of new Set(assets.map(a=>a.category))){
  await page.goto(`http://127.0.0.1:${server.address().port}/?category=${category}&sheet=1`);
  await page.waitForFunction(()=>window.assetPreviewReady===true,{},{timeout:60000});
  const count=await page.evaluate(()=>window.assetPreviewCount);if(count!==assets.filter(a=>a.category===category).length)throw Error(`Missing ${category} render`);
  if(errors.length)throw Error(errors.join('\n'));
  await page.screenshot({path:`tools/assets/previews/${category}.png`,fullPage:true});console.log(`Rendered ${category}, ${count} assets`);
 }
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.waitForFunction(()=>window.assetPreviewReady===true,{},{timeout:60000});
 if(await page.locator('.card').count()!==assets.length)throw Error('Incomplete full grid');
 await page.locator('[data-id="race-car-generic"]').click();
 await page.waitForFunction(()=>document.querySelector('#dialog').open&&document.querySelector('#inspect canvas'));
 await page.mouse.move(700,400);await page.mouse.down();await page.mouse.move(800,440);await page.mouse.up();
 await page.locator('#close').click();
 if(await page.locator('#dialog').isVisible())throw Error('Inspector did not close');
 if(errors.length)throw Error(errors.join('\n'));
 console.log('Full 60-asset grid and orbit inspector passed.');
} finally {await browser?.close();server.close();}
