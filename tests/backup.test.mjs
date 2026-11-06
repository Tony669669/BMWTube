import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS, makeBackup, parseBackup, readData, restoreBackup, undoRestore, GitHubBackup, encodeContent, MAX_BYTES} from '../dist/backup.js';
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k, String(v)), removeItem: k => values.delete(k), values};
}
const video = {id:'M7lc1UVf-VE',title:'Tiếng Việt 🎵',position:42,duration:200,updatedAt:1234};
const sample = () => ({app:'BMWTube',version:1,createdAt:'2026-11-06T00:00:00.000Z',data:{...structuredClone(DEFAULTS),playlists:[{id:'p1',name:'Nhạc đi xe',videos:[{...video}]}],continueWatching:[{...video}]}});
test('portable backup retains Unicode, order, progress and settings, strips unknown fields and credentials', () => {
  const data = sample(); data.data.key='secret';data.data.token='secret';data.data.playlists[0].videos[0].token='secret';
  const parsed = parseBackup(JSON.stringify(data));
  assert.equal(parsed.data.playlists[0].videos[0].title, 'Tiếng Việt 🎵');
  assert.equal(parsed.data.continueWatching[0].updatedAt,1234);
  assert.ok(!JSON.stringify(parsed).includes('secret'));
  const s = storage({'bmwtube.key':'"secret"','bmwtube.backup.token':'secret','other':'secret'});
  assert.ok(!JSON.stringify(makeBackup(s)).includes('secret'));
});
test('reject malformed, future, oversized or truncated data before restore', () => {
  for(const mutate of [b=>b.version=2,b=>b.data.playlists[0].videos[0].id='bad',b=>b.data.telex='yes',b=>delete b.data.searches,b=>b.data.recent=Array(21).fill(video),b=>b.data.playlists.push(b.data.playlists[0])]) {
    const b=sample();mutate(b);assert.throws(()=>parseBackup(JSON.stringify(b)));
  }
  assert.throws(()=>parseBackup(' '.repeat(MAX_BYTES+1)));
  assert.throws(()=>parseBackup('{'));
});
test('restore preserves secrets and undo restores exact prior keys including absent values', () => {
  const s=storage({'bmwtube.key':'"api"','bmwtube.backup.token':'token','bmwtube.telex':'true','unrelated':'kept'});
  const before=Object.fromEntries(s.values);
  restoreBackup(s,sample(),'sha');
  assert.equal(s.getItem('bmwtube.key'),'"api"'); assert.equal(s.getItem('bmwtube.backup.token'),'token');
  assert.deepEqual(readData(s),parseBackup(JSON.stringify(sample())).data);
  undoRestore(s);assert.deepEqual(Object.fromEntries(s.values),before);
});
test('partial storage failure rolls back restored data and previous undo', () => {
  const s=storage({'bmwtube.telex':'true','bmwtube.backup.undo':'old'}), original=s.setItem;
  const before=Object.fromEntries(s.values); let writes=0;
  s.setItem=(k,v)=>{if(++writes===5)throw Error('quota');return original(k,v);};
  assert.throws(()=>restoreBackup(s,sample(),'sha'),/bộ nhớ/);
  assert.deepEqual(Object.fromEntries(s.values),before);
});
test('public discovery sends no authorization, decodes Unicode backup', async () => {
  const api=new GitHubBackup(async(url,opts)=>{
    assert.ok(url.includes('ref=bmwtube-backups'));assert.equal(opts.headers.Authorization,undefined);
    return {ok:true,json:async()=>({type:'file',encoding:'base64',size:1000,sha:'old',content:encodeContent(JSON.stringify(sample()))})};
  });
  assert.equal((await api.read()).backup.data.playlists[0].name,'Nhạc đi xe');
});
test('write detects remote conflicts without mutating GitHub', async () => {
  let writes=0;const api=new GitHubBackup();api.read=async()=>({sha:'new',backup:sample()});api.ensureBranch=async()=>writes++;
  await assert.rejects(api.write(sample(),'token','old'),e=>e.conflict && e.latest.sha==='new');assert.equal(writes,0);
});
test('first save creates backup branch then writes only on that branch with sanitized content', async () => {
  const calls=[];const api=new GitHubBackup(async(url,opts)=>{
    calls.push({url,...opts});
    if(url.includes('/contents/')&&opts.method==='GET')return {status:404};
    if(url.endsWith('/git/ref/heads/bmwtube-backups'))return {status:404};
    if(url.endsWith('/git/ref/heads/main'))return {ok:true,json:async()=>({object:{sha:'mainsha'}})};
    return {ok:true,json:async()=>({content:{sha:'saved'}})};
  });
  assert.equal(await api.write(sample(),'token',null),'saved');
  const posts=calls.filter(c=>c.method==='POST');assert.equal(JSON.parse(posts[0].body).ref,'refs/heads/bmwtube-backups');
  const put=calls.find(c=>c.method==='PUT'), body=JSON.parse(put.body);
  assert.equal(body.branch,'bmwtube-backups');assert.equal(body.sha,undefined);
  assert.equal(put.headers.Authorization,'Bearer token');
  assert.equal(parseBackup(Buffer.from(body.content,'base64').toString()).data.playlists.length,1);
});
test('GitHub errors surface without revealing credentials', async () => {
  for(const code of [401,403,404,409,422,429,500]) {
    const api=new GitHubBackup(async()=>({status:code,ok:false}));
    await assert.rejects(api.request('/test',{token:'private-token'}), e=>!e.message.includes('private-token'));
  }
});
