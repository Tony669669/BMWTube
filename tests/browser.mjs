// Isolated browser regression checks: no live Google requests or user profile.
// PLAYWRIGHT_MODULE may point to a locally installed Playwright entry point.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const ids=['M7lc1UVf-VE','dQw4w9WgXcQ','jNQXAC9IVRw'];
const result=(id=ids[0],nextPageToken='next')=>({items:[{id:{videoId:id},snippet:{title:'Sample video',channelTitle:'Sample channel'}}],nextPageToken});
let passed=0;
async function scenario(name,run){await run();passed++;console.log('PASS',name);}
async function setup({width=1422,height=456,storage={},url='/'}={}){
 const page=await browser.newPage({viewport:{width,height}});
 page.setDefaultTimeout(5000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const calls=[];
 const control={reply:async route=>route.fulfill({json:result()})};
 await page.addInitScript(values=>{for(const [key,value] of Object.entries(values))localStorage.setItem('bmwtube.'+key,JSON.stringify(value));},storage);
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.origin==='http://bmwtube.test'){
   const name=u.pathname==='/'?'index.html':u.pathname.slice(1);
   const body=await readFile(new URL('../dist/'+name,import.meta.url));
   return route.fulfill({body,contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
  }
  if(u.hostname==='www.googleapis.com'){calls.push(u);return control.reply(route);}
  if(u.pathname==='/iframe_api')return route.fulfill({contentType:'text/javascript',body:`
   window.YT={Player:class {
    constructor(id,options){this.options=options;this.id=options.videoId;this.state=2;this.position=0;this.caption=false;window.mockPlayer=this;setTimeout(()=>options.events.onReady({target:this}),10);}
    playVideo(){this.state=1;this.options.events.onStateChange({data:1});}
    pauseVideo(){this.state=2;this.options.events.onStateChange({data:2});}
    cueVideoById(id){this.id=id;}
    loadVideoById(id){this.id=id;this.playVideo();}
    getVideoData(){return {title:'Sample video'};}
    getPlayerState(){return this.state;}
    getDuration(){return 200;}
    getCurrentTime(){return this.position;}
    seekTo(n){this.position=n;}
    getOptions(){return this.caption?['captions']:[];}
    loadModule(){this.caption=true;}
    unloadModule(){this.caption=false;}
   }};window.onYouTubeIframeAPIReady();`});
  return route.abort();
 });
 await page.goto('http://bmwtube.test'+url);
 return {page,errors,calls,control};
}
async function rect(page,id){return page.locator('#'+id).boundingBox();}
async function enter(page,text){await page.locator('#open-search').click();await page.locator('#query').fill(text);await page.locator('#search-form').evaluate(f=>f.requestSubmit());}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1,`${a} != ${b}`);
try{
 await scenario('BMW 1422×456: seat mirror, popup, settings persist and no extra API on seat change',async()=>{
  const {page,errors,calls}=await setup({url:'/?v='+ids[0],storage:{key:'test-key'}});
  const left=await rect(page,'stage');near(left.x,0);near(left.height,456);near(left.width,456*16/9);assert.equal(calls.length,0);
  await page.locator('#account').click();await page.locator('[name=player-side][value=right]').check();await page.locator('#settings-form').evaluate(f=>f.requestSubmit());
  const right=await rect(page,'stage');near(right.x+right.width,1422);near((await rect(page,'app-rail')).x,0);assert.equal(calls.length,0);
  await page.reload();near((await rect(page,'stage')).x+left.width,1422);
  await page.locator('#open-search').click();await page.locator('#query').fill('sample');assert.equal(calls.length,0);
  await page.locator('#query').fill('https://example.com/bad');await page.locator('#search-form').evaluate(f=>f.requestSubmit());assert.equal(await page.locator('#search-dialog').evaluate(d=>d.open),true);assert.equal(await page.locator('#search-dialog .dialog-status').isVisible(),true);
  await page.keyboard.press('Escape');assert.deepEqual(errors,[]);await page.close();
 });
 await scenario('Fullscreen on narrow screens uses viewport height, hides links and wakes controls',async()=>{
  for(const width of [320,390,844,1422]){
   const {page,errors}=await setup({width,height:width<500?844:456,url:'/?v='+ids[0]});
   await page.locator('#fullscreen').click();
   near((await rect(page,'stage')).height,width<500?844:456);
   assert.equal(await page.locator('#original').isVisible(),false);
   await page.waitForFunction(()=>getComputedStyle(document.getElementById('transport')).visibility==='hidden');
   await page.locator('#controls-wake').click({position:{x:20,y:100}});
   await page.waitForFunction(()=>getComputedStyle(document.getElementById('transport')).visibility==='visible');
   await page.locator('#fullscreen').click();assert.equal(await page.locator('#app-rail').isVisible(),true);
   const bounds=await rect(page,'transport');assert.ok(bounds.x+bounds.width<=width+1);
   assert.deepEqual(errors,[]);await page.close();
  }
 });
 await scenario('Telex: normal typing, WebView input without metadata, paste and composition',async()=>{
  const {page,errors,calls}=await setup();await page.locator('#open-search').click();await page.locator('#telex').click();
  await page.locator('#query').pressSequentially('tieengs Vieejt');assert.equal(await page.locator('#query').inputValue(),'tiếng Việt');
  await page.locator('#query').fill('');
  await page.locator('#query').evaluate(input=>{for(const c of 'ddawng nhaapj'){input.value+=c;input.setSelectionRange(input.value.length,input.value.length);input.dispatchEvent(new Event('input',{bubbles:true}));}});
  assert.equal(await page.locator('#query').inputValue(),'đăng nhập');
  await page.locator('#query').evaluate(input=>{input.dispatchEvent(new Event('paste'));input.value='https://youtu.be/M7lc1UVf-VE';input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste'}));});
  assert.equal(await page.locator('#query').inputValue(),'https://youtu.be/M7lc1UVf-VE');
  await page.locator('#query').evaluate(input=>{input.dispatchEvent(new CompositionEvent('compositionstart'));input.value='Tiếng Việt';input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));input.form.requestSubmit();});
  assert.equal(await page.locator('#search-dialog').evaluate(d=>d.open),true);
  await page.locator('#query').evaluate(input=>input.dispatchEvent(new CompositionEvent('compositionend')));
  assert.equal(await page.locator('#query').inputValue(),'Tiếng Việt');assert.equal(calls.length,0);assert.deepEqual(errors,[]);await page.close();
 });
 await scenario('Malformed persisted values cannot stop startup',async()=>{
  const {page,errors}=await setup({storage:{key:42,telex:'false',recent:[{title:'bad',id:42},{title:'missing id'}],searches:{bad:1},playerSide:'unknown'}});
  await page.locator('#open-search').click();assert.equal(await page.locator('#telex').getAttribute('aria-pressed'),'false');assert.deepEqual(errors,[]);await page.close();
 });
 await scenario('Repeated pending search costs one API call; typing costs none',async()=>{
  const {page,calls,control,errors}=await setup({storage:{key:'test-key'}});
  await page.waitForFunction(()=>document.querySelectorAll('#results .card').length===1);
  calls.length=0;let release;control.reply=route=>new Promise(resolve=>{release=async()=>{await route.fulfill({json:result()});resolve();};});
  await enter(page,'music');await page.waitForTimeout(40);await enter(page,'music');await page.waitForTimeout(40);assert.equal(calls.length,1);
  await release();await page.waitForFunction(()=>document.querySelectorAll('#results .card').length===1);assert.deepEqual(errors,[]);await page.close();
 });
 await scenario('Open video while loading next page: Back restores working pagination; append failure preserves results',async()=>{
  const {page,control,errors}=await setup({storage:{key:'test-key'}});
  await page.waitForFunction(()=>document.querySelectorAll('#results .card').length===1);
  await enter(page,'music');await page.waitForFunction(()=>document.querySelectorAll('#results .card').length===1);
  let release;control.reply=route=>new Promise(resolve=>{release=async()=>{await route.fulfill({json:result(ids[1])});resolve();};});
  await page.locator('#load-more').click();await page.waitForTimeout(40);await page.locator('#results .card').click();await release();await page.locator('#back').click();
  assert.equal(await page.locator('#load-more').isEnabled(),true);assert.equal(await page.locator('#results .card').count(),1);
  control.reply=route=>route.fulfill({status:500,json:{error:{}}});await page.locator('#load-more').click();await page.waitForFunction(()=>!document.getElementById('load-more').disabled);
  assert.equal(await page.locator('#results .card').count(),1);assert.equal(await page.locator('#load-more').isVisible(),true);assert.deepEqual(errors,[]);await page.close();
 });
 await scenario('A slow older search cannot overwrite a newer query',async()=>{
  const {page,control,errors}=await setup({storage:{key:'test-key'}});await page.waitForFunction(()=>document.querySelectorAll('#results .card').length===1);
  let release;control.reply=route=>new Promise(resolve=>{release=async()=>{await route.fulfill({json:result(ids[1])});resolve();};});
  await enter(page,'old query');await page.waitForTimeout(40);
  control.reply=route=>route.fulfill({json:result(ids[2])});await enter(page,'new query');await page.waitForFunction(()=>document.getElementById('browse-title').textContent==='new query');await release();
  assert.equal(await page.locator('#browse-title').textContent(),'new query');assert.ok((await page.locator('#results img').getAttribute('src')).includes(ids[2]));assert.deepEqual(errors,[]);await page.close();
 });
 await scenario('Player controls: pause, play, seek, CC and original mobile URL',async()=>{
  const {page,errors}=await setup({url:'/?v='+ids[0]});
  await page.waitForFunction(()=>window.mockPlayer?.state===1);
  await page.locator('#play').click();assert.equal(await page.evaluate(()=>mockPlayer.state),2);
  await page.locator('#play').click();assert.equal(await page.evaluate(()=>mockPlayer.state),1);
  await page.locator('#seek').evaluate(input=>{input.value='500';input.dispatchEvent(new Event('input'));input.dispatchEvent(new Event('change'));});
  assert.equal(await page.evaluate(()=>mockPlayer.position),100);
  await page.locator('#cc').click();assert.equal(await page.evaluate(()=>mockPlayer.caption),true);
  await page.locator('#cc').click();assert.equal(await page.evaluate(()=>mockPlayer.caption),false);
  assert.equal(await page.locator('#original').getAttribute('href'),'https://m.youtube.com/watch?v='+ids[0]);
  await page.evaluate(()=>mockPlayer.options.events.onError({data:153}));assert.match(await page.locator('#notice').textContent(),/APTV/);
  const notice=await rect(page,'notice'),transport=await rect(page,'transport');assert.ok(notice.y+notice.height<transport.y);
  assert.deepEqual(errors,[]);await page.close();
 });
 console.log(`${passed} browser regression scenarios passed (YouTube/API mocked).`);
}finally{await browser.close();}
