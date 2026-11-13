import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoiceSearch} from '../dist/voice-search.js';

function setup(options={}){
  const instances=[],states=[],texts=[],searches=[];
  class Recognition{
    constructor(){instances.push(this);}
    start(){if(options.fail)throw Error('denied');}
    abort(){this.aborted=true;this.onend?.();}
    result(text,final=true){this.onresult({results:[Object.assign([{transcript:text}],{isFinal:final})]});}
  }
  const voice=createVoiceSearch({Recognition,onState:(...s)=>states.push(s),onText:t=>texts.push(t),onSearch:t=>searches.push(t),...options});
  return {voice,instances,states,texts,searches};
}
test('Vietnamese final result searches once; interim and late results never submit',()=>{
  const s=setup();s.voice.start();const r=s.instances[0];assert.equal(r.lang,'vi-VN');
  r.result('nhạc',false);assert.deepEqual(s.searches,[]);
  r.result('nhạc Trịnh');r.result('late');assert.deepEqual(s.searches,['nhạc Trịnh']);assert.equal(r.aborted,true);
});
test('cancel and second tap abort; stale session cannot affect a new session',()=>{
  const s=setup();s.voice.start();const old=s.instances[0];s.voice.start();s.voice.start();
  old.result('old');old.onerror({error:'network'});assert.deepEqual(s.searches,[]);
  s.instances[1].result('mới');assert.deepEqual(s.searches,['mới']);
});
test('unsupported, insecure and start failures leave microphone inactive',()=>{
  for(const options of [{Recognition:undefined},{secure:false},{fail:true}]){
    const s=setup(options);s.voice.start();assert.equal(s.states.at(-1)[0],false);assert.deepEqual(s.searches,[]);
  }
});
test('permission, network and empty speech errors allow retry without searching',()=>{
  for(const error of ['not-allowed','network','no-speech','audio-capture']){
    const s=setup();s.voice.start();s.instances[0].onerror({error});
    assert.equal(s.states.at(-1)[0],false);assert.deepEqual(s.searches,[]);
    s.voice.start();s.instances[1].result('thử lại');assert.deepEqual(s.searches,['thử lại']);
  }
});
test('end without a final transcript does not submit interim text',()=>{
  const s=setup();s.voice.start();s.instances[0].result('partial',false);s.instances[0].onend();
  assert.deepEqual(s.searches,[]);assert.equal(s.states.at(-1)[0],false);
});
test('listening begins only on start event; cancelled sessions cannot restart feedback',()=>{
  const s=setup();s.voice.start();const old=s.instances[0];
  assert.equal(s.states.at(-1)[2],'starting');
  old.onstart();assert.equal(s.states.at(-1)[2],'listening');
  s.voice.cancel();const count=s.states.length;old.onstart();assert.equal(s.states.length,count);
  s.voice.start();old.onstart();assert.equal(s.states.at(-1)[2],'starting');
  s.instances[1].onstart();assert.equal(s.states.at(-1)[2],'listening');
  s.voice.cancel();assert.equal(s.states.at(-1)[0],false);
});
test('timeout clears feedback and rejects a delayed start event',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const s=setup();s.voice.start();t.mock.timers.tick(15000);
  assert.equal(s.states.at(-1)[0],false);assert.equal(s.instances[0].aborted,true);
  const count=s.states.length;s.instances[0].onstart();assert.equal(s.states.length,count);
});
function streamFixture(){
  const track={readyState:'live',stop(){this.readyState='ended';}};
  return {track,stream:{getTracks:()=>[track],getAudioTracks:()=>[track]}};
}
test('permission recovery runs on next tap, releases capture and waits for a new gesture',async()=>{
  const {track,stream}=streamFixture();let calls=0;
  const s=setup({requestMicrophone:async constraints=>{assert.deepEqual(constraints,{audio:true,video:false});calls++;return stream;}});
  s.voice.start();assert.equal(calls,0);s.instances[0].onerror({error:'not-allowed'});
  await s.voice.start();assert.equal(calls,1);assert.equal(track.readyState,'ended');
  assert.equal(s.instances.length,1);assert.match(s.states.at(-1)[1],/Chạm micro lần nữa/);
  s.voice.start();assert.equal(s.instances.length,2);
  s.instances[1].onerror({error:'service-not-allowed'});
  assert.match(s.states.at(-1)[1],/Đã mở được micro nhưng/);
});
test('permission granted after cancellation releases tracks without changing UI or searching',async()=>{
  let resolve;const {stream,track}=streamFixture();
  const s=setup({requestMicrophone:()=>new Promise(r=>{resolve=r;})});
  s.voice.start();s.instances[0].onerror({error:'not-allowed'});
  const pending=s.voice.start();s.voice.cancel();const count=s.states.length;
  resolve(stream);await pending;
  assert.equal(track.readyState,'ended');assert.equal(s.states.length,count);assert.deepEqual(s.searches,[]);
});
test('permission timeout ignores late grants and still releases tracks',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let resolve;const {stream,track}=streamFixture();
  const s=setup({requestMicrophone:()=>new Promise(r=>{resolve=r;})});
  s.voice.start();s.instances[0].onerror({error:'not-allowed'});
  const pending=s.voice.start();t.mock.timers.tick(15000);const count=s.states.length;
  assert.equal(s.states.at(-1)[0],false);resolve(stream);await pending;
  assert.equal(s.states.length,count);assert.equal(track.readyState,'ended');
});
test('capture errors identify blocked access, missing and busy microphones',async()=>{
  for(const name of ['NotAllowedError','SecurityError','NotFoundError','NotReadableError']){
    const s=setup({requestMicrophone:async()=>{throw Object.assign(Error(),{name});}});
    s.voice.start();s.instances[0].onerror({error:'not-allowed'});await s.voice.start();
    assert.ok(s.states.at(-1)[1].includes(name));assert.equal(s.states.at(-1)[0],false);
    assert.deepEqual(s.searches,[]);
  }
});
