/* Old Games Archive browser host protocol v1. GPL-2.0-or-later. */
(() => {
 const query=new URLSearchParams(location.search);
 if(query.get('embedded')!=='1'||parent===window)return;
 let origin;
 try{origin=new URL(query.get('host')).origin;const u=new URL(origin);
  if(!(['https://oldgamesarchive.org','https://preview.oldgamesarchive.org'].includes(origin)||
   (u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))))return;
 }catch{return;}
 document.documentElement.classList.add('embedded');
 const send=(type,extra={})=>parent.postMessage({source:'oldgames-native',version:1,type,...extra},origin);
 const keys={265:82,264:81,263:80,262:79,257:40,256:41,258:43,259:42,32:44,
  341:224,345:228,342:226,346:230,340:225,344:229,335:88};
 for(let i=0;i<26;i++)keys[65+i]=4+i;
 for(let i=1;i<=9;i++)keys[48+i]=29+i;keys[48]=39;
 for(let i=0;i<12;i++)keys[290+i]=58+i;
 for(let i=1;i<=9;i++)keys[320+i]=88+i;keys[320]=98;
 let initialized=false;
 const init=Module.onRuntimeInitialized;
 Module.onRuntimeInitialized=()=>{init();initialized=true;send('ready');if(document.hidden)setPaused(true);};
 const done=Module.onGameStopped;Module.onGameStopped=()=>{done();send('stopped');};
 const abort=Module.onAbort;Module.onAbort=()=>{abort();send('error');};
 const pause=setPaused;
 setPaused=value=>{pause(value);if(initialized)send(value?'paused':'running');};
 addEventListener('message',event=>{
  const m=event.data;
  if(event.source!==parent||event.origin!==origin||!m||m.source!=='oldgames-player'||m.version!==1||!initialized||stopped)return;
  if(m.type==='sound'&&typeof m.muted==='boolean')setMuted(m.muted);
  if(m.type==='key'&&Number.isInteger(m.key)&&typeof m.down==='boolean'&&keys[m.key]!==undefined&&!paused){
   if(keys[m.key]===40&&m.down&&lastScene===1&&!localMenu){startSolo();return;}
   Module._oga_key(keys[m.key],m.down?1:0);
  }
  if(m.type==='release')releaseAll();
  if(m.type==='pause')setPaused(true);
  if(m.type==='resume'&&!document.hidden)setPaused(false);
  if(m.type==='focus')canvas.focus({preventScroll:true});
  if(m.type==='dispose'){releaseAll();Module._oga_stop();}
 });
 start.click();
})();
