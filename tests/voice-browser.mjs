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
  await page.locator('#search-dialog').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});
  const mic=page.locator('#voice-search');
  const box=await mic.boundingBox(),field=await page.locator('.search-field').boundingBox();
  assert.ok(box.y>=field.y+field.height);assert.equal(box.width,72);assert.equal(box.height,72);
  assert.equal(await mic.evaluate(el=>getComputedStyle(el).borderRadius),'50%');
  await page.screenshot({path:`/tmp/bmwtube-voice-${width}.png`});
  await mic.click();assert.equal(await mic.getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>window.recognition.result('nhạc Trịnh'));
  await page.waitForFunction(()=>!document.querySelector('#search-dialog').open);
  await page.waitForFunction(()=>document.querySelector('#browse-title').textContent==='Không tìm thấy kết quả');
  assert.ok(queries.includes('nhạc Trịnh'));
  await page.locator('#open-voice-search').click();
  assert.equal(await mic.getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.recognition.aborted),true);
  const count=queries.length;await page.evaluate(()=>window.recognition.result('late'));
  assert.equal(queries.length,count);
  await page.locator('#open-search').click();await mic.click();
  await page.evaluate(()=>window.recognition.onerror({error:'not-allowed'}));
  assert.match(await page.locator('#voice-status').textContent(),/quyền micro/);
  assert.equal(await mic.getAttribute('aria-pressed'),'false');
  assert.deepEqual(errors,[]);await page.close();console.log(`PASS voice UI ${width}`);
 }
}finally{await browser.close();}
