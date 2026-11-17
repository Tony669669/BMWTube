import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS, makeBackup, parseBackup, readData, restoreBackup, undoRestore, GitHubBackup, encodeContent, MAX_BYTES} from '../dist/backup.js';
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k, String(v)), removeItem: k => values.delete(k), values};
}
const video = {id:'M7lc1UVf-VE',title:'Tiếng Việt 🎵',position:42,duration:200,updatedAt:1234};
const sample = () => ({app:'BMWTube',version:1,createdAt:'2026-11-06T00:00:00.000Z',data:{...structuredClone(DEFAULTS),playlists:[{id:'p1',name:'Nhạc đi xe',videos:[{...video}]}],continueWatching:[{...video}]}});
test('portable backup retains Unicode, order, progress and settings, strips unknown fields and credentials', async () => {
  const data = sample(); data.data.key='secret';data.data.token='secret';data.data.playlists[0].videos[0].token='secret';
  const parsed = parseBackup(JSON.stringify(data));
  assert.equal(parsed.data.playlists[0].videos[0].title, 'Tiếng Việt 🎵');
  assert.equal(parsed.data.continueWatching[0].updatedAt,1234);
  assert.ok(!JSON.stringify(parsed).includes('secret'));
  const s = storage({'bmwtube.key':'"secret"','bmwtube.backup.token':'secret','other':'secret'});
  assert.ok(!JSON.stringify(await makeBackup(s, 'test password long')).includes('secret'));
});
test('reject malformed, future, oversized or truncated data before restore', () => {
  for(const mutate of [b=>b.version=99,b=>b.data.playlists[0].videos[0].id='bad',b=>b.data.telex='yes',b=>delete b.data.searches,b=>b.data.recent=Array(21).fill(video),b=>b.data.playlists.push(b.data.playlists[0])]) {
    const b=sample();mutate(b);assert.throws(()=>parseBackup(JSON.stringify(b)));
  }
  assert.throws(()=>parseBackup(' '.repeat(MAX_BYTES+1)));
  assert.throws(()=>parseBackup('{'));
});
test('restore preserves secrets and undo restores exact prior keys including absent values', async () => {
  const s=storage({'bmwtube.key':'"api"','bmwtube.backup.token':'token','bmwtube.telex':'true','unrelated':'kept'});
  const before=Object.fromEntries(s.values);
  await restoreBackup(s,sample(),'sha');
  assert.equal(s.getItem('bmwtube.key'),'"api"'); assert.equal(s.getItem('bmwtube.backup.token'),'token');
  assert.deepEqual(readData(s),parseBackup(JSON.stringify(sample())).data);
  undoRestore(s);assert.deepEqual(Object.fromEntries(s.values),before);
});
test('partial storage failure rolls back restored data and previous undo', async () => {
  const s=storage({'bmwtube.telex':'true','bmwtube.backup.undo':'old'}), original=s.setItem;
  const before=Object.fromEntries(s.values); let writes=0;
  s.setItem=(k,v)=>{if(++writes===5)throw Error('quota');return original(k,v);};
  await assert.rejects(restoreBackup(s,sample(),'sha'),/bộ nhớ/);
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

const password = 'mật khẩu chuyển máy 123';
test('encrypted key transfers, uses fresh randomness and undo restores absent or existing key', async () => {
  const source = storage({'bmwtube.key':JSON.stringify('youtube-secret'), 'bmwtube.backup.token':'private-token'});
  const backup = await makeBackup(source, password), second = await makeBackup(source, password);
  assert.notEqual(backup.youtubeKey.salt, second.youtubeKey.salt);
  assert.notEqual(backup.youtubeKey.iv, second.youtubeKey.iv);
  assert.ok(!JSON.stringify(backup).includes('youtube-secret'));
  assert.ok(!JSON.stringify(backup).includes('private-token'));
  assert.ok(!JSON.stringify(backup).includes(password));
  for(const initial of [{}, {'bmwtube.key':'"previous-key"'}]) {
    const target = storage(initial), before = Object.fromEntries(target.values);
    await restoreBackup(target, parseBackup(JSON.stringify(backup)), 'sha', password);
    assert.equal(target.getItem('bmwtube.key'),'"youtube-secret"');
    undoRestore(target);
    assert.deepEqual(Object.fromEntries(target.values), before);
  }
});
test('missing/wrong password and tampering never change local data', async () => {
  const source = storage({'bmwtube.key':'"youtube-secret"'});
  await assert.rejects(makeBackup(source), /mật khẩu/);
  await assert.rejects(makeBackup(source, 'short'), /6/);
  const backup = await makeBackup(source, password);
  const target = storage({'bmwtube.key':'"previous"', 'bmwtube.backup.undo':'old'});
  const before = Object.fromEntries(target.values);
  for(const attempt of ['', 'wrong password']) {
    await assert.rejects(restoreBackup(target, backup, 'sha', attempt));
    assert.deepEqual(Object.fromEntries(target.values), before);
  }
  const tampered = structuredClone(backup);
  const bytes = Buffer.from(tampered.youtubeKey.ciphertext, 'base64'); bytes[0] ^= 1;
  tampered.youtubeKey.ciphertext = bytes.toString('base64');
  await assert.rejects(restoreBackup(target, tampered, 'sha', password), /Mật khẩu/);
  assert.deepEqual(Object.fromEntries(target.values), before);
  for(const patch of [{iterations:1}, {iv:'bad'}, {salt:'bad'}, {algorithm:'unknown'}, {ciphertext:'bad'}]) {
    const bad = structuredClone(backup); Object.assign(bad.youtubeKey, patch);
    assert.throws(()=>parseBackup(JSON.stringify(bad)));
  }
});
test('encrypted restore rolls back key on storage failure and supports legacy undo', async () => {
  const backup = await makeBackup(storage({'bmwtube.key':'"new-key"'}), password);
  const target = storage({'bmwtube.key':'"old-key"', 'bmwtube.backup.undo':'old'}), original = target.setItem;
  const before = Object.fromEntries(target.values);
  let failed = false;
  target.setItem = (k,v) => {if(k==='bmwtube.backup.base' && !failed){failed=true;throw Error('quota');} original(k,v);};
  await assert.rejects(restoreBackup(target, backup, 'sha', password), /bộ nhớ/);
  assert.deepEqual(Object.fromEntries(target.values), before);
  await restoreBackup(target, sample(), 'sha');
  const undo = JSON.parse(target.getItem('bmwtube.backup.undo')); delete undo['bmwtube.key'];
  target.setItem('bmwtube.backup.undo', JSON.stringify(undo));
  undoRestore(target); assert.equal(target.getItem('bmwtube.key'), '"old-key"');
});

test('six-character password is accepted and restores the key', async () => {
  const source = storage({'bmwtube.key':'"youtube-secret"'}), target = storage();
  const backup = await makeBackup(source, 'abc123');
  await restoreBackup(target, backup, 'sha', 'abc123');
  assert.equal(target.getItem('bmwtube.key'), '"youtube-secret"');
});

test('profiles retain Car Cinema and migrate legacy red backups to yellow', async () => {
  assert.equal(DEFAULTS.appProfile, 'yellow');
  for(const version of [1, 2]) {
    const legacy = sample(); legacy.version = version; legacy.data.appProfile = 'red';
    assert.equal(parseBackup(JSON.stringify(legacy)).data.appProfile, 'yellow');
    const target = storage(); await restoreBackup(target, legacy, 'sha');
    assert.equal(target.getItem('bmwtube.appProfile'), '"yellow"');
  }
  const source = storage({'bmwtube.appProfile':'"car-cinema"'});
  const backup = await makeBackup(source), target = storage();
  await restoreBackup(target, parseBackup(JSON.stringify(backup)), 'sha');
  assert.equal(target.getItem('bmwtube.appProfile'), '"car-cinema"');
  assert.equal(readData(storage({'bmwtube.appProfile':'"red"'})).appProfile, 'yellow');
  const bad = sample(); bad.data.appProfile = 'unknown';
  assert.throws(()=>parseBackup(JSON.stringify(bad)));
});
