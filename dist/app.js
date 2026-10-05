import {telex,videoId,timeLabel,playerSize} from './core.js?v=review-fixes';
const $=id=>document.getElementById(id);
const storage={get(key,fallback){try{return JSON.parse(localStorage.getItem('bmwtube.'+key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem('bmwtube.'+key,JSON.stringify(value));}catch{notice('Trình duyệt không cho lưu dữ liệu. Cài đặt chỉ dùng trong phiên này.');}}};
let key=storage.get('key',''),recent=storage.get('recent',[]),history=storage.get('searches',[]),telexOn=storage.get('telex',false),playerSide=storage.get('playerSide','left');
if(typeof key!=='string')key='';
telexOn=telexOn===true;
if(!['left','right'].includes(playerSide))playerSide='left';
if(!Array.isArray(recent))recent=[];recent=recent.filter(v=>v&&videoId(v.id)&&typeof v.title==='string').slice(0,20);
if(!Array.isArray(history))history=[];history=history.filter(v=>typeof v==='string').slice(0,8);
const normalizeVideos=values=>Array.isArray(values)?values.filter(v=>v&&videoId(v.id)&&typeof v.title==='string').map(v=>({...v,position:Math.max(0,Number(v.position)||0),duration:Math.max(0,Number(v.duration)||0)})):[];
let favoriteVideos=normalizeVideos(storage.get('favoriteVideos',[])).slice(0,100);
let watchLater=normalizeVideos(storage.get('watchLater',[])).slice(0,100);
let continueWatching=normalizeVideos(storage.get('continueWatching',[])).slice(0,20);
if(playerSide==='right')document.body.classList.add('passenger');
let libraryMode='',librarySection='continue',activeChannel=null,favoriteBusy=false,channelResults=[],channelFromLibrary=false,channelFromSearch=false,favoriteHydrationBusy=false;
const hydratedFavoriteChannelIds=new Set();
let favoriteChannels=storage.get('favoriteChannels',[]);
if(!Array.isArray(favoriteChannels))favoriteChannels=[];
favoriteChannels=favoriteChannels.filter(c=>c&&typeof c.id==='string'&&/^UC[\w-]{22}$/.test(c.id)&&typeof c.title==='string').slice(0,100);
const uploadsCache=new Map();
let appProfile=storage.get('appProfile','red')==='yellow'?'yellow':'red';
document.body.classList.toggle('aptv-yellow',appProfile==='yellow');
let appendAllowed=true,lastInput='',skipTelex=false;
const pendingAPI=new Map();
let captionsWanted=null,captionsTimer=null;
let items=[],current=null,player=null,playerReady=false,apiPromise=null,query='',nextPage='',requestSerial=0,composing=false,rawInput='',cinema=false,seeking=false,returnFocus=null,controlsTimer=null,lastProgressSavedAt=0;
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
function iconButton(label,icon,pressed,handler){const button=document.createElement('button');button.type='button';button.className='video-action';button.setAttribute('aria-label',label);button.title=label;if(pressed!==null)button.setAttribute('aria-pressed',String(pressed));button.innerHTML=icon;button.onclick=event=>{event.stopPropagation();handler();};return button;}
const starIcon='<span aria-hidden="true">☆</span>',clockIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',bookmarkIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z"/></svg>',removeIcon='<span aria-hidden="true">×</span>';
function card(v,{showActions=true,removeFrom=null}={}){
  const wrapper=document.createElement('article');wrapper.className='video-card';wrapper.dataset.videoId=v.id;
  const button=document.createElement('button');button.type='button';button.className='card card-play';
  const img=document.createElement('img');img.src=`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;img.loading='lazy';img.alt='';
  const title=document.createElement('h3');title.textContent=v.title;button.append(img,title);button.onclick=()=>watch(v,removeFrom==='continue'?v.position:0);
  const channel=document.createElement('button');channel.type='button';channel.className='card-channel';channel.textContent=v.channel||'YouTube';channel.onclick=()=>v.channelId?loadChannel({id:v.channelId,title:v.channel||'Kênh YouTube'}):notice('Chưa có mã kênh để mở trang này.');
  wrapper.append(button,channel);
  if(showActions){
    const actions=document.createElement('div');actions.className='card-actions';
    const favorite=favoriteVideos.some(item=>item.id===v.id);actions.append(iconButton(favorite?'Bỏ video yêu thích':'Lưu video yêu thích',starIcon,favorite,()=>toggleVideoFavorite(v)));
    const later=watchLater.some(item=>item.id===v.id);actions.append(iconButton(later?'Bỏ khỏi Xem sau':'Thêm vào Xem sau',clockIcon,later,()=>toggleWatchLater(v)));
    if(removeFrom)actions.append(iconButton(removeFrom==='continue'?'Bỏ video khỏi Tiếp tục xem':'Bỏ video khỏi Xem sau',removeIcon,null,()=>removeFromList(removeFrom,v.id)));
    wrapper.append(actions);
  }
  return wrapper;
}
function renderCards(target,list,options={}){target.replaceChildren(...list.map(video=>target.id==='queue'?queueCard(video):card(video,options)));}
function queueCard(v){const button=document.createElement('button');button.type='button';button.className='card';const img=document.createElement('img');img.src=`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;img.loading='lazy';img.alt='';const title=document.createElement('h3');title.textContent=v.title;const channel=document.createElement('p');channel.textContent=v.channel||'YouTube';button.append(img,title,channel);button.onclick=()=>watch(v);return button;}
function updateKeywordChipsClass(){document.body.classList.toggle('keyword-has-chips',document.body.classList.contains('keyword-search')&&$('recent-searches').childElementCount>0);}
function renderHistory(){const container=$('recent-searches');container.replaceChildren();history.forEach(term=>{const b=document.createElement('button');b.textContent=term;b.onclick=()=>{$('query').value=term;rawInput=lastInput=term;submit(term);};container.append(b);});updateKeywordChipsClass();}
function placeRecentSearches(nextToHeading){(nextToHeading?$('browse-heading-main'):$('recent-search-slot')).append($('recent-searches'));updateKeywordChipsClass();}
let selectedRailId=null,railModalId=null,railRestoreId=null;
function setRailActive(id){selectedRailId=id;document.querySelectorAll('#app-rail button').forEach(button=>{if(button.id===id)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});}
function enterRailDialog(id){railRestoreId=selectedRailId;railModalId=id;setRailActive(null);$(id).setAttribute('aria-expanded','true');}
function leaveRailDialog(){if(railModalId)$(railModalId).setAttribute('aria-expanded','false');railModalId=null;setRailActive(railRestoreId);railRestoreId=null;}
function browsing(){if(playerReady&&!$('watch').hidden)saveContinueProgress(true);cinema=false;clearTimeout(controlsTimer);document.body.classList.remove('cinema','controls-hidden');if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});$('watch').hidden=true;$('browse').hidden=false;if(playerReady)player.pauseVideo();$('fullscreen').setAttribute('aria-label','Mở rộng video');resize();}
function home(){
  libraryMode='';activeChannel=null;
  setRailActive('home');
  requestSerial++;document.body.classList.add('home-feed');document.body.classList.remove('search-feed','keyword-search');placeRecentSearches(false);$('library-tabs').hidden=true;$('channel-results-section').hidden=true;browsing();query='';nextPage='';items=[];
  $('query').value='';rawInput=lastInput='';$('load-more').hidden=true;
  $('browse-title').textContent='Khám phá trên YouTube';
  $('video-results-heading').hidden=true;renderCards($('results'),[]);renderHistory();$('welcome').hidden=true;
  if(key)popular();else renderHomeFallback();
}
function renderHomeFallback(){
  const box=document.createElement('div');box.className='empty';
  const p=document.createElement('p');p.textContent='Thêm API key để hiển thị danh sách video.';
  const open=document.createElement('a');open.className='button primary';open.href='https://m.youtube.com/';open.textContent='Mở trang chủ YouTube ↗';
  const setup=document.createElement('button');setup.className='secondary';setup.textContent='Thiết lập API key';setup.onclick=openSettings;
  box.append(p,open,setup);$('results').replaceChildren(box);$('load-more').hidden=true;
}
$('home').onclick=home;$('back').onclick=()=>{if(libraryMode==='recent'){showRecent();return;}if(libraryMode==='library'){showLibrary(librarySection);return;}if(libraryMode==='channel'){requestSerial++;browsing();renderCards($('results'),items);$('browse-title').textContent=activeChannel.title;$('load-more').hidden=!nextPage;$('load-more').disabled=false;if(channelFromLibrary)$('library-tabs').hidden=true;return;}requestSerial++;$('load-more').disabled=false;if(items.length){renderCards($('results'),items);$('load-more').hidden=!nextPage;$('browse-title').textContent=query||'Khám phá trên YouTube';browsing();}else if(query&&key)search(query);else home();};$('paste-focus').onclick=()=>openSearch();
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
function mappedChannels(data){return(data.items||[]).map(item=>({id:item.id?.channelId||item.id,title:decode(item.snippet?.title),thumbnail:item.snippet?.thumbnails?.medium?.url||item.snippet?.thumbnails?.default?.url||''})).filter(channel=>/^UC[\w-]{22}$/.test(channel.id||'')&&channel.title);}
function renderChannelCards(list,target=$('channel-results')){
  target.replaceChildren(...list.map(channel=>{
    const row=document.createElement('article');row.className='channel-card';
    row.dataset.channelId=channel.id;
    const open=document.createElement('button');open.type='button';open.className='channel-open';
    const img=document.createElement('img');img.className='channel-avatar';img.src=channel.thumbnail||'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Ccircle cx="32" cy="32" r="32" fill="%232d3034"/%3E%3Ccircle cx="32" cy="23" r="11" fill="%2393989f"/%3E%3Cpath d="M10 60c2-15 10-23 22-23s20 8 22 23" fill="%2393989f"/%3E%3C/svg%3E';img.alt='';
    const title=document.createElement('span');title.className='channel-title';title.textContent=channel.title;
    open.append(img,title);open.onclick=()=>loadChannel(channel);
    const saved=favoriteChannels.some(item=>item.id===channel.id);
    const save=iconButton(saved?'Bỏ kênh yêu thích':'Lưu kênh yêu thích',bookmarkIcon,saved,()=>toggleChannelFavorite(channel));save.classList.add('channel-save');
    row.append(open,save);return row;
  }));
  if(target===$('channel-results'))$('channel-results-section').hidden=!list.length;
}
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
  $('library-tabs').hidden=true;
  document.body.classList.remove('home-feed');document.body.classList.add('search-feed','keyword-search');placeRecentSearches(true);
  const serial=++requestSerial;browsing();$('welcome').hidden=true;$('browse-title').textContent='Đang tìm…';$('load-more').disabled=true;
  $('video-results-heading').hidden=false;
  if(!append){items=[];channelResults=[];renderCards($('results'),[]);renderChannelCards([]);nextPage='';}
  try{
    const videoRequest=api('search',{part:'snippet',type:'video',q:term,maxResults:16,videoEmbeddable:'true',videoSyndicated:'true',relevanceLanguage:'vi',pageToken:append?nextPage:''});
    const channelRequest=append?Promise.resolve(null):api('search',{part:'snippet',type:'channel',q:term,maxResults:8,relevanceLanguage:'vi'});
    const [data,channelData]=await Promise.all([videoRequest,channelRequest]);if(serial!==requestSerial)return;
    if(channelData){channelResults=mappedChannels(channelData);renderChannelCards(channelResults);}
    const seen=new Set(items.map(v=>v.id));items=[...items,...mapped(data).filter(v=>!seen.has(v.id))];nextPage=data.nextPageToken||'';renderCards($('results'),items);$('browse-title').textContent=items.length||channelResults.length?term:'Không tìm thấy kết quả';$('load-more').hidden=!nextPage;history=[term,...history.filter(q=>q!==term)].slice(0,8);storage.set('searches',history);renderHistory();
  }
  catch(error){if(serial===requestSerial){$('browse-title').textContent='Chưa tải được kết quả';notice(error.message);if(!append)renderFallback(term);}}finally{if(serial===requestSerial)$('load-more').disabled=false;}
}
function renderFallback(term){const box=document.createElement('div');box.className='empty';const p=document.createElement('p');p.textContent=key?'Thử tìm trên YouTube hoặc gửi lại tìm kiếm.':'Bật tìm kiếm bằng API key trong Cài đặt, hoặc tìm trực tiếp trên YouTube.';const a=document.createElement('a');a.className='button primary';a.href='https://m.youtube.com/results?search_query='+encodeURIComponent(term);a.textContent='Tìm trên YouTube ↗';const b=document.createElement('button');b.className='secondary';b.textContent='Cài đặt';b.onclick=openSettings;box.append(p,a,b);$('results').replaceChildren(box);$('load-more').hidden=true;}
function submit(term){if(composing)return;term=term.trim();if(!term)return;const id=videoId(term);if(id){closeSearch();watch({id,title:'Video YouTube',channel:'YouTube'});return;}if(/https?:\/\//i.test(term)){notice('Link chưa hợp lệ. Hãy dùng link video youtube.com/watch hoặc youtu.be.');return;}closeSearch();query=term;if(key)search(term);else{history=[term,...history.filter(q=>q!==term)].slice(0,8);storage.set('searches',history);location.assign('https://m.youtube.com/results?search_query='+encodeURIComponent(term));}}
$('search-form').onsubmit=event=>{event.preventDefault();submit($('query').value);};$('load-more').onclick=()=>libraryMode==='channel'?loadChannel(activeChannel,true):query?search(query,true):popular(true);
function loadPlayerAPI(){if(window.YT?.Player)return Promise.resolve();if(apiPromise)return apiPromise;apiPromise=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{apiPromise=null;reject(Error('Chưa tải được player YouTube. Kiểm tra mạng hoặc mở video trên YouTube.'));},15000);window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);resolve();};let script=document.querySelector('script[data-youtube]');if(script)script.remove();script=document.createElement('script');script.dataset.youtube='';script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{clearTimeout(timer);apiPromise=null;reject(Error('Không tải được player YouTube.'));};document.head.append(script);});return apiPromise;}
function updateQueue(){const list=items.filter(v=>v.id!==current?.id);$('queue-title').textContent=query?'Cùng tìm kiếm':'Video khác';renderCards($('queue'),list);if(!list.length){const p=document.createElement('p');p.className='empty';p.textContent='Dùng nút Tìm kiếm bên cạnh để tìm thêm video. Các kết quả sẽ xuất hiện ở đây.';$('queue').append(p);}}
function removeContinueRecord(id){continueWatching=continueWatching.filter(video=>video.id!==id);storage.set('continueWatching',continueWatching);if(libraryMode==='library'&&librarySection==='continue'&&!$('browse').hidden)showLibrary('continue');}
function saveContinueProgress(force=false){
  if(!playerReady||!current)return;
  const now=Date.now();if(!force&&now-lastProgressSavedAt<5000)return;
  let position=0,duration=0;try{position=Math.max(0,player.getCurrentTime()||0);duration=Math.max(0,player.getDuration()||0);}catch{return;}
  if(position<3)return;
  if(duration&&position>=duration-15){continueWatching=continueWatching.filter(video=>video.id!==current.id);storage.set('continueWatching',continueWatching);lastProgressSavedAt=now;return;}
  const entry={...current,position:Math.floor(position),duration:Math.floor(duration),updatedAt:now};
  continueWatching=[entry,...continueWatching.filter(video=>video.id!==current.id)].slice(0,20);
  storage.set('continueWatching',continueWatching);lastProgressSavedAt=now;
}
async function watch(video, startSeconds=0){
  if(playerReady&&current?.id!==video.id)saveContinueProgress(true);requestSerial++;lastProgressSavedAt=0;$('load-more').disabled=false;seeking=false;captionsWanted=false;clearTimeout(captionsTimer);$('cc').disabled=true;if(playerReady)turnCaptionsOff(player);current=video;updatePlayerButtons();$('browse').hidden=true;$('watch').hidden=false;$('video-title').textContent=video.title;$('notice').hidden=true;
  showPlayerControls();
  recent=[video,...recent.filter(v=>v.id!==video.id)].slice(0,20);storage.set('recent',recent);updateQueue();resize();const id=video.id;
  try{await loadPlayerAPI();if(current?.id!==id||$('watch').hidden)return;if(player){if(playerReady)player.loadVideoById({videoId:id,startSeconds});return;}
    player=new YT.Player('player',{videoId:id,width:'100%',height:'100%',playerVars:{start:Math.floor(startSeconds),cc_load_policy:0,playsinline:1,controls:0,fs:0,rel:0,origin:location.origin},events:{onReady:event=>{playerReady=true;$('play').disabled=false;captionsWanted=false;turnCaptionsOff(event.target);syncCaptions();if(current&&current.id!==id)event.target.cueVideoById(current.id);if(!$('watch').hidden)event.target.playVideo();},onApiChange:()=>{if(captionsWanted===false)turnCaptionsOff(player);syncCaptions();},onStateChange:event=>{syncCaptions();$('play').textContent=event.data===1?'Ⅱ':'▶';$('play').setAttribute('aria-label',event.data===1?'Tạm dừng':'Phát video');if(event.data===1){const title=player.getVideoData?.().title;if(title&&current){current={...current,title};$('video-title').textContent=title;recent=recent.map(v=>v.id===current.id?current:v);storage.set('recent',recent);}}if(event.data===2)saveContinueProgress(true);if(event.data===0&&current)removeContinueRecord(current.id);},onError:event=>{const messages={2:'Đường dẫn video không hợp lệ.',5:'APTV không phát được định dạng video này.',100:'Video đã bị xóa hoặc chuyển sang riêng tư.',101:'Chủ video không cho phép phát nhúng.',150:'Chủ video không cho phép phát nhúng.',153:'APTV không gửi thông tin nguồn cần thiết cho YouTube.'};notice(messages[event.data]||'YouTube không phát được video. Video này có thể cần mở trực tiếp trên YouTube.');}}});
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
setInterval(()=>{if(!playerReady||$('watch').hidden)return;const duration=player.getDuration()||0;const elapsed=player.getCurrentTime()||0;$('duration').textContent=timeLabel(duration);$('seek').disabled=!duration;if(!seeking){$('elapsed').textContent=timeLabel(elapsed);$('seek').value=duration?String(elapsed/duration*1000):'0';}if(!document.hidden)saveContinueProgress();},500);
window.addEventListener('pagehide',()=>saveContinueProgress(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)saveContinueProgress(true);});
function resize(){const height=window.visualViewport?.height||innerHeight;const width=window.visualViewport?.width||document.documentElement.clientWidth;const baseRail=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail-width'))||72;const inset=appProfile==='yellow'?baseRail:0;const railWidth=baseRail;const appWidth=Math.max(0,width-(appProfile==='yellow'&&!document.body.classList.contains('passenger')?inset:railWidth+inset));const small=width<=760;const redGrid=Math.max(0,width-baseRail-inset-(small?40:56));const gap=small?10:16;const cols=Math.max(1,Math.floor((redGrid+gap)/((small?112:140)+gap)));const baseCardWidth=(redGrid-(cols-1)*gap)/cols;document.documentElement.style.setProperty('--feed-card-width',Math.min(redGrid,baseCardWidth*1.1)+'px');document.documentElement.style.setProperty('--yellow-card-width',Math.max(44,baseCardWidth*.55)+'px');const yellowLandscape=appProfile==='yellow'&&width>height&&appWidth>=480;const stageWidth=playerSize(appWidth,height,true);document.body.classList.toggle('compact-player',!yellowLandscape&&appWidth<height*16/9+240);const redAppWidth=Math.max(0,width-baseRail-inset);const redQueueWidth=(redAppWidth<height*16/9+240?redAppWidth:redAppWidth-playerSize(redAppWidth,height,true))-32;document.documentElement.style.setProperty('--yellow-queue-width',Math.max(76,redQueueWidth*(small?.24:.21))*.7+'px');document.documentElement.style.setProperty('--player-height',playerSize(appWidth,height,true)*9/16+'px');document.documentElement.style.setProperty('--vh',height+'px');document.documentElement.style.setProperty('--player-width',stageWidth+'px');document.documentElement.style.setProperty('--cinema-width',playerSize(appWidth,height,true)+'px');$('diagnostics').textContent=`Vùng hiển thị: ${Math.round(width)} × ${Math.round(height)} CSS px · Pixel ratio: ${devicePixelRatio} · ${navigator.userAgent}`;}
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
function openSettings(){returnFocus=document.activeElement;enterRailDialog('account');$('settings').querySelector('.dialog-status').hidden=true;$('api-key').value=key;$('settings-form').elements['player-side'].value=playerSide;$('settings-form').elements['app-profile'].value=appProfile;resize();if($('settings').showModal)$('settings').showModal();else $('settings').setAttribute('open','');}
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
$('home').onclick=home;$('open-search').onclick=openSearch;$('account').onclick=openSettings;$('close-search').onclick=closeSearch;$('search-dialog').addEventListener('click',event=>{if(event.target===$('search-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeSearch();}});$('close-settings').onclick=closeSettings;$('settings').addEventListener('click',event=>{if(event.target===$('settings')){const r=$('settings').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeSettings();}});$('premium-link').onclick=()=>{savePlaybackURL();try{sessionStorage.setItem('bmwtube.loginPending','1');}catch{}closeSettings();};$('settings-form').onsubmit=event=>{event.preventDefault();const nextKey=$('api-key').value.trim();const keyChanged=nextKey!==key;key=nextKey;storage.set('key',key);playerSide=$('settings-form').elements['player-side'].value==='right'?'right':'left';storage.set('playerSide',playerSide);document.body.classList.toggle('passenger',playerSide==='right');resize();closeSettings();notice('Đã lưu cài đặt trên trình duyệt này.');if(keyChanged&&$('watch').hidden)query&&key?search(query):home();};$('clear-history').onclick=()=>{recent=[];history=[];continueWatching=[];storage.set('recent',recent);storage.set('searches',history);storage.set('continueWatching',continueWatching);renderHistory();if($('watch').hidden){if(libraryMode==='recent')showRecent();else if(libraryMode==='library'&&librarySection==='continue')showLibrary('continue');else if(!libraryMode)home();}notice('Đã xóa lịch sử BMWTube trên thiết bị.');};

function emptyLibrary(message){const p=document.createElement('p');p.className='empty';p.textContent=message;$('results').replaceChildren(p);}
const libraryTitles={continue:'Tiếp tục xem','watch-later':'Xem sau','favorite-videos':'Video yêu thích','favorite-channels':'Kênh yêu thích'};
function libraryView(mode,title){
  setRailActive(mode==='recent'?'open-recent':mode==='library'||mode==='channel'&&channelFromLibrary?'open-library':mode==='channel'&&channelFromSearch?'open-search':null);
  requestSerial++;libraryMode=mode;query='';nextPage='';items=[];browsing();
  document.body.classList.remove('home-feed','keyword-search');document.body.classList.add('search-feed');placeRecentSearches(false);
  $('library-tabs').hidden=mode!=='library';$('channel-results-section').hidden=true;$('video-results-heading').hidden=true;
  $('library-tabs').querySelectorAll('[data-library]').forEach(button=>{const active=button.dataset.library===librarySection;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  $('browse-title').textContent=title;$('welcome').hidden=true;$('recent-searches').replaceChildren();
  $('load-more').hidden=true;$('load-more').disabled=false;$('results').replaceChildren();
}
function showRecent(){
  libraryView('recent','Đã xem gần đây');items=[...recent];renderCards($('results'),items);
  if(!items.length)emptyLibrary('Chưa có video đã xem trên trình duyệt này.');
}
function showLibrary(section=librarySection){
  librarySection=Object.hasOwn(libraryTitles,section)?section:'continue';
  libraryView('library',libraryTitles[librarySection]);
  if(librarySection==='continue'){
    items=[...continueWatching];renderCards($('results'),items,{removeFrom:'continue'});
    if(!items.length)emptyLibrary('Video bạn bắt đầu xem sẽ xuất hiện ở đây để tiếp tục từ vị trí đã dừng.');
  }else if(librarySection==='watch-later'){
    items=[...watchLater];renderCards($('results'),items,{removeFrom:'watch-later'});
    if(!items.length)emptyLibrary('Bấm biểu tượng đồng hồ trên video để thêm vào Xem sau.');
  }else if(librarySection==='favorite-videos'){
    items=[...favoriteVideos];renderCards($('results'),items);
    if(!items.length)emptyLibrary('Bấm ☆ trên video để lưu video yêu thích.');
  }else showFavoriteChannels();
}
function openLibrary(){showLibrary(librarySection);}
document.querySelectorAll('#library-tabs [data-library]').forEach(button=>button.addEventListener('click',()=>showLibrary(button.dataset.library)));
function removeFromList(listName,id){
  if(listName==='continue')continueWatching=continueWatching.filter(video=>video.id!==id);
  else watchLater=watchLater.filter(video=>video.id!==id);
  storage.set(listName==='continue'?'continueWatching':'watchLater',listName==='continue'?continueWatching:watchLater);
  showLibrary(listName==='continue'?'continue':'watch-later');
}
function toggleVideoFavorite(video){
  if(!video?.id)return;
  const saved=favoriteVideos.some(item=>item.id===video.id);
  favoriteVideos=saved?favoriteVideos.filter(item=>item.id!==video.id):[{...video,position:0,duration:0},...favoriteVideos].slice(0,100);
  storage.set('favoriteVideos',favoriteVideos);updatePlayerButtons();updateRenderedVideoActions(video.id);
  if(libraryMode==='library'&&librarySection==='favorite-videos')showLibrary('favorite-videos');
  notice(saved?'Đã bỏ video yêu thích.':'Đã lưu video yêu thích.');
}
function toggleWatchLater(video){
  if(!video?.id)return;
  const saved=watchLater.some(item=>item.id===video.id);
  watchLater=saved?watchLater.filter(item=>item.id!==video.id):[{...video,position:0,duration:0},...watchLater].slice(0,100);
  storage.set('watchLater',watchLater);updatePlayerButtons();updateRenderedVideoActions(video.id);
  if(libraryMode==='library'&&librarySection==='watch-later')showLibrary('watch-later');
  notice(saved?'Đã bỏ video khỏi Xem sau.':'Đã thêm video vào Xem sau.');
}
async function toggleChannelFavorite(channel){
  if(!channel||favoriteBusy)return;
  favoriteBusy=true;$('favorite-channel').disabled=Boolean(current);const existing=favoriteChannels.some(item=>item.id===channel.id);
  try{
    if(!/^UC[\w-]{22}$/.test(channel.id||''))throw Error('Chưa xác định được mã kênh.');
    if(existing)favoriteChannels=favoriteChannels.filter(item=>item.id!==channel.id);
    else{
      if(favoriteChannels.length>=100)throw Error('Đã lưu 100 kênh. Bỏ bớt một kênh trước khi thêm.');
      let details=channel;
      if(!details.thumbnail&&key){const data=await api('channels',{part:'snippet',id:channel.id});const snippet=data.items?.[0]?.snippet;details={...channel,title:decode(snippet?.title)||channel.title,thumbnail:snippet?.thumbnails?.medium?.url||snippet?.thumbnails?.default?.url||''};}
      favoriteChannels=[{id:details.id,title:details.title||'Kênh YouTube',thumbnail:details.thumbnail||''},...favoriteChannels];
    }
    storage.set('favoriteChannels',favoriteChannels);updateRenderedChannelActions(channel.id);notice(existing?'Đã bỏ kênh yêu thích.':'Đã lưu kênh yêu thích.');
  }catch(error){notice(error.message);}finally{favoriteBusy=false;$('favorite-channel').disabled=false;updatePlayerButtons();if(libraryMode==='library'&&librarySection==='favorite-channels')showLibrary('favorite-channels');}
}
function updateRenderedVideoActions(id){
  document.querySelectorAll('#results .video-card').forEach(wrapper=>{
    if(wrapper.dataset.videoId!==id)return;
    const buttons=wrapper.querySelectorAll('.card-actions .video-action');
    const favorite=buttons[0];if(favorite){const saved=favoriteVideos.some(video=>video.id===id);favorite.innerHTML=saved?'★':'☆';favorite.setAttribute('aria-pressed',String(saved));favorite.title=saved?'Bỏ video yêu thích':'Lưu video yêu thích';favorite.setAttribute('aria-label',favorite.title);}
    const later=buttons[1];if(later){const saved=watchLater.some(video=>video.id===id);later.innerHTML=clockIcon;later.setAttribute('aria-pressed',String(saved));later.title=saved?'Bỏ khỏi Xem sau':'Thêm vào Xem sau';later.setAttribute('aria-label',later.title);}
  });
}
function updateRenderedChannelActions(id){
  document.querySelectorAll('#channel-results .channel-card').forEach(row=>{
    const button=row.querySelector('.channel-save');if(!button||row.dataset.channelId!==id)return;
    const saved=favoriteChannels.some(channel=>channel.id===id);button.setAttribute('aria-pressed',String(saved));button.title=saved?'Bỏ kênh yêu thích':'Lưu kênh yêu thích';button.setAttribute('aria-label',button.title);
  });
}
function showFavoriteChannels(){
  if(!favoriteChannels.length){emptyLibrary('Bấm 🔖 cạnh tên kênh trong player hoặc kết quả tìm kiếm để lưu kênh yêu thích.');return;}
  const rows=favoriteChannels.map(channel=>{
    const row=document.createElement('article');row.className='favorite-channel-row';
    const open=document.createElement('button');open.type='button';open.className='favorite-channel-open';
    const img=document.createElement('img');img.className='channel-avatar';img.src=channel.thumbnail||'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Ccircle cx="32" cy="32" r="32" fill="%232d3034"/%3E%3Ccircle cx="32" cy="23" r="11" fill="%2393989f"/%3E%3Cpath d="M10 60c2-15 10-23 22-23s20 8 22 23" fill="%2393989f"/%3E%3C/svg%3E';img.alt='';
    const title=document.createElement('span');title.className='channel-title';title.textContent=channel.title;open.append(img,title);open.onclick=()=>loadChannel(channel);
    const remove=iconButton('Bỏ kênh yêu thích',bookmarkIcon,true,()=>toggleChannelFavorite(channel));remove.classList.add('channel-save');row.append(open,remove);return row;
  });
  $('results').replaceChildren(...rows);
  hydrateFavoriteChannelLogos();
}
async function hydrateFavoriteChannelLogos(){
  const missing=favoriteChannels.filter(channel=>!channel.thumbnail&&!hydratedFavoriteChannelIds.has(channel.id));
  if(favoriteHydrationBusy||!key||!missing.length)return;
  favoriteHydrationBusy=true;
  try{
    for(let offset=0;offset<missing.length;offset+=50){
      const batch=missing.slice(offset,offset+50);batch.forEach(channel=>hydratedFavoriteChannelIds.add(channel.id));const data=await api('channels',{part:'snippet',id:batch.map(channel=>channel.id).join(',')});
      const details=new Map((data.items||[]).map(item=>[item.id,item.snippet?.thumbnails?.medium?.url||item.snippet?.thumbnails?.default?.url||'']));
      favoriteChannels=favoriteChannels.map(channel=>channel.thumbnail?channel:{...channel,thumbnail:details.get(channel.id)||''});
    }
    storage.set('favoriteChannels',favoriteChannels);
    if(libraryMode==='library'&&librarySection==='favorite-channels'&&!$('browse').hidden)showFavoriteChannels();
  }catch{}finally{favoriteHydrationBusy=false;}
}
async function toggleCurrentChannelFavorite(){
  if(!current)return;
  let channel={id:current.channelId,title:current.channel||'Kênh YouTube',thumbnail:current.channelThumbnail||''};
  try{
    if(!/^UC[\w-]{22}$/.test(channel.id||'')){
      if(!key)throw Error('Thêm API key trong Cài đặt để xác định kênh.');
      const data=await api('videos',{part:'snippet',id:current.id});const snippet=data.items?.[0]?.snippet;
      if(!/^UC[\w-]{22}$/.test(snippet?.channelId||''))throw Error('Chưa xác định được kênh của video.');
      channel={...channel,id:snippet.channelId,title:decode(snippet.channelTitle)||channel.title};
      if(current?.id===data.items?.[0]?.id){current={...current,channelId:channel.id,channel:channel.title};recent=recent.map(video=>video.id===current.id?{...video,channelId:channel.id,channel:channel.title}:video);storage.set('recent',recent);}
    }
    await toggleChannelFavorite(channel);
  }catch(error){notice(error.message);}
}
function updatePlayerButtons(){
  const videoSaved=Boolean(current&&favoriteVideos.some(item=>item.id===current.id));$('favorite-video').textContent=videoSaved?'★':'☆';$('favorite-video').setAttribute('aria-pressed',String(videoSaved));$('favorite-video').title=videoSaved?'Bỏ video yêu thích':'Lưu video yêu thích';$('favorite-video').setAttribute('aria-label',$('favorite-video').title);
  const laterSaved=Boolean(current&&watchLater.some(item=>item.id===current.id));$('watch-later-video').setAttribute('aria-pressed',String(laterSaved));$('watch-later-video').title=laterSaved?'Bỏ khỏi Xem sau':'Thêm vào Xem sau';$('watch-later-video').setAttribute('aria-label',$('watch-later-video').title);
  const channelSaved=Boolean(current?.channelId&&favoriteChannels.some(channel=>channel.id===current.channelId));$('favorite-channel').setAttribute('aria-pressed',String(channelSaved));$('favorite-channel').title=channelSaved?'Bỏ kênh yêu thích':'Lưu kênh yêu thích';$('favorite-channel').setAttribute('aria-label',$('favorite-channel').title);
}
async function loadChannel(channel,append=false){
  if(!key){notice('Thêm API key trong Cài đặt để tải video của kênh yêu thích.');return;}
  if(!append){channelFromLibrary=libraryMode==='library'&&librarySection==='favorite-channels';channelFromSearch=Boolean(query);libraryView('channel',channel.title);activeChannel=channel;}
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
$('open-recent').onclick=showRecent;$('open-library').onclick=openLibrary;$('favorite-video').onclick=()=>toggleVideoFavorite(current);$('watch-later-video').onclick=()=>toggleWatchLater(current);$('favorite-channel').onclick=toggleCurrentChannelFavorite;

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
