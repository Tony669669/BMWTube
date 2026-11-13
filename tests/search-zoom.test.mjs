import test from 'node:test';
import assert from 'node:assert/strict';
import {createSearchZoomRecovery} from '../dist/search-zoom.js';
function fixture(){
  const meta={content:'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'};
  const win={visualViewport:{scale:1,height:456}};
  const doc={documentElement:{clientWidth:1422},activeElement:{matches:()=>false},querySelector:s=>s.startsWith('meta')?meta:{open:false}};
  const recovery=createSearchZoomRecovery(win,doc);
  const original=meta.content;
  return {win,doc,meta,recovery,original};
}
test('recovery waits for keyboard dismissal, clamps once, then restores viewport',t=>{
  t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.recovery.capture();
  f.win.visualViewport={scale:2,height:100};f.recovery.recover();t.mock.timers.tick(200);assert.equal(f.meta.content,f.original);
  f.win.visualViewport.height=228;t.mock.timers.tick(100);assert.equal(f.meta.content,f.original);
  t.mock.timers.tick(100);assert.match(f.meta.content,/minimum-scale=1/);
  t.mock.timers.tick(200);assert.equal(f.meta.content,f.original);
});
test('no zoom, orientation changes and another focused input skip recovery',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  for(const mode of ['unchanged','orientation','input']){
    const f=fixture();f.recovery.capture();
    if(mode!=='unchanged')f.win.visualViewport={scale:2,height:228};
    if(mode==='orientation')f.doc.documentElement.clientWidth=456;
    if(mode==='input')f.doc.activeElement.matches=()=>true;
    f.recovery.recover();t.mock.timers.tick(2000);assert.equal(f.meta.content,f.original);
  }
});
test('reopening cancels pending recovery and cancellation restores active clamp',t=>{
  t.mock.timers.enable({apis:['setTimeout']});const f=fixture();f.recovery.capture();
  f.win.visualViewport={scale:2,height:228};f.recovery.recover();f.recovery.capture();
  t.mock.timers.tick(2000);assert.equal(f.meta.content,f.original);
  f.win.visualViewport={scale:1,height:456};f.recovery.capture();f.win.visualViewport={scale:2,height:228};
  f.recovery.recover();t.mock.timers.tick(200);t.mock.timers.tick(100);assert.match(f.meta.content,/minimum-scale=1/);
  f.recovery.cancel();assert.equal(f.meta.content,f.original);
});
