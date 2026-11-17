// Run against an isolated browser and mocked GitHub; no real token or remote writes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULTS, encodeContent} from '../dist/backup.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const sample=()=>({app:'BMWTube',version:1,createdAt:'2026-11-06T01:00:00Z',data:{...structuredClone(DEFAULTS),playlists:[{id:'p1',name:'Nhạc Việt 🎵',videos:[{id:'M7lc1UVf-VE',title:'Bài hát',position:42,duration:200}]}],appProfile:'yellow'}});
async function setup({width=390,height=844,initial={},remote=sample()}={}) {
  const page=await browser.newPage({viewport:{width,height}}), errors=[],requests=[]; page.setDefaultTimeout(8000);
  page.on('pageerror',e=>errors.push(e.message));
  const state={remote,sha:'one',fail:false,branch:!!remote};
  await page.addInitScript(initial=>{
    if(!sessionStorage.getItem('seeded')) {for(const [k,v] of Object.entries(initial))localStorage.setItem('bmwtube.'+k,JSON.stringify(v));sessionStorage.setItem('seeded','1');}
  },initial);
  await page.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.origin==='http://localhost:4173') {
      const name=u.pathname==='/'?'index.html':u.pathname.slice(1);
      return route.fulfill({body:await readFile(new URL('../dist/'+name,import.meta.url)),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
    }
    if(u.hostname==='api.github.com') {
      const req=route.request();requests.push({method:req.method(),headers:req.headers(),url:u.href});
      if(state.fail)return route.fulfill({status:401,json:{message:'Bad credentials'}});
      if(u.pathname.endsWith('/contents/backup.json')) {
        if(req.method()==='PUT') {
          const body=req.postDataJSON();assert.equal(body.branch,'bmwtube-backups');
          assert.equal(body.sha,state.remote?state.sha:undefined);
          state.remote=JSON.parse(Buffer.from(body.content,'base64').toString());state.sha+='x';
          return route.fulfill({json:{content:{sha:state.sha}}});
        }
        return state.remote?route.fulfill({json:{sha:state.sha,size:1000,type:'file',encoding:'base64',content:encodeContent(JSON.stringify(state.remote))}}):route.fulfill({status:404,json:{}});
      }
      if(u.pathname.endsWith('/git/ref/heads/bmwtube-backups'))return route.fulfill({status:state.branch?200:404,json:{object:{sha:'main'}}});
      if(u.pathname.endsWith('/git/refs')) {state.branch=true;return route.fulfill({json:{}});}
      return route.fulfill({json:{object:{sha:'main'}}});
    }
    return route.abort();
  });
  await page.goto('http://localhost:4173');
  return {page,state,errors,requests};
}
async function settings(page) {
  await page.locator('#open-library').click();
  await page.locator('#library-settings').click();
}
try {
  for(const [width,height] of [[390,844],[1422,456]]) {
    const {page,errors}=await setup({width,height,initial:{appProfile:'red'},remote:null});
    await settings(page);
    assert.equal(await page.locator('input[name="app-profile"]').count(),2);
    assert.equal(await page.locator('input[name="app-profile"][value="red"]').count(),0);
    assert.equal(await page.locator('input[name="app-profile"]:checked').inputValue(),'yellow');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bmwtube.appProfile'))),'yellow');
    const geometry=()=>page.evaluate(()=>({
      elements:['app-shell','browse'].map(id=>{
        const el=document.getElementById(id),r=el.getBoundingClientRect(),css=getComputedStyle(el);
        return {id,x:r.x,y:r.y,width:r.width,height:r.height,display:css.display};
      }),
      variables:['--player-width','--yellow-card-width','--yellow-queue-width'].map(k=>getComputedStyle(document.documentElement).getPropertyValue(k))
    }));
    for(const side of ['left','right']) {
      await page.locator(`label:has(input[name="player-side"][value="${side}"])`).click();
      await page.locator('label:has(input[name="app-profile"][value="yellow"])').click();
      const yellow=await geometry();
      await page.locator('label:has(input[name="app-profile"][value="car-cinema"])').click();
      assert.deepEqual(await geometry(),yellow);
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bmwtube.appProfile'))),'car-cinema');
    }
    await page.reload(); await settings(page);
    assert.equal(await page.locator('input[name="app-profile"]:checked').inputValue(),'car-cinema');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]); await page.close();
    console.log(`PASS profiles migrate, persist and share content layouts ${width}x${height}`);
  }
  for(const side of ['left','right']) {
    const {page,errors}=await setup({width:1422,height:456,initial:{appProfile:'car-cinema',playerSide:side},remote:null});
    const measure=()=>page.evaluate(()=>[...document.querySelectorAll('#app-rail,#passenger-rail')].filter(el=>getComputedStyle(el).display!=='none').map(el=>{
      const r=el.getBoundingClientRect(), buttons=[...el.querySelectorAll('button')].map(b=>b.getBoundingClientRect());
      return {top:r.top,height:r.height,above:buttons[0].top-r.top,below:r.bottom-buttons.at(-1).bottom,buttons:buttons.map(b=>({top:b.top,bottom:b.bottom,height:b.height}))};
    }));
    const centered=async(top,height)=>{
      const rails=await measure(); assert.equal(rails.length,side==='right'?2:1);
      for(const r of rails){assert.ok(Math.abs(r.top-top)<1);assert.ok(Math.abs(r.height-height)<1);assert.ok(Math.abs(r.above-r.below)<1);assert.ok(r.above>=7 && r.below>=7);for(const b of r.buttons){assert.ok(b.top>=top && b.bottom<=top+height);}}
    };
    await centered(0,456);
    await page.evaluate(()=>{window.realVisualViewport=window.visualViewport;});
    for(const [top,height] of [[110,346],[0,300],[30,190],[0,456]]) {
      await page.evaluate(({top,height})=>{
        Object.defineProperty(window,'visualViewport',{configurable:true,value:{offsetTop:top,height,scale:1}});
        window.realVisualViewport.dispatchEvent(new Event('scroll'));
      },{top,height});
      await centered(top,height);
    }
    await page.evaluate(()=>{Object.defineProperty(window,'visualViewport',{configurable:true,value:window.realVisualViewport});document.dispatchEvent(new Event('fullscreenchange'));});
    await centered(0,456);
    await page.setViewportSize({width:1280,height:280});
    await page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--car-rail-height')==='280px'); await centered(0,280);
    await page.setViewportSize({width:1422,height:456});
    await page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--car-rail-height')==='456px'); await centered(0,456);
    await settings(page);
    assert.equal(await page.locator('.car-cinema-dot').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 101, 52)');
    assert.equal(await page.locator('.yellow-dot').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 208, 71)');
    await page.locator('label:has(input[name="app-profile"][value="yellow"])').click();
    assert.ok(await page.locator('#app-rail').evaluate(el=>parseFloat(getComputedStyle(el).paddingTop)>50));
    assert.deepEqual(errors,[]); await page.close();
    console.log(`PASS Car Cinema centered rails, viewport transitions and profile colors (${side})`);
  }
  for(const [width,height] of [[390,844],[1422,456]]) {
    const {page,errors,requests}=await setup({width,height});
    await page.waitForFunction(()=>!document.querySelector('#backup-banner').hidden).catch(async e=>{console.log(errors,requests,await page.locator('#backup-status').textContent());throw e;});
    await page.locator('#backup-banner-open').click();
    await page.locator('#backup-restore').click();
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:process.env.SCREENSHOT_DIR+'/bmwtube-backup-'+width+'.png'});
    await page.locator('#backup-confirm-restore').click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('bmwtube.playlists')||'[]').length===1);
    await page.waitForFunction(()=>document.querySelector('#settings').open && document.querySelector('#backup-status').textContent.includes('Đã áp dụng'));
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bmwtube.playlists'))[0].name),'Nhạc Việt 🎵');
    assert.ok(requests.every(r=>!r.headers.authorization));
    await page.locator('#backup-undo').click();await page.locator('#backup-undo-apply').click();
    await page.waitForFunction(()=>localStorage.getItem('bmwtube.playlists')===null);
    await page.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('Đã áp dụng'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);await page.close();
    console.log(`PASS restore/undo/public discovery ${width}x${height}`);
  }
  {
    const {page,state,errors}=await setup({initial:{key:'local-api-key',telex:true},remote:null});
    await settings(page);
    await page.locator('#backup-password').fill('test password long');
    await page.locator('#backup-token').fill('test-token');await page.locator('#backup-save').click();
    await page.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('Đã sao lưu thành công'));
    assert.equal(state.remote.data.telex,true);assert.ok(!JSON.stringify(state.remote).includes('local-api-key'));assert.ok(!JSON.stringify(state.remote).includes('test-token'));
    assert.equal(await page.evaluate(()=>localStorage.getItem('bmwtube.backup.token')),null);
    state.sha='external';state.remote=sample();
    await page.locator('#backup-save').click();await page.locator('#backup-replace').waitFor({state:'visible'});
    assert.equal(state.sha,'external');
    await page.locator('#backup-replace').click();
    await page.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('Đã sao lưu thành công'));
    assert.equal(state.sha,'externalx');assert.equal(state.remote.data.telex,true);
    await page.locator('#backup-remember').check();
    assert.equal(await page.evaluate(()=>localStorage.getItem('bmwtube.backup.token')),'test-token');
    await page.locator('#backup-forget').click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('bmwtube.backup.token')),null);
    assert.equal(await page.locator('#backup-token').inputValue(),'');
    state.remote=sample();state.sha='latest';
    await page.locator('#backup-check').click();
    await page.waitForFunction(()=>document.querySelector('#backup-summary').textContent.includes('1 playlist'));
    await page.locator('#backup-restore').click();await page.locator('#backup-confirm-restore').click();
    await page.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('Đã áp dụng'));
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bmwtube.key'))),'local-api-key');
    assert.deepEqual(errors,[]);await page.close();console.log('PASS first save, credentials excluded, conflict and preserved API key');
  }
  {
    const source = await setup({initial:{key:'portable-api-key'},remote:null});
    await settings(source.page);
    await source.page.locator('#backup-token').fill('test-token');
    await source.page.locator('#backup-save').click();
    await source.page.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('Nhập mật khẩu'));
    assert.equal(source.state.remote,null);
    await source.page.locator('#backup-password').fill('transfer password 123');
    await source.page.locator('#backup-save').click();
    await source.page.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('Đã sao lưu thành công'));
    assert.ok(source.state.remote.youtubeKey);
    const target = await setup({remote:source.state.remote});
    await settings(target.page);
    await target.page.locator('#backup-check').click();
    await target.page.waitForFunction(()=>document.querySelector('#backup-summary').textContent.includes('đã mã hóa'));
    await target.page.locator('#backup-password').fill('incorrect password');
    await target.page.locator('#backup-restore').click();
    await target.page.locator('#backup-confirm-restore').click();
    await target.page.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('Mật khẩu không đúng'));
    assert.equal(await target.page.evaluate(()=>localStorage.getItem('bmwtube.key')),null);
    assert.equal(await target.page.evaluate(()=>localStorage.getItem('bmwtube.backup.undo')),null);
    await target.page.locator('#backup-password').fill('transfer password 123');
    await target.page.locator('#backup-confirm-restore').click();
    await target.page.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('Đã áp dụng'));
    assert.equal(await target.page.locator('#api-key').inputValue(),'portable-api-key');
    assert.equal(await target.page.locator('#backup-password').inputValue(),'');
    await target.page.locator('#backup-undo').click();
    await target.page.locator('#backup-undo-apply').click();
    await target.page.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('Đã áp dụng'));
    assert.equal(await target.page.evaluate(()=>localStorage.getItem('bmwtube.key')),null);
    assert.deepEqual(source.errors,[]); assert.deepEqual(target.errors,[]);
    await source.page.close(); await target.page.close();
    console.log('PASS encrypted API key transfer, wrong password and undo');
  }
  {
    const {page,state,errors}=await setup({initial:{telex:true}});await settings(page);
    state.remote.version=99;
    await page.locator('#backup-check').click();await page.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('không hợp lệ'));
    assert.equal(await page.locator('#backup-preview').isVisible(),false);
    state.fail=true;await page.locator('#backup-token').fill('bad-token');await page.locator('#backup-save').click();
    await page.waitForFunction(()=>document.querySelector('#backup-status').textContent.includes('Token sai'));
    assert.equal(await page.evaluate(()=>localStorage.getItem('bmwtube.telex')),'true');
    assert.deepEqual(errors,[]);await page.close();console.log('PASS malformed backup and authentication errors preserve local data');
  }
} finally {await browser.close();}
