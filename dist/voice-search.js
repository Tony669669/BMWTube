// One explicit gesture starts one utterance; stale events never trigger a search.
export function createVoiceSearch({Recognition,secure=true,requestMicrophone,onState,onText,onSearch}){
  let active=null,timer=null,needsPermissionCheck=false,microphoneOpened=false;
  function cancel(message='Chạm micro để nói'){
    const previous=active;active=null;clearTimeout(timer);
    if(previous){try{previous.abort();}catch{}onState(false,message);}
  }
  async function checkMicrophone(){
    const attempt={abort(){}};active=attempt;
    onState(true,'Đang xin quyền micro…','starting');
    timer=setTimeout(()=>{if(active===attempt)cancel('Chưa nhận được phản hồi cấp quyền. Chạm micro để thử lại.');},15000);
    try{
      const stream=await requestMicrophone({audio:true,video:false});
      // Always release capture, including late permission grants after cancellation.
      const tracks=stream.getTracks();
      const hasAudio=stream.getAudioTracks().some(track=>track.readyState==='live');
      tracks.forEach(track=>track.stop());
      if(active!==attempt)return;
      if(!hasAudio){cancel('Không có âm thanh từ micro. Kiểm tra micro của thiết bị.');return;}
      microphoneOpened=true;needsPermissionCheck=false;
      cancel('Đã mở được micro. Chạm micro lần nữa để nói.');
    }catch(error){
      if(active!==attempt)return;
      const messages={
        NotAllowedError:'Ứng dụng hoặc hệ thống chặn micro (NotAllowedError). Website không tự cấp quyền được.',
        SecurityError:'Ứng dụng không cho trang web truy cập micro (SecurityError).',
        NotFoundError:'Không tìm thấy micro trên thiết bị (NotFoundError).',
        NotReadableError:'Không mở được micro; có thể đang bị ứng dụng khác sử dụng (NotReadableError).'
      };
      cancel(messages[error?.name]||'Không mở được micro. Chạm micro để thử lại hoặc dùng bàn phím.');
    }
  }
  function start(){
    if(active){cancel();return;}
    if(!secure){onState(false,'Micro cần HTTPS hoặc localhost. Bạn vẫn có thể nhập từ khóa.');return;}
    if(!Recognition){onState(false,'Trình duyệt này chưa hỗ trợ tìm bằng giọng nói. Hãy dùng micro trên bàn phím hoặc nhập từ khóa.');return;}
    if(needsPermissionCheck&&requestMicrophone)return checkMicrophone();
    let recognition;
    try{recognition=new Recognition();}catch{onState(false,'Không mở được micro. Hãy dùng micro trên bàn phím hoặc nhập từ khóa.');return;}
    active=recognition;
    recognition.lang='vi-VN';recognition.continuous=false;recognition.interimResults=true;recognition.maxAlternatives=1;
    recognition.onstart=()=>{
      if(active===recognition)onState(true,'Đang nghe…','listening');
    };
    recognition.onresult=event=>{
      if(active!==recognition)return;
      const results=Array.from(event.results);
      const text=results.map(result=>result[0]?.transcript||'').join(' ').trim();
      if(!text)return;
      onText(text);
      if(results.length&&results.every(result=>result.isFinal)){
        cancel('Đã nhận: '+text);
        onSearch(text);
      }
    };
    recognition.onerror=event=>{
      if(active!==recognition)return;
      if(event.error==='not-allowed'||event.error==='service-not-allowed'){
        needsPermissionCheck=Boolean(requestMicrophone)&&!microphoneOpened;
        cancel(microphoneOpened
          ?'Đã mở được micro nhưng nhận giọng nói bị chặn ('+event.error+'). Thử micro bàn phím.'
          :needsPermissionCheck
            ?'Nhận giọng nói bị chặn. Chạm micro lần nữa để thử cấp quyền.'
            :'Trình duyệt chặn nhận giọng nói và không có cách xin quyền micro trực tiếp. Thử micro bàn phím.');
        return;
      }
      const messages={
        'audio-capture':'Không truy cập được micro. Kiểm tra micro của thiết bị rồi thử lại.',
        'network':'Không kết nối được dịch vụ nhận giọng nói. Kiểm tra mạng rồi thử lại.',
        'no-speech':'Chưa nghe rõ, thử lại.',
        'language-not-supported':'Trình duyệt chưa hỗ trợ nhận tiếng Việt. Hãy nhập từ khóa.',
        'aborted':'Đã dừng micro.'
      };
      cancel(messages[event.error]||'Không nhận được giọng nói. Chạm micro để thử lại.');
    };
    recognition.onend=()=>{if(active===recognition)cancel('Chưa nghe rõ, thử lại.');};
    onState(true,'Đang mở micro…','starting');
    timer=setTimeout(()=>cancel('Đã hết thời gian nghe. Chạm micro để thử lại.'),15000);
    try{recognition.start();}catch(error){
      if(error?.name==='NotAllowedError'||error?.name==='SecurityError')recognition.onerror({error:'not-allowed'});
      else cancel('Không khởi động được micro. Kiểm tra quyền micro rồi thử lại.');
    }
  }
  return {start,cancel};
}
