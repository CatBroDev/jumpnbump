import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const lab=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(process.env.JNB_TEST_REQUIRE_FROM || import.meta.url);
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const run=path.join(lab,'build/test-evidence',process.argv[2]||`accept-${Date.now()}`);
await fs.mkdir(run,{recursive:true});
const build=path.join(lab,'build/web');
const server=http.createServer(async(req,res)=>{try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
  const file=path.resolve(build,'.'+(pathname==='/'?'/index.html':pathname));
  assert(file.startsWith(build+path.sep));
  res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm'}[path.extname(file)]||'application/octet-stream','X-Robots-Tag':'noindex','Cache-Control':'no-store'});
  res.end(await fs.readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=process.env.JNB_TEST_URL||`http://127.0.0.1:${server.address().port}/`;
let browser,page;const logs=[],errors=[],results=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const snap=()=>page.evaluate(()=>JSON.parse(Module.UTF8ToString(Module._oga_state())));
async function waitScene(scene,timeout=15000){await page.waitForFunction(s=>typeof ready!=='undefined'&&ready&&Module._oga_state&&JSON.parse(Module.UTF8ToString(Module._oga_state())).scene===s,scene,{timeout});return snap();}
async function key(name,ms=150){await page.keyboard.down(name);await delay(ms);await page.keyboard.up(name);}
try{
  browser=await chromium.launch({headless:true,channel:process.env.JNB_TEST_BROWSER_CHANNEL||undefined,args:['--mute-audio']});
  const context=await browser.newContext({viewport:{width:1000,height:850},hasTouch:true});
  page=await context.newPage();page.on('response',r=>{if(r.status()>=400)logs.push({type:'http-error',url:r.url(),status:r.status()});});page.on('console',m=>{logs.push({type:m.type(),text:m.text()});if(m.type()==='error')errors.push(m.text());});page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url);await page.locator('#start').click();
  results.push({check:'original-menu',state:await waitScene(1)});
  // Verify actual player identity, not just that some rabbit or key moved.
  await delay(1200);
  assert.equal(await page.locator('#player-hint').count(),0);
  assert.equal(await page.locator('#help tbody tr').count(),4);
  await page.locator('#local').click();
  const canvasBox=await page.locator('#canvas').boundingBox();
  for(const button of ['left','middle','right']){
    const before=await snap();
    await page.mouse.move(canvasBox.x+canvasBox.width/2,canvasBox.y+canvasBox.height/2);
    await page.mouse.down({button});await delay(220);const during=await snap();await page.mouse.up({button});
    assert.deepEqual(during.players,before.players,'Canvas clicks must not steer the grey rabbit or any player');
    results.push({check:'canvas-click-does-not-steer-another-player',button,before:before.players,after:during.players,passed:true});
  }
  for(const input of ['keyboard','mouse','touch']){
    await delay(900);const before=await snap();let cdp;
    await page.locator('#touch').scrollIntoViewIfNeeded();
    const jump=await page.locator('#jump').boundingBox();
    if(input==='keyboard'){await page.locator('#canvas').focus();await page.keyboard.down('ArrowUp');}
    if(input==='mouse'){await page.mouse.move(jump.x+jump.width/2,jump.y+jump.height/2);await page.mouse.down();}
    if(input==='touch'){
      cdp=await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:jump.x+jump.width/2,y:jump.y+jump.height/2,id:1}]});
    }
    await delay(180);const during=await snap();
    assert(during.players[0].y<before.players[0].y,'Jump must move white rabbit / player 0');
    assert.deepEqual(during.players.slice(1),before.players.slice(1),'Jump must not control another rabbit');
    if(input==='keyboard')await page.keyboard.up('ArrowUp');
    if(input==='mouse')await page.mouse.up();
    if(input==='touch'){await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await cdp.detach();}
    await page.waitForFunction(()=>Module._oga_key_held(82)===0,null,{timeout:1500});
    assert.equal(await page.evaluate(()=>Module._oga_key_held(82)),0);
    results.push({check:'jump-controls-only-white-rabbit',input,before:before.players,after:during.players,passed:true});
  }
  await delay(900);
  const greyBefore=await snap();await page.locator('#canvas').focus();await page.keyboard.down('i');await delay(180);const greyAfter=await snap();await page.keyboard.up('i');
  assert(greyAfter.players[2].y<greyBefore.players[2].y);assert.deepEqual(greyAfter.players[0],greyBefore.players[0]);
  results.push({check:'grey-rabbit-retains-local-multiplayer-keys',passed:true});
  await delay(900);await page.screenshot({path:path.join(run,'player-identity.png'),fullPage:true});
  await page.locator('#choose-mode').click();await page.locator('#solo').click();let state=await waitScene(2);await delay(2500);state=await snap();
  assert.deepEqual(state.players.map(p=>p.enabled),[1,1,1,1]);assert.deepEqual(state.players.map(p=>p.ai),[0,1,1,1]);assert.equal(state.muted,1);
  results.push({check:'solo-existing-ai',state});
  const p0=state.players[0];await page.locator('#canvas').focus();await page.keyboard.down('ArrowLeft');await page.keyboard.down('ArrowUp');await delay(450);state=await snap();results.push({check:'movement-debug',state,held:await page.evaluate(()=>[80,82].map(k=>Module._oga_key_held(k)))});await page.keyboard.up('ArrowLeft');await page.keyboard.up('ArrowUp');assert(state.players[0].x!==p0.x||state.players[0].y!==p0.y);
  results.push({check:'keyboard-movement',before:p0,after:state.players[0]});
  await page.locator('#pause').click();await delay(300);const paused=await snap();await delay(450);const paused2=await snap();assert.deepEqual(paused2.players,paused.players);assert.equal(paused2.ticks,paused.ticks);assert.equal(paused.paused,1);
  await page.locator('#pause').click();await delay(350);assert((await snap()).ticks>paused.ticks);results.push({check:'pause-resume',paused,passed:true});
  for(const width of [320,390,412]){
    await page.setViewportSize({width,height:850});await delay(250);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('#touch').scrollIntoViewIfNeeded();
    const points=await page.evaluate(()=>[79,82].map((k,i)=>{const b=document.querySelector(`#touch [data-key="${k}"]`).getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2,id:i+1};}));
    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});await delay(250);
    const held=await page.evaluate(()=>[79,82].map(k=>Module._oga_key_held(k)));assert.deepEqual(held,[1,1]);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(100);
    assert.deepEqual(await page.evaluate(()=>[79,82].map(k=>Module._oga_key_held(k))),[0,0]);
    await page.screenshot({path:path.join(run,`mobile-${width}.png`),fullPage:true});
    results.push({check:'multitouch-and-layout',width,held,passed:true});await cdp.detach();
  }
  await page.setViewportSize({width:844,height:390});await delay(200);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(run,'landscape.png'),fullPage:true});
  // Headless focus is emulated: dispatch the browser blur handler, and verify a real held keyboard key is released.
  await page.locator('#canvas').focus();await page.keyboard.down('ArrowRight');await delay(150);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await delay(250);state=await snap();assert.equal(state.paused,1);assert.equal(await page.evaluate(()=>Module._oga_key_held(79)),0);await page.keyboard.up('ArrowRight');
  await page.locator('#pause').click();results.push({check:'blur-handler-releases-input',passed:true});
  await page.evaluate(()=>{Module._oga_key(511,1);Module._oga_key(99999,1);Module._oga_key(-1,1);Module._oga_release_all();});
  assert.equal(await page.evaluate(()=>Module._oga_key_held(511)),0);results.push({check:'scancode-bounds',passed:true});
  await page.locator('#sound').click();assert.equal((await snap()).muted,0);await page.locator('#sound').click();assert.equal((await snap()).muted,1);results.push({check:'sound-toggle',passed:true});
  await page.waitForFunction(()=>JSON.parse(Module.UTF8ToString(Module._oga_state())).players.some(p=>p.score>0),null,{timeout:45000});
  state=await snap();results.push({check:'natural-collision-and-scoring',state});
  await page.locator('#canvas').focus();await key('Escape',200);state=await waitScene(3);assert(state.players.some(p=>p.score>0));
  const samples=[];let consecutive=0;
  for(let i=0;i<15&&consecutive<3;i++){
    await delay(250);
    const bytes=await page.locator('#canvas').screenshot();const image=PNG.sync.read(bytes);
    let visiblePixels=0;for(let n=0;n<image.data.length;n+=4)if(Math.max(image.data[n],image.data[n+1],image.data[n+2])>50)visiblePixels++;
    samples.push(visiblePixels);consecutive=visiblePixels>300?consecutive+1:0;
    if(consecutive===3)await fs.writeFile(path.join(run,'results-canvas.png'),bytes);
  }
  results.push({check:'original-results-table',state:await snap(),visiblePixelSamples:samples});
  assert.equal(consecutive,3,'Score table must remain visibly rendered after palette fade-in');
  await delay(1500);
  const persistentBytes=await page.locator('#canvas').screenshot();const persistentImage=PNG.sync.read(persistentBytes);
  let persistentPixels=0;for(let n=0;n<persistentImage.data.length;n+=4)if(Math.max(persistentImage.data[n],persistentImage.data[n+1],persistentImage.data[n+2])>50)persistentPixels++;
  assert(persistentPixels>300,'Score table must still be visible after the initial fade');
  await fs.writeFile(path.join(run,'results-persistent.png'),persistentBytes);results.push({check:'score-display-persists',visiblePixels:persistentPixels,passed:true});
  await page.screenshot({path:path.join(run,'results.png')});
  await key('Escape',200);await waitScene(1);await page.locator('#solo').click();state=await waitScene(2);assert.deepEqual(state.players.map(p=>p.score),[0,0,0,0]);results.push({check:'second-round-resets-score',state});
  // Verify the retained local multiplayer entry via original keyboard input.
  await key('Escape',200);await waitScene(3);await key('Escape',200);await waitScene(1);
  await page.locator('#local').click();
  await page.locator('#canvas').focus();await page.keyboard.down('ArrowRight');await page.keyboard.down('ArrowUp');await page.keyboard.down('d');await page.keyboard.down('w');
  for(let i=0;i<7&&(await snap()).scene!==2;i++){
    await delay(900);await page.keyboard.up('ArrowUp');await page.keyboard.up('w');await delay(100);
    await page.keyboard.down('ArrowUp');await page.keyboard.down('w');
  }
  for(const k of ['ArrowRight','ArrowUp','d','w'])await page.keyboard.up(k);
  state=await waitScene(2);assert(state.players[0].enabled&&state.players[1].enabled);assert(state.players.every(p=>p.ai===0));results.push({check:'original-local-multiplayer-menu',state});
  await key('Escape',200);await waitScene(3);await key('Escape',200);await waitScene(1);await key('Escape',200);await page.waitForFunction(()=>stopped===true);assert(await page.locator('#start').isVisible());results.push({check:'menu-exit-and-reload-offer',passed:true});
  await context.close();
  const zh=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});page=await zh.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.goto(url+(url.includes('?')?'&':'?')+'lang=zh-cn');await page.locator('#start').click();await waitScene(1);await page.locator('#solo').click();await waitScene(2);assert(await page.evaluate(()=>document.documentElement.lang==='zh-CN'&&document.documentElement.scrollWidth<=innerWidth+1));await delay(1000);await page.screenshot({path:path.join(run,'zh-mobile.png'),fullPage:true});await zh.close();results.push({check:'chinese-ui-layout',passed:true});
  assert.deepEqual(errors,[]);results.push({check:'acceptance',passed:true});
}catch(e){results.push({check:'acceptance',passed:false,error:String(e)});process.exitCode=1;if(page&&!page.isClosed())await page.screenshot({path:path.join(run,'failure.png'),fullPage:true}).catch(()=>{});}
finally{await browser?.close();await new Promise(r=>server.close(r));await fs.writeFile(path.join(run,'results.json'),JSON.stringify({url,results,errors,logs},null,2));console.log(JSON.stringify({run,results,errors},null,2));}
