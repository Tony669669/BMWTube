// One explicit gesture starts one utterance; stale events never trigger a search.
export function createVoiceSearch({Recognition,secure=true,onState,onText,onSearch}){
  let active=null,timer=null;
  function cancel(message='Đã dừng micro.'){
    const previous=active;active=null;clearTimeout(timer);
    if(previous){try{previous.abort();}catch{}onState(false,message);}
  }
  function start(){
    if(active){cancel();return;}
    if(!secure){onState(false,'Micro cần HTTPS hoặc localhost. Bạn vẫn có thể nhập từ khóa.');return;}
    if(!Recognition){onState(false,'Trình duyệt này chưa hỗ trợ tìm bằng giọng nói. Hãy dùng micro trên bàn phím hoặc nhập từ khóa.');return;}
    let recognition;
    try{recognition=new Recognition();}catch{onState(false,'Không mở được micro. Hãy dùng micro trên bàn phím hoặc nhập từ khóa.');return;}
    active=recognition;
    recognition.lang='vi-VN';recognition.continuous=false;recognition.interimResults=true;recognition.maxAlternatives=1;
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
      const messages={
        'not-allowed':'Chưa được cấp quyền micro. Hãy cho phép micro trong cài đặt trình duyệt rồi thử lại.',
        'service-not-allowed':'Trình duyệt không cho phép nhận giọng nói. Hãy dùng micro trên bàn phím hoặc nhập từ khóa.',
        'audio-capture':'Không truy cập được micro. Kiểm tra micro của thiết bị rồi thử lại.',
        'network':'Không kết nối được dịch vụ nhận giọng nói. Kiểm tra mạng rồi thử lại.',
        'no-speech':'Chưa nghe rõ. Chạm micro để nói lại.',
        'language-not-supported':'Trình duyệt chưa hỗ trợ nhận tiếng Việt. Hãy nhập từ khóa.',
        'aborted':'Đã dừng micro.'
      };
      cancel(messages[event.error]||'Không nhận được giọng nói. Chạm micro để thử lại.');
    };
    recognition.onend=()=>{if(active===recognition)cancel('Chưa nghe rõ. Chạm micro để nói lại.');};
    onState(true,'Đang nghe… Nói tên video bằng tiếng Việt. Chạm micro lần nữa để hủy.');
    timer=setTimeout(()=>cancel('Đã hết thời gian nghe. Chạm micro để thử lại.'),15000);
    try{recognition.start();}catch{cancel('Không khởi động được micro. Kiểm tra quyền micro rồi thử lại.');}
  }
  return {start,cancel};
}
