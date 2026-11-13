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
