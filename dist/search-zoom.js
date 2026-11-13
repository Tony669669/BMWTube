// Best-effort WebView recovery after an input-induced zoom, never CSS scaling.
export function createSearchZoomRecovery(win,doc){
  let saved=null,poll=null,release=null,original=null,meta=null;
  function cancel(){
    clearTimeout(poll);clearTimeout(release);poll=release=null;
    if(original!==null&&meta){meta.content=original;original=null;}
    saved=null;
  }
  function capture(){
    cancel();
    const v=win.visualViewport;
    if(!v||!Number.isFinite(v.scale)||v.scale<=0)return;
    saved={scale:v.scale,width:doc.documentElement.clientWidth,height:v.height*v.scale};
  }
  function recover(){
    if(!saved)return;
    const snapshot=saved;saved=null;
    let attempts=0,lastHeight=null;
    function check(){
      poll=null;
      const v=win.visualViewport;
      const focused=doc.activeElement;
      // An orientation change or another edit must not be overridden.
      if(!v||Math.abs(doc.documentElement.clientWidth-snapshot.width)>2||
        focused?.matches('input,textarea,[contenteditable="true"]')||doc.querySelector('#search-dialog')?.open)return;
      if(v.scale<=snapshot.scale+.05)return;
      const height=v.height*v.scale;
      const stable=lastHeight!==null&&Math.abs(height-lastHeight)<2;
      lastHeight=height;
      if(height<snapshot.height*.9||!stable){
        if(++attempts<12)poll=setTimeout(check,100);
        return;
      }
      meta=doc.querySelector('meta[name="viewport"]');
      if(!meta)return;
      original=meta.content;
      const rest=original.split(',').map(s=>s.trim()).filter(s=>! /^(initial-scale|minimum-scale|maximum-scale)\s*=/i.test(s));
      meta.content=[...rest,`initial-scale=${snapshot.scale}`,`minimum-scale=${snapshot.scale}`,`maximum-scale=${snapshot.scale}`].join(', ');
      release=setTimeout(()=>{if(original!==null){meta.content=original;original=null;}release=null;},200);
    }
    poll=setTimeout(check,200);
  }
  return {capture,recover,cancel};
}
