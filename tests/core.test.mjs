import test from 'node:test';
import assert from 'node:assert/strict';
import {telex,videoId,timeLabel,playerSize} from '../dist/core.js';
test('Vietnamese Telex handles tone, shapes, capitals and syllables',()=>{
  for(const [raw,expected] of [['tieengs Vieejt','tiếng Việt'],['ddawng nhaapj','đăng nhập'],['truowngf','trường'],['phowr','phở'],['nghieeng','nghiêng'],['quas','quá'],['duowng','dương'],['ass','as'],['DDawng','Đăng'],['Tiếng Việt','Tiếng Việt']])assert.equal(telex(raw),expected,raw);
});
test('URLs stay intact with Telex enabled',()=>assert.equal(telex('https://www.youtube.com/watch?v=M7lc1UVf-VE'),'https://www.youtube.com/watch?v=M7lc1UVf-VE'));
test('Only recognized YouTube URL formats and exact IDs are accepted',()=>{
  for(const url of ['M7lc1UVf-VE','https://youtu.be/M7lc1UVf-VE?t=4','https://www.youtube.com/watch?v=M7lc1UVf-VE','https://m.youtube.com/shorts/M7lc1UVf-VE','youtube.com/live/M7lc1UVf-VE'])assert.equal(videoId(url),'M7lc1UVf-VE');
  for(const url of ['https://evil.com/watch?v=M7lc1UVf-VE','https://youtube.com.evil.com/watch?v=M7lc1UVf-VE','javascript:alert(1)','https://youtu.be/short','https://youtube.com/playlist?list=xxx','ftp://youtube.com/watch?v=M7lc1UVf-VE'])assert.equal(videoId(url),null);
});
test('Progress time handles empty, negative and long durations',()=>{assert.equal(timeLabel(0),'0:00');assert.equal(timeLabel(-4),'0:00');assert.equal(timeLabel(3661),'1:01:01');});
test('Malformed persisted video IDs and non-finite times are handled safely',()=>{
  for(const value of [null,undefined,42,{},[]])assert.equal(videoId(value),null);
  for(const value of [Infinity,-Infinity,NaN])assert.equal(timeLabel(value),'0:00');
});
test('BMW viewport uses full height with the navigation rail outside the player',()=>{
  const width=playerSize(1422-72,456,true);
  assert.equal(width,456*16/9);
  assert.ok(1422-72-width>=240);
});
test('Ultrawide player fits height and leaves space at right',()=>{
  for(const [width,height] of [[1280,480],[1920,720]]){const w=playerSize(width,height-72);assert.ok(w<=width-260);assert.ok(w*9/16+132<=height-72);const full=playerSize(width,height,true);assert.ok(full<width);assert.ok(full*9/16<=height);}
});
