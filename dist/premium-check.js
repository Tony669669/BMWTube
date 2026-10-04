import {videoId} from './core.js?v=review-fixes';
const $=id=>document.getElementById(id);
const params=new URL(location.href).searchParams;
let selected=videoId(params.get('v')),position=seconds(params.get('t')),player=null,ready=false;
function seconds(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.floor(n)):0;}
function status(text){$('status').textContent=text;}
try{if(JSON.parse(localStorage.getItem('bmwtube.playerSide'))==='right')document.body.classList.add('passenger');}catch{}
function save(){
  if(ready){try{position=seconds(player.getCurrentTime());}catch{}}
  const url=new URL(location.href),back=new URL('./',location.href);
  for(const target of [url,back]){if(selected){target.searchParams.set('v',selected);target.searchParams.set('t',String(position));}else{target.searchParams.delete('v');target.searchParams.delete('t');}}
  history.replaceState(null,'',url);$('return').href=back.href;
}
function start(){
  if(!selected)return;
  if(!window.YT?.Player){status('Đang tải player YouTube…');return;}
  if(player){if(ready)player.cueVideoById({videoId:selected,startSeconds:position});return;}
  status('Đang mở video…');
  player=new YT.Player('player',{width:'100%',height:'100%',videoId:selected,playerVars:{start:position,controls:1,playsinline:1,origin:location.origin,autoplay:0},events:{
    onReady:event=>{ready=true;event.target.cueVideoById({videoId:selected,startSeconds:position});status('Player sẵn sàng. Chạm Phát trong video. Premium chưa được xác minh.');},
    onStateChange:event=>{if(event.data===1)status('Đang phát trong BMWTube. Trạng thái phát không xác nhận Premium.');},
    onError:event=>{const errors={2:'Link video không hợp lệ',5:'Không phát được định dạng này',100:'Video không có sẵn',101:'Video không cho phép nhúng',150:'Video không cho phép nhúng',153:'Thiếu thông tin nguồn gửi tới YouTube'};status(`Lỗi ${event.data}: ${errors[event.data]||'YouTube không phát được video'}. Thử video khác hoặc tải lại player.`);}
  }});
}
$('video-form').onsubmit=event=>{event.preventDefault();const id=videoId($('video-url').value);if(!id){status('Hãy dán link YouTube hợp lệ.');return;}selected=id;position=0;if(ready)player.cueVideoById({videoId:selected,startSeconds:0});else start();const url=new URL(location.href);url.searchParams.set('v',selected);url.searchParams.set('t','0');history.replaceState(null,'',url);};
$('login').onclick=()=>{save();try{sessionStorage.setItem('bmwtube.checkLoginPending','1');}catch{}};
$('reload').onclick=()=>{save();location.reload();};
$('return').onclick=save;
window.addEventListener('pageshow',event=>{let pending=false;try{pending=sessionStorage.getItem('bmwtube.checkLoginPending')==='1';sessionStorage.removeItem('bmwtube.checkLoginPending');}catch{}if(pending&&event.persisted)location.reload();});
$('device').textContent=`Vùng hiển thị: ${innerWidth} × ${innerHeight} CSS px · DPR ${devicePixelRatio} · ${navigator.userAgent}`;
if(selected)$('video-url').value='https://www.youtube.com/watch?v='+selected;
save();
const timeout=setTimeout(()=>{if(!window.YT?.Player)status('Chưa tải được YouTube. Kiểm tra mạng rồi bấm Tải lại player.');},15000);
window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);start();};
const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{clearTimeout(timeout);status('Không tải được YouTube. Kiểm tra mạng rồi thử lại.');};document.head.append(script);
