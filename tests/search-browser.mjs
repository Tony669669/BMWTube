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
  assert.equal(await page.locator('#voice-search,#voice-status,.voice-status-slot').count(),0);
  const dimensions=()=>page.evaluate(()=>{
    const css=getComputedStyle(document.documentElement);
    return ['--feed-card-width','--yellow-card-width','--player-width','--vh'].map(name=>css.getPropertyValue(name));
  });
  const initialDimensions=await dimensions();
  const viewportContent=await page.locator('meta[name=viewport]').getAttribute('content');
  await page.evaluate(()=>{
    window.viewportChanges=[];
    new MutationObserver(records=>{window.viewportChanges.push(...records.map(r=>r.oldValue));}).observe(document.querySelector('meta[name=viewport]'),{attributes:true,attributeOldValue:true,attributeFilter:['content']});
  });
  await page.evaluate(()=>{
    const original=window.visualViewport;window.originalViewport=original;
    Object.defineProperty(window,'visualViewport',{configurable:true,value:{width:document.documentElement.clientWidth/2,height:innerHeight/2,scale:2}});
    window.dispatchEvent(new Event('resize'));
  });
  assert.deepEqual(await dimensions(),initialDimensions);
  await page.locator('#query').fill('nhạc Trịnh');
  await page.locator('#search-form').evaluate(form=>form.requestSubmit());
  await page.waitForFunction(()=>!document.querySelector('#search-dialog').open);
  await page.waitForFunction(()=>document.querySelector('#browse-title').textContent==='Không tìm thấy kết quả');
  assert.ok(queries.includes('nhạc Trịnh'));
  assert.equal(await page.locator('#query').evaluate(el=>el===document.activeElement),false);
  assert.deepEqual(await dimensions(),initialDimensions);
  await page.waitForFunction(()=>window.viewportChanges.some(value=>value.includes('minimum-scale=1')));
  assert.equal(await page.locator('meta[name=viewport]').getAttribute('content'),viewportContent);
  await page.evaluate(()=>{
    Object.defineProperty(window,'visualViewport',{configurable:true,value:window.originalViewport});
    window.dispatchEvent(new Event('resize'));
  });
  assert.deepEqual(await dimensions(),initialDimensions);
  await page.locator('#open-search').click();
  await page.locator('#close-search').click();
  assert.equal(await page.locator('#search-dialog').evaluate(el=>el.open),false);
  assert.deepEqual(errors,[]);await page.close();console.log(`PASS text search UI ${width}`);
 }
}finally{await browser.close();}
