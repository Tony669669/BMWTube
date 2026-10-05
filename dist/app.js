import {telex,videoId,timeLabel,playerSize} from './core.js?v=review-fixes';
const $=id=>document.getElementById(id);
const storage={get(key,fallback){try{return JSON.parse(localStorage.getItem('bmwtube.'+key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem('bmwtube.'+key,JSON.stringify(value));}catch{notice('Trình duyệt không cho lưu dữ liệu. Cài đặt chỉ dùng trong phiên này.');}}};
let key=storage.get('key',''),recent=storage.get('recent',[]),history=storage.get('searches',[]),telexOn=storage.get('telex',false),playerSide=storage.get('playerSide','left');
let iconsNearArrows=storage.get('iconsNearArrows',false)===true;
if(typeof key!=='string')key='';
telexOn=telexOn===true;
if(!['left','right'].includes(playerSide))playerSide='left';
if(!Array.isArray(recent))recent=[];recent=recent.filter(v=>v&&videoId(v.id)&&typeof v.title==='string').slice(0,20);
if(!Array.isArray(history))history=[];history=history.filter(v=>typeof v==='string').slice(0,8);
if(playerSide==='right')document.body.classList.add('passenger');
document.body.classList.toggle('icons-near-arrows',iconsNearArrows);
let libraryMode='',activeChannel=null,favoriteBusy=false;
let favoriteChannels=storage.get('favoriteChannels',[]);
if(!Array.isArray(favoriteChannels))favoriteChannels=[];
favoriteChannels=favoriteChannels.filter(c=>c&&typeof c.id==='string'&&/^UC[\w-]{22}$/.test(c.id)&&typeof c.title==='string').slice(0,100);
const uploadsCache=new Map();
let appProfile=storage.get('appProfile','red')==='yellow'?'yellow':'red';
document.body.classList.toggle('aptv-yellow',appProfile==='yellow');
let appendAllowed=true,lastInput='',skipTelex=false;
const pendingAPI=new Map();
let captionsWanted=null,captionsTimer=null;
let items=[],current=null,player=null,playerReady=false,apiPromise=null,query='',nextPage='',requestSerial=0,composing=false,rawInput='',cinema=false,seeking=false,returnFocus=null,controlsTimer=null;
function notice(message){
  const dialogStatus=document.querySelector('dialog[open] .dialog-status');
  $('notice-text').textContent=message;
  $('notice').hidden=Boolean(dialogStatus);
  if(dialogStatus){dialogStatus.textContent=message;dialogStatus.hidden=false;}
}
$('dismiss').onclick=()=>{$('notice').hidden=true;};
function updateTelex(){$('telex').setAttribute('aria-pressed',String(telexOn));$('telex').textContent=telexOn?'Telex ✓':'Telex';}
updateTelex();$('telex').onclick=()=>{telexOn=!telexOn;rawInput=lastInput=$('query').value;storage.set('telex',telexOn);updateTelex();$('query').focus();};
$('query').addEventListener('compositionstart',()=>{composing=true;});
$('query').addEventListener('compositionend',()=>{composing=false;rawInput=lastInput=$('query').value;});
$('query').addEventListener('beforeinput',()=>{const input=$('query');appendAllowed=input.selectionStart===input.selectionEnd&&input.selectionEnd===input.value.length;});
$('query').addEventListener('paste',()=>{skipTelex=true;});
$('query').addEventListener('input',event=>{
  const input=$('query');if(composing||event.isComposing)return;
  // Some WebViews omit inputType/data; infer an append from the visible value.
  const appended=input.value.startsWith(lastInput)?input.value.slice(lastInput.length):'';
  const typing=!event.inputType||event.inputType==='insertText';
  if(telexOn&&!skipTelex&&appendAllowed&&typing&&appended&&input.selectionStart===input.value.length){rawInput+=appended;input.value=telex(rawInput);}
  else rawInput=input.value;
  lastInput=input.value;skipTelex=false;appendAllowed=true;
});
$('query').addEventListener('keydown',event=>{if(event.key==='Enter'&&(composing||event.isComposing||event.keyCode===229))event.preventDefault();});
function decode(value){const text=document.createElement('textarea');text.innerHTML=value||'';return text.value;}
function card(v){const button=document.createElement('button');button.className='card';const img=document.createElement('img');img.src=`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;img.loading='lazy';img.alt='';const title=document.createElement('h3');title.textContent=v.title;const channel=document.createElement('p');channel.textContent=v.channel||'YouTube';button.append(img,title,channel);button.onclick=()=>watch(v);return button;}
function renderCards(target,list){target.replaceChildren(...list.map(card));}
function updateKeywordChipsClass(){document.body.classList.toggle('keyword-has-chips',document.body.classList.contains('keyword-search')&&$('recent-searches').childElementCount>0);}
function renderHistory(){const container=$('recent-searches');container.replaceChildren();history.forEach(term=>{const b=document.createElement('button');b.textContent=term;b.onclick=()=>{$('query').value=term;rawInput=lastInput=term;submit(term);};container.append(b);});updateKeywordChipsClass();}
function placeRecentSearches(nextToHeading){(nextToHeading?$('browse-heading-main'):$('recent-search-slot')).append($('recent-searches'));updateKeywordChipsClass();}
let selectedRailId=null,railModalId=null,railRestoreId=null;
function setRailActive(id){selectedRailId=id;document.querySelectorAll('#app-rail button').forEach(button=>{if(button.id===id)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});}
function enterRailDialog(id){railRestoreId=selectedRailId;railModalId=id;setRailActive(null);$(id).setAttribute('aria-expanded','true');}
function leaveRailDialog(){if(railModalId)$(railModalId).setAttribute('aria-expanded','false');railModalId=null;setRailActive(railRestoreId);railRestoreId=null;}
function browsing(){cinema=false;clearTimeout(controlsTimer);document.body.classList.remove('cinema','controls-hidden');if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});$('watch').hidden=true;$('browse').hidden=false;if(playerReady)player.pauseVideo();$('fullscreen').setAttribute('aria-label','Mở rộng video');resize();}
function home(){
  libraryMode='';activeChannel=null;
  setRailActive('home');
  requestSerial++;document.body.classList.add('home-feed');document.body.classList.remove('search-feed','keyword-search');placeRecentSearches(false);browsing();query='';nextPage='';items=[];
  $('query').value='';rawInput=lastInput='';$('load-more').hidden=true;
  $('browse-title').textContent='Khám phá trên YouTube';
  renderCards($('results'),[]);renderHistory();$('welcome').hidden=true;
  if(key)popular();else renderHomeFallback();
}
function renderHomeFallback(){
  const box=document.createElement('div');box.className='empty';
  const p=document.createElement('p');p.textContent='Thêm API key để hiển thị danh sách video.';
  const open=document.createElement('a');open.className='button primary';open.href='https://m.youtube.com/';open.textContent='Mở trang chủ YouTube ↗';
  const setup=document.createElement('button');setup.className='secondary';setup.textContent='Thiết lập API key';setup.onclick=openSettings;
  box.append(p,open,setup);$('results').replaceChildren(box);$('load-more').hidden=true;
}
$('home').onclick=home;$('back').onclick=()=>{if(libraryMode==='recent'){showRecent();return;}if(libraryMode==='favorites'){showFavorites();return;}if(libraryMode==='channel'){requestSerial++;browsing();renderCards($('results'),items);$('browse-title').textContent=activeChannel.title;$('load-more').hidden=!nextPage;$('load-more').disabled=false;return;}requestSerial++;$('load-more').disabled=false;if(items.length){renderCards($('results'),items);$('load-more').hidden=!nextPage;$('browse-title').textContent=query||'Khám phá trên YouTube';browsing();}else if(query&&key)search(query);else home();};$('paste-focus').onclick=()=>openSearch();
function api(endpoint,params){
  const identity=JSON.stringify([key,endpoint,params]);
  if(pendingAPI.has(identity))return pendingAPI.get(identity);
  const request=fetchAPI(endpoint,params).finally(()=>pendingAPI.delete(identity));
  pendingAPI.set(identity,request);
  return request;
}
async function fetchAPI(endpoint,params){
  if(!navigator.onLine)throw Error('Mất kết nối mạng. Kết nối lại rồi thử lần nữa.');
  const url=new URL('https://www.googleapis.com/youtube/v3/'+endpoint);Object.entries({...params,key}).forEach(([k,v])=>{if(v)url.searchParams.set(k,v);});
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(url,{signal:controller.signal});const json=await response.json();if(!response.ok){const reason=json.error?.errors?.[0]?.reason;throw Error(['quotaExceeded','dailyLimitExceeded'].includes(reason)?'YouTube API đã hết hạn mức. Bạn vẫn có thể mở link hoặc xem trên YouTube.':response.status===400||response.status===403?'Không truy cập được YouTube API. Kiểm tra khóa, giới hạn địa chỉ web và trạng thái API trong Cài đặt.':'YouTube tạm thời không phản hồi. Thử lại sau.');}return json;}catch(error){if(error.name==='AbortError')throw Error('Kết nối YouTube quá lâu. Vui lòng thử lại.');throw error;}finally{clearTimeout(timeout);}
}
function mapped(data){return(data.items||[]).map(v=>({id:typeof v.id==='string'?v.id:v.id?.videoId,title:decode(v.snippet?.title),channel:decode(v.snippet?.channelTitle),channelId:v.snippet?.channelId})).filter(v=>videoId(v.id));}
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
  libraryMode='';activeChannel=null;
  setRailActive('open-search');
  document.body.classList.remove('home-feed');document.body.classList.add('search-feed','keyword-search');placeRecentSearches(true);
  const serial=++requestSerial;browsing();$('welcome').hidden=true;$('browse-title').textContent='Đang tìm…';$('load-more').disabled=true;
  if(!append){items=[];renderCards($('results'),[]);nextPage='';}
  try{const data=await api('search',{part:'snippet',type:'video',q:term,maxResults:16,videoEmbeddable:'true',videoSyndicated:'true',relevanceLanguage:'vi',pageToken:append?nextPage:''});if(serial!==requestSerial)return;const seen=new Set(items.map(v=>v.id));items=[...items,...mapped(data).filter(v=>!seen.has(v.id))];nextPage=data.nextPageToken||'';renderCards($('results'),items);$('browse-title').textContent=items.length?term:'Không tìm thấy video';$('load-more').hidden=!nextPage;history=[term,...history.filter(q=>q!==term)].slice(0,8);storage.set('searches',history);renderHistory();}
  catch(error){if(serial===requestSerial){$('browse-title').textContent='Chưa tải được kết quả';notice(error.message);if(!append)renderFallback(term);}}finally{if(serial===requestSerial)$('load-more').disabled=false;}
}
function renderFallback(term){const box=document.createElement('div');box.className='empty';const p=document.createElement('p');p.textContent=key?'Thử tìm trên YouTube hoặc gửi lại tìm kiếm.':'Bật tìm kiếm bằng API key trong Cài đặt, hoặc tìm trực tiếp trên YouTube.';const a=document.createElement('a');a.className='button primary';a.href='https://m.youtube.com/results?search_query='+encodeURIComponent(term);a.textContent='Tìm trên YouTube ↗';const b=document.createElement('button');b.className='secondary';b.textContent='Cài đặt';b.onclick=openSettings;box.append(p,a,b);$('results').replaceChildren(box);$('load-more').hidden=true;}
function submit(term){if(composing)return;term=term.trim();if(!term)return;const id=videoId(term);if(id){closeSearch();watch({id,title:'Video YouTube',channel:'YouTube'});return;}if(/https?:\/\//i.test(term)){notice('Link chưa hợp lệ. Hãy dùng link video youtube.com/watch hoặc youtu.be.');return;}closeSearch();query=term;if(key)search(term);else{history=[term,...history.filter(q=>q!==term)].slice(0,8);storage.set('searches',history);location.assign('https://m.youtube.com/results?search_query='+encodeURIComponent(term));}}
$('search-form').onsubmit=event=>{event.preventDefault();submit($('query').value);};$('load-more').onclick=()=>libraryMode==='channel'?loadChannel(activeChannel,true):query?search(query,true):popular(true);
function loadPlayerAPI(){if(window.YT?.Player)return Promise.resolve();if(apiPromise)return apiPromise;apiPromise=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{apiPromise=null;reject(Error('Chưa tải được player YouTube. Kiểm tra mạng hoặc mở video trên YouTube.'));},15000);window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);resolve();};let script=document.querySelector('script[data-youtube]');if(script)script.remove();script=document.createElement('script');script.dataset.youtube='';script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{clearTimeout(timer);apiPromise=null;reject(Error('Không tải được player YouTube.'));};document.head.append(script);});return apiPromise;}
function updateQueue(){const list=items.filter(v=>v.id!==current?.id);$('queue-title').textContent=query?'Cùng tìm kiếm':'Video khác';renderCards($('queue'),list);if(!list.length){const p=document.createElement('p');p.className='empty';p.textContent='Dùng nút Tìm kiếm bên cạnh để tìm thêm video. Các kết quả sẽ xuất hiện ở đây.';$('queue').append(p);}}
async function watch(video, startSeconds=0){
  requestSerial++;$('load-more').disabled=false;seeking=false;captionsWanted=false;clearTimeout(captionsTimer);$('cc').disabled=true;if(playerReady)turnCaptionsOff(player);current=video;updateFavoriteButton();$('browse').hidden=true;$('watch').hidden=false;$('video-title').textContent=video.title;$('original').href='https://m.youtube.com/watch?v='+video.id;$('notice').hidden=true;
  showPlayerControls();
  recent=[video,...recent.filter(v=>v.id!==video.id)].slice(0,20);storage.set('recent',recent);updateQueue();resize();const id=video.id;
  try{await loadPlayerAPI();if(current?.id!==id||$('watch').hidden)return;if(player){if(playerReady)player.loadVideoById({videoId:id,startSeconds});return;}
    player=new YT.Player('player',{videoId:id,width:'100%',height:'100%',playerVars:{start:Math.floor(startSeconds),cc_load_policy:0,playsinline:1,controls:0,fs:0,rel:0,origin:location.origin},events:{onReady:event=>{playerReady=true;$('play').disabled=false;captionsWanted=false;turnCaptionsOff(event.target);syncCaptions();if(current&&current.id!==id)event.target.cueVideoById(current.id);if(!$('watch').hidden)event.target.playVideo();},onApiChange:()=>{if(captionsWanted===false)turnCaptionsOff(player);syncCaptions();},onStateChange:event=>{syncCaptions();$('play').textContent=event.data===1?'Ⅱ':'▶';$('play').setAttribute('aria-label',event.data===1?'Tạm dừng':'Phát video');if(event.data===1){const title=player.getVideoData?.().title;if(title&&current){current={...current,title};$('video-title').textContent=title;recent=recent.map(v=>v.id===current.id?current:v);storage.set('recent',recent);}}},onError:event=>{const messages={2:'Đường dẫn video không hợp lệ.',5:'APTV không phát được định dạng video này.',100:'Video đã bị xóa hoặc chuyển sang riêng tư.',101:'Chủ video không cho phép phát nhúng.',150:'Chủ video không cho phép phát nhúng.',153:'APTV không gửi thông tin nguồn cần thiết cho YouTube.'};notice((messages[event.data]||'YouTube không phát được video.')+' Bấm YouTube ↗ để mở bản gốc.')}}});
  }catch(error){if(current?.id===id&&!$('watch').hidden)notice(error.message);}
}
function turnCaptionsOff(target=player){
  if(!target||typeof target.unloadModule!=='function')return;
  try{target.unloadModule('captions');}catch{}
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
$('seek').addEventListener('pointerdown',()=>{seeking=true;showPlayerControls();});$('seek').addEventListener('input',()=>{seeking=true;showPlayerControls();$('elapsed').textContent=timeLabel(Number($('seek').value)/1000*(player?.getDuration?.()||0));});$('seek').addEventListener('change',()=>{if(playerReady)player.seekTo(Number($('seek').value)/1000*player.getDuration(),true);seeking=false;showPlayerControls();});$('seek').addEventListener('pointercancel',()=>{seeking=false;showPlayerControls();});
window.addEventListener('pointerup',()=>{if(seeking){seeking=false;showPlayerControls();}});
setInterval(()=>{if(!playerReady||$('watch').hidden||document.hidden)return;const duration=player.getDuration()||0;const elapsed=player.getCurrentTime()||0;$('duration').textContent=timeLabel(duration);$('seek').disabled=!duration;if(!seeking){$('elapsed').textContent=timeLabel(elapsed);$('seek').value=duration?String(elapsed/duration*1000):'0';}},500);
function resize(){const height=window.visualViewport?.height||innerHeight;const width=window.visualViewport?.width||document.documentElement.clientWidth;const baseRail=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail-width'))||72;const inset=appProfile==='yellow'||iconsNearArrows?baseRail:0;const railWidth=baseRail;const appWidth=Math.max(0,width-railWidth-inset);const small=width<=760;const redGrid=Math.max(0,width-baseRail-inset-(small?40:56));const gap=small?10:16;const cols=Math.max(1,Math.floor((redGrid+gap)/((small?112:140)+gap)));const baseCardWidth=(redGrid-(cols-1)*gap)/cols;document.documentElement.style.setProperty('--feed-card-width',Math.min(redGrid,baseCardWidth*1.1)+'px');document.documentElement.style.setProperty('--yellow-card-width',Math.max(44,baseCardWidth*.55)+'px');const yellowLandscape=appProfile==='yellow'&&width>height&&appWidth>=480;const sideQueue=yellowLandscape?Math.min(240,Math.max(180,appWidth*.25)):0;const stageWidth=yellowLandscape&&!cinema?Math.min(height*16/9,appWidth-sideQueue):playerSize(appWidth,height,true);document.body.classList.toggle('compact-player',!yellowLandscape&&appWidth<height*16/9+240);const redAppWidth=Math.max(0,width-baseRail-inset);const redQueueWidth=(redAppWidth<height*16/9+240?redAppWidth:redAppWidth-playerSize(redAppWidth,height,true))-32;document.documentElement.style.setProperty('--yellow-queue-width',Math.max(76,redQueueWidth*(small?.24:.21))*.7+'px');document.documentElement.style.setProperty('--player-height',playerSize(appWidth,height,true)*9/16+'px');document.documentElement.style.setProperty('--vh',height+'px');document.documentElement.style.setProperty('--player-width',stageWidth+'px');document.documentElement.style.setProperty('--cinema-width',appWidth+'px');$('diagnostics').textContent=`Vùng hiển thị: ${Math.round(width)} × ${Math.round(height)} CSS px · Pixel ratio: ${devicePixelRatio} · ${navigator.userAgent}`;}
function showPlayerControls(){
  clearTimeout(controlsTimer);
  if($('watch').hidden)return;
  document.body.classList.remove('controls-hidden');
  controlsTimer=setTimeout(()=>{
    if(!$('watch').hidden&&!seeking){
      if($('transport').querySelector(':focus-visible'))return showPlayerControls();
      document.body.classList.add('controls-hidden');
    }
  },3000);
}
function setCinema(enabled){
  cinema=enabled;document.body.classList.toggle('cinema',cinema);
  $('fullscreen').setAttribute('aria-label',cinema?'Thoát mở rộng':'Mở rộng video');
  showPlayerControls();
  resize();
}
$('controls-wake').addEventListener('click',showPlayerControls);
$('transport').addEventListener('pointerdown',showPlayerControls);
$('transport').addEventListener('focusin',showPlayerControls);
$('transport').addEventListener('focusout',showPlayerControls);
$('stage').addEventListener('pointermove',()=>{if(!document.body.classList.contains('controls-hidden'))showPlayerControls();},{passive:true});
document.addEventListener('keydown',event=>{if(!$('watch').hidden){showPlayerControls();if(cinema&&event.key==='Escape')setCinema(false);}});
$('fullscreen').onclick=()=>setCinema(!cinema);
window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.addEventListener('offline',()=>notice('Mất kết nối mạng. Video có thể dừng khi hết phần đã tải.'));window.addEventListener('online',()=>notice('Đã có mạng. Bạn có thể thử lại tìm kiếm hoặc phát video.'));
function openSearch(){returnFocus=document.activeElement;enterRailDialog('open-search');const dialog=$('search-dialog');dialog.querySelector('.dialog-status').hidden=true;if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');$('query').focus();}
function closeSearch(){const dialog=$('search-dialog');if(dialog.close&&dialog.open)dialog.close();else dialog.removeAttribute('open');leaveRailDialog();returnFocus?.focus();}
function openSettings(){returnFocus=document.activeElement;enterRailDialog('account');$('settings').querySelector('.dialog-status').hidden=true;$('api-key').value=key;$('settings-form').elements['player-side'].value=playerSide;$('settings-form').elements['app-profile'].value=appProfile;$('icons-near-arrows').checked=iconsNearArrows;resize();if($('settings').showModal)$('settings').showModal();else $('settings').setAttribute('open','');}
function closeSettings(){if($('settings').close)$('settings').close();else $('settings').removeAttribute('open');leaveRailDialog();returnFocus?.focus();}
$('search-dialog').addEventListener('cancel',leaveRailDialog);
$('settings').addEventListener('cancel',leaveRailDialog);
function selectAppProfile(event){
  if(!$('settings').open)return;
  appProfile=event.target.value==='yellow'?'yellow':'red';
  storage.set('appProfile',appProfile);
  document.body.classList.toggle('aptv-yellow',appProfile==='yellow');
  resize();closeSettings();
}
document.querySelectorAll('input[name="app-profile"]').forEach(input=>{
  input.addEventListener('click',selectAppProfile);
  input.addEventListener('change',selectAppProfile);
});
// Keep the BMWTube rail clear of APTV's own menu and arrow controls.
$('icons-near-arrows').addEventListener('change',event=>{
  iconsNearArrows=event.target.checked;
  storage.set('iconsNearArrows',iconsNearArrows);
  document.body.classList.toggle('icons-near-arrows',iconsNearArrows);
  resize();
});
// Choosing a seat is an immediate preference; other settings retain their Save action.
function selectPlayerSide(event){
  if(!$('settings').open)return;
  playerSide=event.target.value==='right'?'right':'left';
  storage.set('playerSide',playerSide);
  document.body.classList.toggle('passenger',playerSide==='right');
  resize();closeSettings();
}
document.querySelectorAll('input[name="player-side"]').forEach(input=>{
  input.addEventListener('click',selectPlayerSide);
  input.addEventListener('change',selectPlayerSide);
});
$('home').onclick=home;$('open-search').onclick=openSearch;$('account').onclick=openSettings;$('close-search').onclick=closeSearch;$('search-dialog').addEventListener('click',event=>{if(event.target===$('search-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeSearch();}});$('close-settings').onclick=closeSettings;$('settings').addEventListener('click',event=>{if(event.target===$('settings')){const r=$('settings').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeSettings();}});$('premium-link').onclick=()=>{savePlaybackURL();try{sessionStorage.setItem('bmwtube.loginPending','1');}catch{}closeSettings();};$('settings-form').onsubmit=event=>{event.preventDefault();const nextKey=$('api-key').value.trim();const keyChanged=nextKey!==key;key=nextKey;storage.set('key',key);playerSide=$('settings-form').elements['player-side'].value==='right'?'right':'left';storage.set('playerSide',playerSide);document.body.classList.toggle('passenger',playerSide==='right');resize();closeSettings();notice('Đã lưu cài đặt trên trình duyệt này.');if(keyChanged&&$('watch').hidden)query&&key?search(query):home();};$('clear-history').onclick=()=>{recent=[];history=[];storage.set('recent',recent);storage.set('searches',history);renderHistory();if($('watch').hidden){if(libraryMode==='recent')showRecent();else if(!libraryMode)home();}notice('Đã xóa lịch sử BMWTube trên thiết bị.');};

function emptyLibrary(message){const p=document.createElement('p');p.className='empty';p.textContent=message;$('results').replaceChildren(p);}
function libraryView(mode,title){
  setRailActive(mode==='recent'?'open-recent':mode==='favorites'||mode==='channel'?'open-favorites':null);
  requestSerial++;libraryMode=mode;query='';nextPage='';items=[];browsing();
  document.body.classList.remove('home-feed','keyword-search');document.body.classList.add('search-feed');placeRecentSearches(false);
  $('browse-title').textContent=title;$('welcome').hidden=true;$('recent-searches').replaceChildren();
  $('load-more').hidden=true;$('load-more').disabled=false;$('results').replaceChildren();
}
function showRecent(){
  libraryView('recent','Đã xem gần đây');items=[...recent];renderCards($('results'),items);
  if(!items.length)emptyLibrary('Chưa có video đã xem trên trình duyệt này.');
}
function updateFavoriteButton(){
  const saved=Boolean(current?.channelId&&favoriteChannels.some(c=>c.id===current.channelId));
  $('favorite-channel').textContent=saved?'★':'☆';$('favorite-channel').setAttribute('aria-pressed',String(saved));
  const label=saved?'Bỏ kênh yêu thích':'Lưu kênh yêu thích';$('favorite-channel').title=label;$('favorite-channel').setAttribute('aria-label',label);
}
async function toggleFavorite(){
  if(!current||favoriteBusy)return;
  favoriteBusy=true;$('favorite-channel').disabled=true;const video=current;
  try{
    if(!/^UC[\w-]{22}$/.test(video.channelId||'')){
      if(!key)throw Error('Thêm API key trong Cài đặt để xác định kênh của video này.');
      const data=await api('videos',{part:'snippet',id:video.id});const snippet=data.items?.[0]?.snippet;
      if(!/^UC[\w-]{22}$/.test(snippet?.channelId||''))throw Error('Chưa xác định được kênh của video.');
      video.channelId=snippet.channelId;video.channel=decode(snippet.channelTitle);
      if(current?.id===video.id)current={...current,channelId:video.channelId,channel:video.channel};
      recent=recent.map(v=>v.id===video.id?{...v,channelId:video.channelId,channel:video.channel}:v);storage.set('recent',recent);
    }
    const saved=favoriteChannels.some(c=>c.id===video.channelId);
    if(saved)favoriteChannels=favoriteChannels.filter(c=>c.id!==video.channelId);
    else {if(favoriteChannels.length>=100)throw Error('Đã lưu 100 kênh. Bỏ bớt một kênh trước khi thêm.');favoriteChannels.push({id:video.channelId,title:video.channel||'Kênh YouTube'});}
    storage.set('favoriteChannels',favoriteChannels);notice(saved?'Đã bỏ kênh yêu thích.':'Đã lưu kênh yêu thích.');
  }catch(error){notice(error.message);}finally{favoriteBusy=false;$('favorite-channel').disabled=false;updateFavoriteButton();if(libraryMode==='favorites'&&!$('browse').hidden)showFavorites();}
}
function showFavorites(){
  libraryView('favorites','Kênh yêu thích');
  if(!favoriteChannels.length){emptyLibrary('Bấm ☆ ở góc trên player để lưu kênh của video đang xem. Kênh yêu thích được lưu trên trình duyệt này.');return;}
  for(const channel of favoriteChannels){
    const row=document.createElement('div');row.className='favorite-card';
    const open=document.createElement('button');open.className='secondary';open.textContent=channel.title;open.onclick=()=>loadChannel(channel);
    const remove=document.createElement('button');remove.className='secondary';remove.textContent='★';remove.setAttribute('aria-label','Bỏ yêu thích '+channel.title);remove.title='Bỏ yêu thích';
    remove.onclick=()=>{favoriteChannels=favoriteChannels.filter(c=>c.id!==channel.id);storage.set('favoriteChannels',favoriteChannels);updateFavoriteButton();showFavorites();};
    row.append(open,remove);$('results').append(row);
  }
}
async function loadChannel(channel,append=false){
  if(!key){notice('Thêm API key trong Cài đặt để tải video của kênh yêu thích.');return;}
  if(!append){libraryView('channel',channel.title);activeChannel=channel;}
  const serial=++requestSerial;$('load-more').disabled=true;
  try{
    let uploads=uploadsCache.get(channel.id);
    if(!uploads){const data=await api('channels',{part:'contentDetails',id:channel.id});uploads=data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;if(!uploads)throw Error('Không tìm thấy danh sách video của kênh.');uploadsCache.set(channel.id,uploads);}
    if(serial!==requestSerial)return;
    const data=await api('playlistItems',{part:'snippet',playlistId:uploads,maxResults:16,pageToken:append?nextPage:''});
    if(serial!==requestSerial)return;
    const seen=new Set(items.map(v=>v.id));
    const videos=(data.items||[]).map(v=>({id:v.snippet?.resourceId?.videoId,title:decode(v.snippet?.title),channel:channel.title,channelId:channel.id})).filter(v=>videoId(v.id)&&!seen.has(v.id));
    items=[...items,...videos];nextPage=data.nextPageToken||'';renderCards($('results'),items);$('load-more').hidden=!nextPage;
    if(!items.length)emptyLibrary('Kênh chưa có video để hiển thị.');
  }catch(error){if(serial===requestSerial){notice(error.message);$('load-more').hidden=false;}}
  finally{if(serial===requestSerial)$('load-more').disabled=false;}
}
$('open-recent').onclick=showRecent;$('open-favorites').onclick=showFavorites;$('favorite-channel').onclick=toggleFavorite;

// Store only the selected video/time in this history entry, never YouTube credentials.
function savePlaybackURL(){
  const url=new URL(location.href);
  if(current&&!$('watch').hidden){
    let seconds=0;try{seconds=playerReady?player.getCurrentTime():Number(url.searchParams.get('t'));}catch{}
    url.searchParams.set('v',current.id);url.searchParams.set('t',String(Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0))));
  }else{url.searchParams.delete('v');url.searchParams.delete('t');}
  window.history.replaceState(null,'',url);
  return url;
}
$('reload-session').onclick=()=>{savePlaybackURL();location.reload();};
$('premium-check').onclick=event=>{
  event.preventDefault();const saved=savePlaybackURL();const url=new URL('premium-check.html',location.href);
  for(const name of ['v','t'])if(saved.searchParams.has(name))url.searchParams.set(name,saved.searchParams.get(name));
  location.assign(url);
};
window.addEventListener('pageshow',event=>{
  let pending=false;try{pending=sessionStorage.getItem('bmwtube.loginPending')==='1';sessionStorage.removeItem('bmwtube.loginPending');}catch{}
  if(pending&&event.persisted)location.reload();
});
resize();const initialURL=new URL(location.href);const initial=videoId(initialURL.searchParams.get('v')||'');
const initialTime=Number(initialURL.searchParams.get('t'));if(initial)watch({id:initial,title:'Video YouTube',channel:'YouTube'},Number.isFinite(initialTime)?Math.max(0,initialTime):0);else home();
// Optional browser agent integration; never required for APTV.
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  try{Promise.resolve(document.modelContext.registerTool({name:'open_youtube_video',title:'Mở video trong BMWTube',description:'Mở một link YouTube trong player và lưu vào lịch sử cục bộ; có thể bắt đầu phát video.',inputSchema:{type:'object',properties:{url:{type:'string'}},required:['url'],additionalProperties:false},annotations:{readOnlyHint:false},async execute(input){if(!input||typeof input.url!=='string'||Object.keys(input).some(k=>k!=='url'))throw Error('Cần một URL YouTube hợp lệ.');const id=videoId(input.url);if(!id)throw Error('Link YouTube không hợp lệ.');await watch({id,title:'Video YouTube',channel:'YouTube'});return {videoId:id,view:'player',ready:playerReady};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
  window.addEventListener('pagehide',event=>{if(!event.persisted)lifecycle.abort();});
}
