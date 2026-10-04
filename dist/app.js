import {telex,videoId,timeLabel,playerSize} from './core.js';
const $=id=>document.getElementById(id);
const storage={get(key,fallback){try{return JSON.parse(localStorage.getItem('bmwtube.'+key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem('bmwtube.'+key,JSON.stringify(value));}catch{notice('Trình duyệt không cho lưu dữ liệu. Cài đặt chỉ dùng trong phiên này.');}}};
let key=storage.get('key',''),recent=storage.get('recent',[]),history=storage.get('searches',[]),telexOn=storage.get('telex',false);
if(!Array.isArray(recent))recent=[];recent=recent.filter(v=>v&&videoId(v.id)&&typeof v.title==='string').slice(0,20);
if(!Array.isArray(history))history=[];history=history.filter(v=>typeof v==='string').slice(0,8);
let appendAllowed=true;
let captionsWanted=null,captionsTimer=null;
let items=[],current=null,player=null,playerReady=false,apiPromise=null,query='',nextPage='',requestSerial=0,composing=false,rawInput='',cinema=false,seeking=false,returnFocus=null,controlsTimer=null;
function notice(message){$('notice-text').textContent=message;$('notice').hidden=false;}
$('dismiss').onclick=()=>{$('notice').hidden=true;};
function updateTelex(){$('telex').setAttribute('aria-pressed',String(telexOn));$('telex').textContent=telexOn?'Telex ✓':'Telex';}
updateTelex();$('telex').onclick=()=>{telexOn=!telexOn;rawInput=$('query').value;storage.set('telex',telexOn);updateTelex();$('query').focus();};
$('query').addEventListener('compositionstart',()=>{composing=true;});
$('query').addEventListener('compositionend',()=>{composing=false;rawInput=$('query').value;});
$('query').addEventListener('beforeinput',()=>{const input=$('query');appendAllowed=input.selectionStart===input.selectionEnd&&input.selectionEnd===input.value.length;});
$('query').addEventListener('input',event=>{
  const input=$('query');if(composing||event.isComposing)return;
  if(telexOn&&appendAllowed&&event.inputType==='insertText'&&event.data&&input.selectionStart===input.value.length){rawInput+=event.data;input.value=telex(rawInput);}
  else rawInput=input.value;
});
$('query').addEventListener('keydown',event=>{if(event.key==='Enter'&&(composing||event.isComposing||event.keyCode===229))event.preventDefault();});
function decode(value){const text=document.createElement('textarea');text.innerHTML=value||'';return text.value;}
function card(v){const button=document.createElement('button');button.className='card';const img=document.createElement('img');img.src=`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;img.loading='lazy';img.alt='';const title=document.createElement('h3');title.textContent=v.title;const channel=document.createElement('p');channel.textContent=v.channel||'YouTube';button.append(img,title,channel);button.onclick=()=>watch(v);return button;}
function renderCards(target,list){target.replaceChildren(...list.map(card));}
function renderHistory(){const container=$('recent-searches');container.replaceChildren();history.forEach(term=>{const b=document.createElement('button');b.textContent=term;b.onclick=()=>{$('query').value=term;rawInput=term;submit(term);};container.append(b);});}
function browsing(){cinema=false;document.body.classList.remove('cinema');if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});$('watch').hidden=true;$('browse').hidden=false;if(playerReady)player.pauseVideo();resize();}
function home(){
  requestSerial++;document.body.classList.add('home-feed');document.body.classList.remove('search-feed');browsing();query='';nextPage='';items=[];
  $('query').value='';rawInput='';$('load-more').hidden=true;
  $('browse-title').textContent='Khám phá trên YouTube';
  renderCards($('results'),[]);renderHistory();$('welcome').hidden=true;
  if(key)popular();else renderHomeFallback();
}
function renderHomeFallback(){
  const box=document.createElement('div');box.className='empty';
  const p=document.createElement('p');p.textContent='Thêm API key để hiển thị danh sách video.';
  const open=document.createElement('a');open.className='button primary';open.href='https://www.youtube.com/';open.textContent='Mở trang chủ YouTube ↗';
  const setup=document.createElement('button');setup.className='secondary';setup.textContent='Thiết lập API key';setup.onclick=openSettings;
  box.append(p,open,setup);$('results').replaceChildren(box);$('load-more').hidden=true;
}
$('home').onclick=home;$('back').onclick=()=>{requestSerial++;browsing();};$('paste-focus').onclick=()=>$('query').focus();
async function api(endpoint,params){
  if(!navigator.onLine)throw Error('Mất kết nối mạng. Kết nối lại rồi thử lần nữa.');
  const url=new URL('https://www.googleapis.com/youtube/v3/'+endpoint);Object.entries({...params,key}).forEach(([k,v])=>{if(v)url.searchParams.set(k,v);});
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(url,{signal:controller.signal});const json=await response.json();if(!response.ok){const reason=json.error?.errors?.[0]?.reason;throw Error(['quotaExceeded','dailyLimitExceeded'].includes(reason)?'YouTube API đã hết hạn mức. Bạn vẫn có thể mở link hoặc xem trên YouTube.':response.status===400||response.status===403?'Không truy cập được YouTube API. Kiểm tra khóa, giới hạn địa chỉ web và trạng thái API trong Cài đặt.':'YouTube tạm thời không phản hồi. Thử lại sau.');}return json;}catch(error){if(error.name==='AbortError')throw Error('Kết nối YouTube quá lâu. Vui lòng thử lại.');throw error;}finally{clearTimeout(timeout);}
}
function mapped(data){return(data.items||[]).map(v=>({id:typeof v.id==='string'?v.id:v.id.videoId,title:decode(v.snippet?.title),channel:decode(v.snippet?.channelTitle)})).filter(v=>videoId(v.id));}
async function popular(append=false){
  const serial=++requestSerial;$('browse-title').textContent=append?'Khám phá trên YouTube':'Đang tải video công khai…';$('load-more').disabled=true;
  try{
    const data=await api('videos',{part:'snippet,status',chart:'mostPopular',regionCode:'VN',maxResults:16,pageToken:append?nextPage:''});
    if(serial!==requestSerial)return;
    const seen=new Set(append?items.map(v=>v.id):[]);
    const next=mapped({...data,items:(data.items||[]).filter(v=>v.status?.embeddable!==false)}).filter(v=>!seen.has(v.id));
    items=append?[...items,...next]:next;nextPage=data.nextPageToken||'';
    renderCards($('results'),items);$('welcome').hidden=true;$('browse-title').textContent='Khám phá trên YouTube';$('load-more').hidden=!nextPage;
    if(!items.length){const p=document.createElement('p');p.className='empty';p.textContent='Chưa có video công khai để hiển thị. Thử tìm kiếm ở phía trên.';$('results').append(p);}
  }catch(error){if(serial===requestSerial){$('browse-title').textContent='Chưa tải được trang chủ';notice(error.message);if(!append)renderHomeFallback();}}
  finally{if(serial===requestSerial)$('load-more').disabled=false;}
}
async function search(term,append=false){
  document.body.classList.remove('home-feed');document.body.classList.add('search-feed');
  const serial=++requestSerial;browsing();$('welcome').hidden=true;$('browse-title').textContent='Đang tìm…';$('load-more').disabled=true;
  if(!append){items=[];renderCards($('results'),[]);nextPage='';}
  try{const data=await api('search',{part:'snippet',type:'video',q:term,maxResults:16,videoEmbeddable:'true',videoSyndicated:'true',relevanceLanguage:'vi',pageToken:append?nextPage:''});if(serial!==requestSerial)return;const seen=new Set(items.map(v=>v.id));items=[...items,...mapped(data).filter(v=>!seen.has(v.id))];nextPage=data.nextPageToken||'';renderCards($('results'),items);$('browse-title').textContent=items.length?term:'Không tìm thấy video';$('load-more').hidden=!nextPage;history=[term,...history.filter(q=>q!==term)].slice(0,8);storage.set('searches',history);renderHistory();}
  catch(error){if(serial===requestSerial){$('browse-title').textContent='Chưa tải được kết quả';notice(error.message);renderFallback(term);}}finally{if(serial===requestSerial)$('load-more').disabled=false;}
}
function renderFallback(term){const box=document.createElement('div');box.className='empty';const p=document.createElement('p');p.textContent=key?'Thử tìm trên YouTube hoặc gửi lại tìm kiếm.':'Bật tìm kiếm bằng API key trong Cài đặt, hoặc tìm trực tiếp trên YouTube.';const a=document.createElement('a');a.className='button primary';a.href='https://www.youtube.com/results?search_query='+encodeURIComponent(term);a.textContent='Tìm trên YouTube ↗';const b=document.createElement('button');b.className='secondary';b.textContent='Cài đặt';b.onclick=openSettings;box.append(p,a,b);$('results').replaceChildren(box);$('load-more').hidden=true;}
function submit(term){if(composing)return;term=term.trim();if(!term)return;const id=videoId(term);if(id){watch({id,title:'Video YouTube',channel:'YouTube'});return;}if(/https?:\/\//i.test(term)){notice('Link chưa hợp lệ. Hãy dùng link video youtube.com/watch hoặc youtu.be.');return;}query=term;if(key)search(term);else{history=[term,...history.filter(q=>q!==term)].slice(0,8);storage.set('searches',history);location.assign('https://www.youtube.com/results?search_query='+encodeURIComponent(term));}}
$('search-form').onsubmit=event=>{event.preventDefault();submit($('query').value);};$('load-more').onclick=()=>query?search(query,true):popular(true);
function loadPlayerAPI(){if(window.YT?.Player)return Promise.resolve();if(apiPromise)return apiPromise;apiPromise=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{apiPromise=null;reject(Error('Chưa tải được player YouTube. Kiểm tra mạng hoặc mở video trên YouTube.'));},15000);window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);resolve();};let script=document.querySelector('script[data-youtube]');if(script)script.remove();script=document.createElement('script');script.dataset.youtube='';script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{clearTimeout(timer);apiPromise=null;reject(Error('Không tải được player YouTube.'));};document.head.append(script);});return apiPromise;}
function updateQueue(){const list=items.filter(v=>v.id!==current?.id);$('queue-title').textContent=query?'Cùng tìm kiếm':'Video khác';renderCards($('queue'),list);if(!list.length){const p=document.createElement('p');p.className='empty';p.textContent='Tìm kiếm thêm video bằng ô phía trên. Các kết quả sẽ xuất hiện ở đây.';$('queue').append(p);}}
async function watch(video){
  requestSerial++;captionsWanted=null;clearTimeout(captionsTimer);$('cc').disabled=true;current=video;$('browse').hidden=true;$('watch').hidden=false;$('video-title').textContent=video.title;$('original').href='https://www.youtube.com/watch?v='+video.id;$('notice').hidden=true;
  recent=[video,...recent.filter(v=>v.id!==video.id)].slice(0,20);storage.set('recent',recent);updateQueue();resize();const id=video.id;
  try{await loadPlayerAPI();if(current?.id!==id||$('watch').hidden)return;if(player){if(playerReady)player.loadVideoById(id);return;}
    player=new YT.Player('player',{videoId:id,width:'100%',height:'100%',playerVars:{playsinline:1,controls:0,fs:0,rel:0,origin:location.origin},events:{onReady:event=>{playerReady=true;$('play').disabled=false;syncCaptions();if(current&&current.id!==id)event.target.cueVideoById(current.id);if(!$('watch').hidden)event.target.playVideo();},onApiChange:()=>syncCaptions(),onStateChange:event=>{syncCaptions();$('play').textContent=event.data===1?'Ⅱ':'▶';$('play').setAttribute('aria-label',event.data===1?'Tạm dừng':'Phát video');if(event.data===1){const title=player.getVideoData?.().title;if(title&&current){current={...current,title};$('video-title').textContent=title;recent=recent.map(v=>v.id===current.id?current:v);storage.set('recent',recent);}}},onError:event=>{const messages={2:'Đường dẫn video không hợp lệ.',5:'APTV không phát được định dạng video này.',100:'Video đã bị xóa hoặc chuyển sang riêng tư.',101:'Chủ video không cho phép phát nhúng.',150:'Chủ video không cho phép phát nhúng.',153:'APTV không gửi thông tin nguồn cần thiết cho YouTube.'};notice((messages[event.data]||'YouTube không phát được video.')+' Bấm YouTube ↗ để mở bản gốc.');},onAutoplayBlocked:()=>notice('Chạm nút phát trong player để bắt đầu video.')}});
  }catch(error){notice(error.message);}
}
// YouTube exposes module controls in its current player, but does not
// guarantee caption toggling in the public API. Feature-detect and verify.
function syncCaptions(){
  if(!playerReady||!player)return;
  const available=typeof player.loadModule==='function'&&typeof player.unloadModule==='function';
  $('cc').disabled=!available;
  if(!available){$('cc').title='Player này không hỗ trợ nút phụ đề ngoài';return;}
  let active=false;
  try{active=(player.getOptions?.()||[]).includes('captions');}catch{}
  if(captionsWanted!==null)active=captionsWanted;
  $('cc').setAttribute('aria-pressed',String(active));
  $('cc').setAttribute('aria-label',active?'Tắt phụ đề':'Bật phụ đề');
  $('cc').title=active?'Tắt phụ đề':'Bật phụ đề';
}
$('cc').onclick=()=>{
  if(!playerReady)return;
  captionsWanted=$('cc').getAttribute('aria-pressed')!=='true';
  try{
    if(captionsWanted)player.loadModule('captions');else player.unloadModule('captions');
    syncCaptions();
    clearTimeout(captionsTimer);
    captionsTimer=setTimeout(()=>{
      syncCaptions();
      if(captionsWanted&&!(player.getOptions?.()||[]).includes('captions'))notice('Chưa bật được phụ đề. Video có thể không có CC hoặc APTV không hỗ trợ; hãy thử trên YouTube.');
    },1500);
  }catch{notice('Không đổi được phụ đề trong player này. Hãy mở video trên YouTube.');}
};
$('play').onclick=()=>{if(!playerReady)return;player.getPlayerState()===1?player.pauseVideo():player.playVideo();};
$('seek').addEventListener('pointerdown',()=>{seeking=true;showCinemaControls();});$('seek').addEventListener('input',()=>{seeking=true;showCinemaControls();$('elapsed').textContent=timeLabel(Number($('seek').value)/1000*(player?.getDuration?.()||0));});$('seek').addEventListener('change',()=>{if(playerReady)player.seekTo(Number($('seek').value)/1000*player.getDuration(),true);seeking=false;showCinemaControls();});$('seek').addEventListener('pointercancel',()=>{seeking=false;});
setInterval(()=>{if(!playerReady||$('watch').hidden||document.hidden)return;const duration=player.getDuration()||0;const elapsed=player.getCurrentTime()||0;$('duration').textContent=timeLabel(duration);$('seek').disabled=!duration;if(!seeking){$('elapsed').textContent=timeLabel(elapsed);$('seek').value=duration?String(elapsed/duration*1000):'0';}},500);
function resize(){const height=window.visualViewport?.height||innerHeight;const width=document.documentElement.clientWidth;document.documentElement.style.setProperty('--vh',height+'px');const normalHeight=height-document.querySelector('header').offsetHeight;document.documentElement.style.setProperty('--player-width',playerSize(width,normalHeight)+'px');document.documentElement.style.setProperty('--cinema-width',playerSize(width,height,true)+'px');$('diagnostics').textContent=`Vùng hiển thị: ${width} × ${Math.round(height)} CSS px · Pixel ratio: ${devicePixelRatio} · ${navigator.userAgent}`;}
function showCinemaControls(){
  clearTimeout(controlsTimer);
  if(!cinema)return;
  document.body.classList.remove('controls-hidden');
  controlsTimer=setTimeout(()=>{
    if(cinema&&!seeking){
      if($('transport').contains(document.activeElement))document.activeElement.blur();
      document.body.classList.add('controls-hidden');
    }
  },3000);
}
function setCinema(enabled){
  cinema=enabled;document.body.classList.toggle('cinema',cinema);
  $('fullscreen').setAttribute('aria-label',cinema?'Thoát mở rộng':'Mở rộng video');
  if(cinema)showCinemaControls();else{clearTimeout(controlsTimer);document.body.classList.remove('controls-hidden');}
  resize();
}
$('controls-wake').addEventListener('pointerdown',showCinemaControls);
$('controls-wake').addEventListener('click',showCinemaControls);
$('transport').addEventListener('pointerdown',showCinemaControls);
document.addEventListener('pointermove',()=>{if(cinema&&!document.body.classList.contains('controls-hidden'))showCinemaControls();},{passive:true});
document.addEventListener('keydown',event=>{if(cinema){showCinemaControls();if(event.key==='Escape')setCinema(false);}});
$('fullscreen').onclick=()=>setCinema(!cinema);
window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.addEventListener('offline',()=>notice('Mất kết nối mạng. Video có thể dừng khi hết phần đã tải.'));window.addEventListener('online',()=>notice('Đã có mạng. Bạn có thể thử lại tìm kiếm hoặc phát video.'));
function openSettings(){returnFocus=document.activeElement;$('api-key').value=key;resize();if($('settings').showModal)$('settings').showModal();else $('settings').setAttribute('open','');}
function closeSettings(){if($('settings').close)$('settings').close();else $('settings').removeAttribute('open');returnFocus?.focus();}
$('account').onclick=openSettings;$('close-settings').onclick=closeSettings;$('settings-form').onsubmit=event=>{event.preventDefault();key=$('api-key').value.trim();storage.set('key',key);closeSettings();notice('Đã lưu cài đặt trên trình duyệt này.');if($('watch').hidden)query&&key?search(query):home();};$('clear-history').onclick=()=>{recent=[];history=[];storage.set('recent',recent);storage.set('searches',history);renderHistory();if($('watch').hidden)home();notice('Đã xóa lịch sử BMWTube trên thiết bị.');};
resize();home();const initial=videoId(new URL(location.href).searchParams.get('v')||'');if(initial)watch({id:initial,title:'Video YouTube',channel:'YouTube'});
// Optional browser agent integration; never required for APTV.
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  try{Promise.resolve(document.modelContext.registerTool({name:'open_youtube_video',title:'Mở video trong BMWTube',description:'Mở một link YouTube trong player và lưu vào lịch sử cục bộ; có thể bắt đầu phát video.',inputSchema:{type:'object',properties:{url:{type:'string'}},required:['url'],additionalProperties:false},annotations:{readOnlyHint:false},async execute(input){if(!input||typeof input.url!=='string'||Object.keys(input).some(k=>k!=='url'))throw Error('Cần một URL YouTube hợp lệ.');const id=videoId(input.url);if(!id)throw Error('Link YouTube không hợp lệ.');await watch({id,title:'Video YouTube',channel:'YouTube'});return {videoId:id,view:'player',ready:playerReady};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
