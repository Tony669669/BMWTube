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
    if(u.origin==='http://bmwtube.test') {
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
  await page.goto('http://bmwtube.test');
  return {page,state,errors,requests};
}
async function settings(page) {
  await page.locator('#open-library').click();
  await page.locator('#library-settings').click();
}
try {
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
