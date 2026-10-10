
if (window.__YOREN_ANIMATIONS__) window.__YOREN_ANIMATIONS__.dispose();
const mounted = new Map();
const callbacks = [];
let disposed = false;
let queued = false;
let splashFrame = null;
let splashTimer = null;
let heroSeen = false;
const telemetry = event => {
  if (!disposed) fetch('/yoren-animations/event?name=' + encodeURIComponent(event), {cache:'no-store'}).catch(()=>{});
};
const removeSplash = () => {
  if (!splashFrame) return;
  const old=splashFrame; splashFrame=null;
  old.style.opacity='0'; old.style.pointerEvents='none';
  setTimeout(()=>old.remove(),420);
  clearTimeout(splashTimer);
  telemetry('splash-dismissed');
};
function mountHero(container) {
  const stage=document.createElement('div');
  stage.className='ya-stage';stage.dataset.heroBackdrop='';stage.setAttribute('aria-hidden','true');
  stage.innerHTML='<div class="ya-aura"></div><div class="ya-frame"><img class="ya-poster" src="/yoren-animations/media/poster.webp" alt=""><canvas class="ya-sigil"></canvas><img class="ya-hand" src="/yoren-animations/media/hand.png" alt=""><video class="ya-clip" muted playsinline preload="auto" disablepictureinpicture></video><video class="ya-clip" muted playsinline preload="auto" disablepictureinpicture></video></div><div class="ya-motes"></div><div class="ya-scrim"></div>';
  for (const mote of MOTES) {
    const element=document.createElement('span');element.className='ya-mote'+(mote.rose?' ya-rose':'');
    Object.assign(element.style,{left:mote.left+'%',width:mote.size+'px',height:mote.size+'px'});
    element.style.setProperty('--mote-dur',mote.dur+'s');element.style.setProperty('--mote-delay',-mote.delay+'s');
    stage.querySelector('.ya-motes').append(element);
  }
  container.dataset.yorenHero='';container.prepend(stage);
  const stops=[];const videos=stage.querySelectorAll('video');
  try {
    const still=matches('(prefers-reduced-motion: reduce)');
    stops.push(startSigil(stage,stage.querySelector('canvas'),stage.querySelector('.ya-hand'),still));
    if(!still)stops.push(startClips(stage,videos[0],videos[1]));
  } catch(error) { console.warn('Yoren animations: poster fallback',error);telemetry('hero-fallback'); }
  let reported=false;
  const playing=()=>{if(!reported){reported=true;telemetry('hero-playing');}};
  for(const video of videos)video.addEventListener('playing',playing);
  mounted.set(container,()=>{for(const stop of stops)stop();for(const video of videos)video.removeEventListener('playing',playing);stage.remove();delete container.dataset.yorenHero;});
  heroSeen=true;telemetry('hero-mounted');
}
function sync(){
  queued=false;if(disposed)return;
  for(const [container,stop] of mounted)if(!container.isConnected||container.dataset.contentPhase!=='hero'){stop();mounted.delete(container);}
  for(const container of document.querySelectorAll('[data-conversation-content][data-content-phase="hero"]'))if(!mounted.has(container))mountHero(container);
  if(splashFrame&&document.querySelector('[data-conversation-content]'))splashFrame.contentWindow?.postMessage({yorenAnimations:'loaded'},location.origin);
}
const observer=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(sync);}});
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-content-phase']});
const receive=event=>{
  if(!splashFrame||event.source!==splashFrame.contentWindow||event.origin!==location.origin)return;
  if(event.data?.yorenAnimations==='ready')sync();
  if(event.data?.yorenAnimations==='playing')telemetry('splash-playing');
  if(event.data?.yorenAnimations==='leave')removeSplash();
};
window.addEventListener('message',receive);
const key=event=>{if(event.key==='Escape'&&splashFrame){event.preventDefault();removeSplash();}};
window.addEventListener('keydown',key);
// One overlay per renderer document. Reloading the page intentionally replays it.
if(!matches('(prefers-reduced-motion: reduce)')){
  splashFrame=document.createElement('iframe');splashFrame.title='DeepSeek 入场动画（Esc 可跳过）';
  splashFrame.src='/yoren-animations/splash/index.html';
  Object.assign(splashFrame.style,{position:'fixed',inset:'0',width:'100%',height:'100%',border:'0',zIndex:'2147483000',background:'#0a0d12',transition:'opacity .4s',opacity:'1'});
  document.body.append(splashFrame);
  splashTimer=setTimeout(removeSplash,25000);
}
sync();telemetry('client-ready');
const compatibilityTimer=setTimeout(()=>{if(!heroSeen&&!document.querySelector('[data-conversation-content]'))telemetry('selector-unavailable');},30000);
window.__YOREN_ANIMATIONS__={version:'1.0.0',get mounted(){return mounted.size;},dispose(){
  removeSplash();disposed=true;clearTimeout(compatibilityTimer);observer.disconnect();
  window.removeEventListener('message',receive);window.removeEventListener('keydown',key);
  for(const stop of mounted.values())stop();mounted.clear();
}};
