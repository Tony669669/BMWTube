import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
 for(const width of [390,1422]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:456}}),errors=[],queries=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   localStorage.setItem('bmwtube.key',JSON.stringify('test-key'));
   window.SpeechRecognition=class{
    constructor(){window.recognition=this;}
    start(){}
    abort(){this.aborted=true;}
    result(text){this.onresult({results:[Object.assign([{transcript:text}],{isFinal:true})]});}
   };
  });
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin==='https://bmwtube.test'){
    const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
    return route.fulfill({body:await readFile(new URL('../dist/'+name,import.meta.url)),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
   }
   if(url.hostname==='www.googleapis.com'){if(url.searchParams.has('q'))queries.push(url.searchParams.get('q'));return route.fulfill({json:{items:[]}});}
   return route.abort();
  });
  await page.goto('https://bmwtube.test');
  await page.locator('#open-search').click();
  assert.equal(await page.locator('#search-dialog').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal(await page.locator('#query').evaluate(el=>el===document.activeElement),true);
  const mic=page.locator('#voice-search');
  const layout=async()=>({dialog:await page.locator('#search-dialog').boundingBox(),mic:await mic.boundingBox()});
  const initialLayout=await layout();
  assert.equal(await page.locator('#voice-status').textContent(),'Chạm micro để nói');
  assert.equal(await page.locator('#voice-status').isVisible(),true);

  const box=await mic.boundingBox(),field=await page.locator('.search-field').boundingBox();
  assert.ok(box.y>=field.y+field.height);assert.equal(box.width,86);assert.equal(box.height,86);
  assert.equal(await mic.evaluate(el=>getComputedStyle(el).borderRadius),'50%');
  assert.ok(Math.abs(box.x+box.width/2-field.x-field.width/2)<1);
  assert.equal(await page.locator('#open-voice-search, #passenger-open-voice-search, #search-dialog h2, #search-dialog .dialog-hint, .voice-search-action span').count(),0);
  assert.equal(await mic.locator('svg').evaluate(el=>getComputedStyle(el).stroke),'rgb(255, 255, 255)');
  await page.screenshot({path:`/tmp/bmwtube-voice-${width}.png`});
  await mic.click();assert.equal(await mic.getAttribute('aria-pressed'),'true');
  assert.equal(await mic.getAttribute('data-voice-state'),'starting');
  assert.deepEqual(await layout(),initialLayout);
  assert.equal(await page.locator('#voice-status').textContent(),'Đang mở micro…');
  assert.equal(await mic.evaluate(el=>getComputedStyle(el,'::before').animationName),'voice-spin');
  await page.evaluate(()=>window.recognition.onstart());
  assert.equal(await mic.getAttribute('data-voice-state'),'listening');
  assert.equal(await mic.getAttribute('aria-busy'),'false');
  assert.equal(await mic.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 194, 71)');
  assert.equal(await mic.evaluate(el=>getComputedStyle(el,'::after').animationName),'voice-wave');
  assert.equal(await mic.locator('svg').evaluate(el=>getComputedStyle(el).stroke),'rgb(41, 32, 13)');
  assert.deepEqual(await layout(),initialLayout);
  await page.screenshot({path:`/tmp/bmwtube-listening-${width}.png`});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await mic.evaluate(el=>getComputedStyle(el,'::before').animationName),'none');
  assert.equal(await mic.locator('svg').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await mic.click();assert.deepEqual(await layout(),initialLayout);
  assert.equal(await page.locator('#voice-status').textContent(),'Chạm micro để nói');
  await mic.click();await page.evaluate(()=>window.recognition.onstart());

  await page.evaluate(()=>window.recognition.result('nhạc Trịnh'));
  assert.equal(await mic.getAttribute('data-voice-state'),'idle');
  await page.waitForFunction(()=>!document.querySelector('#search-dialog').open);
  await page.waitForFunction(()=>document.querySelector('#browse-title').textContent==='Không tìm thấy kết quả');
  assert.ok(queries.includes('nhạc Trịnh'));
  await page.locator('#open-search').click();await mic.click();
  assert.equal(await mic.getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.recognition.aborted),true);
  assert.equal(await mic.getAttribute('data-voice-state'),'idle');
  const count=queries.length;await page.evaluate(()=>window.recognition.result('late'));
  assert.equal(queries.length,count);
  await page.locator('#open-search').click();
  const errorLayout=await layout();await mic.click();
  await page.evaluate(()=>window.recognition.onerror({error:'not-allowed'}));
  assert.match(await page.locator('#voice-status').textContent(),/quyền micro/);
  assert.deepEqual(await layout(),errorLayout);
  await page.locator('#voice-status').evaluate(el=>{el.textContent=el.textContent.repeat(8);});
  assert.deepEqual(await layout(),errorLayout);
  assert.equal(await page.locator('.voice-status-slot').evaluate(el=>el.scrollHeight>el.clientHeight),true);

  assert.equal(await mic.getAttribute('aria-pressed'),'false');
  assert.equal(await mic.getAttribute('data-voice-state'),'idle');
  assert.equal(await mic.evaluate(el=>getComputedStyle(el,'::before').animationName),'none');
  assert.deepEqual(errors,[]);await page.close();console.log(`PASS voice UI ${width}`);
 }
}finally{await browser.close();}
