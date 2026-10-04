const tones=['','\u0301','\u0300','\u0309','\u0303','\u0323'];
const toneKeys={s:1,f:2,r:3,x:4,j:5};
const toneRE=/[\u0300\u0301\u0303\u0309\u0323]/g;
function untone(s){return s.normalize('NFD').replace(toneRE,'').normalize('NFC');}
function retone(word,tone){
  const chars=Array.from(untone(word));let indices=[];
  chars.forEach((c,i)=>{if(/[aăâeêioôơuưy]/i.test(c))indices.push(i);});
  if(indices.length>1&&/^qu/i.test(chars.join('')))indices=indices.filter(i=>i!==1);
  if(indices.length>1&&/^gi/i.test(chars.join('')))indices=indices.filter(i=>i!==1);
  if(!indices.length||!tone)return chars.join('');
  const shaped=indices.filter(i=>/[êơ]/i.test(chars[i]));
  let target=shaped.at(-1);
  if(target===undefined){const other=indices.filter(i=>/[ăâôư]/i.test(chars[i]));target=other.at(-1);}
  if(target===undefined){const closed=indices.at(-1)<chars.length-1;target=indices.length===3?indices[1]:indices.length===2?(closed||/^(oa|oe|uy)$/i.test(indices.map(i=>chars[i]).join(''))?indices[1]:indices[0]):indices[0];}
  chars[target]=(chars[target].normalize('NFD')+tones[tone]).normalize('NFC');return chars.join('');
}
export function telexWord(raw){
  let word='',tone=0,lastKey='';
  for(const key of raw){const lower=key.toLowerCase();
    if(lower in toneKeys&&/[aăâeêioôơuưy]/i.test(untone(word))){
      if(lastKey===lower){tone=0;word=untone(word)+key;lastKey='';continue;}
      tone=toneKeys[lower];word=retone(word,tone);lastKey=lower;continue;
    }
    let plain=untone(word);let changed=false;
    if(lower==='d'&&/[dD]$/.test(plain)){plain=plain.slice(0,-1)+(plain.endsWith('D')?'Đ':'đ');changed=true;}
    else if(lower==='d'&&/[đĐ]$/.test(plain)){plain=plain.slice(0,-1)+(plain.endsWith('Đ')?'D':'d')+key;changed=true;}
    else if('aeo'.includes(lower)&&lower){const map={a:'â',e:'ê',o:'ô'};const pattern=new RegExp(lower+'([^aăâeêioôơuưy]*)$','i');if(pattern.test(plain)){plain=plain.replace(pattern,(_,tail)=>{const index=plain.length-tail.length-1;return (plain[index]===plain[index].toUpperCase()?map[lower].toUpperCase():map[lower])+tail;});changed=true;}else if(plain.toLowerCase().endsWith(map[lower])){plain=plain.slice(0,-1)+key+key;changed=true;}}
    else if(lower==='w'){
      if(/uo([^aăâeêioôơuưy]*)$/i.test(plain)){plain=plain.replace(/u(o)([^aăâeêioôơuưy]*)$/i,(match,o,tail)=> (match[0]==='U'?'Ư':'ư')+(o==='O'?'Ơ':'ơ')+tail);changed=true;}
      else if(/[aou]([^aăâeêioôơuưy]*)$/i.test(plain)){plain=plain.replace(/([aou])([^aăâeêioôơuưy]*)$/i,(_,v,tail)=>{const m={a:'ă',o:'ơ',u:'ư'};return(v===v.toUpperCase()?m[v.toLowerCase()].toUpperCase():m[v])+tail;});changed=true;}
    }else if(lower==='z'&&word!==untone(word)){tone=0;changed=true;}
    if(!changed)plain+=key;
    // Preserve native Vietnamese accents when the source already contains them.
    const decomposed=key.normalize('NFD');const mark=decomposed.match(toneRE);if(mark)tone=tones.indexOf(mark[0]);
    word=retone(plain,tone);lastKey=changed?lower:'';
  }return word;
}
export function telex(text){if(/https?:|youtu\.be|youtube\.com/i.test(text))return text;return text.replace(/[a-zÀ-ỹ]+/giu,telexWord);}
export function videoId(value){
  if(typeof value!=='string')return null;
  const s=value.trim();if(/^[\w-]{11}$/.test(s))return s;
  try{const u=new URL(/^https?:\/\//i.test(s)?s:'https://'+s);if(!['https:','http:'].includes(u.protocol))return null;const host=u.hostname.toLowerCase();let id=null;if(host==='youtu.be')id=u.pathname.split('/')[1];else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','www.youtube-nocookie.com','youtube-nocookie.com'].includes(host)){id=u.pathname==='/watch'?u.searchParams.get('v'):/^\/(embed|shorts|live)\//.test(u.pathname)?u.pathname.split('/')[2]:null;}return /^[\w-]{11}$/.test(id||'')?id:null;}catch{return null;}
}
export function timeLabel(seconds){const number=Number(seconds);const s=Number.isFinite(number)?Math.max(0,Math.floor(number)):0;return s>=3600?`${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`:`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
export function playerSize(width,height,cinema=false){const available=Math.max(0,height-(cinema?0:132));return Math.max(0,Math.min(width,available*16/9,cinema?width:Math.max(0,width-260)));}
