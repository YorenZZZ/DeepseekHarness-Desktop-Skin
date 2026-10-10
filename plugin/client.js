(function(){

/**
 * Full-bleed backdrop for the new-session page: the silver-sword knight
 * redrawn as a 3D render, alive through short generated clips that all start
 * and end on the same frame (the poster), played in random order, never the
 * same clip twice in a row: idling — breathing, hair, scarf and whale tail in
 * the wind, the palm sigil turning — a narrowed, glowing glare, a turn of the
 * sword as its edge flares, or a surge of the sigil lifting her hair and scarf
 * (the files keep their first names: wink, lean, toss). Two video elements double-buffer;
 * the next clip waits cued on its first used frame and takes over, timed to
 * the presented frame, just as the current one reaches its last, with a brief
 * blend over the matching pose. The clips
 * come from the host route the package registers (`/hero-knight/`); until
 * they load, or without them, the poster stands in, and the sigil in her left
 * palm is drawn live: a vector disc in the tilted plane of her palm whose
 * rings, runes, ticks and star turn at their own speeds (the painted sigil is
 * retouched out of the poster), passing behind her fingertips. Decorative:
 * hidden from the accessibility tree, no pointer events; reduced motion keeps
 * the poster and a still sigil.
 */

const MEDIA = '/yoren-animations/media/'
const FPS = 24
/**
 * The frames of each clip that play, measured on the shipped encodes. Every
 * clip opens and closes on the poster pose, so a clip's first frame repeats
 * the previous clip's last and is skipped. The sword and surge clips settle
 * early and then stand frozen for most of a second, which reads as a stall
 * before the idle moves again, so they hand over where the freeze begins; the
 * sword clip also opens on four still frames.
 */
const CLIPS = {
  'idle.mp4': { from: 1, to: 144 },
  'wink.mp4': { from: 1, to: 120 },
  'lean.mp4': { from: 4, to: 98 },
  'toss.mp4': { from: 1, to: 125 },
}         
                              
const IDLE       = 'idle.mp4'
const ALL = Object.keys(CLIPS)          
/** Frames before a clip's last used frame when the next one is started, to
 * cover the time `play()` takes to get going. */
const LEAD = 2
/** Seconds the incoming clip takes to fade in (hero.css). The outgoing element
 * is reused only after it has faded out underneath. */
const BLEND = 0.2

/** Media query check that tolerates environments without matchMedia. */
function matches(query        ) {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches
}

/**
 * Drive the two video elements until disposed, each next clip picked at
 * random from the ones other than the clip playing.
 */
function startClips(stage             , a                  , b                  ) {
  let disposed = false
  let front = a
  let back = b
  /** `play()` has been asked of the back element and has not settled yet. */
  let handing = false
  /** The front clip is done but the back one was not cued yet. */
  let due = false
  let watching = 0
  let queued = 0
  const frameTimed = typeof a.requestVideoFrameCallback === 'function'

  const nameOf = (video                  ) => (video.dataset.clip ?? IDLE)        
  const clipOf = (video                  ) => CLIPS[nameOf(video)] ?? CLIPS[IDLE]
  const nextClip = (playing       )       => {
    const choices = ALL.filter(clip => clip !== playing)
    return choices[Math.floor(Math.random() * choices.length)] ?? IDLE
  }

  const load = (video                  , clip      ) => {
    video.dataset.clip = clip
    delete video.dataset.cued
    video.src = MEDIA + clip
    video.load()
  }
  const cued = (video                  ) => 'cued' in video.dataset && !video.seeking && video.readyState >= 3

  // Hand over to the back clip, cued on its first used frame: it fades in
  // above while the outgoing clip plays its last frames and holds the pose.
  const handOff = () => {
    if (disposed || handing) return
    if (!cued(back)) {
      due = true
      return
    }
    due = false
    handing = true
    const incoming = back
    const outgoing = front
    void incoming.play().then(() => {
      handing = false
      if (disposed) return
      incoming.dataset.front = ''
      delete outgoing.dataset.front
      front = incoming
      back = outgoing
      watch(incoming)
      // Queue the following clip once the outgoing element has faded out.
      window.clearTimeout(queued)
      queued = window.setTimeout(() => {
        if (disposed) return
        outgoing.pause()
        load(outgoing, nextClip(nameOf(incoming)))
      }, BLEND * 2000 + 100)
    }, () => {
      handing = false
    })
  }
  const reached = (video                  , time        ) => {
    if (video === front && time * FPS + 0.01 >= clipOf(video).to - LEAD) handOff()
  }
  // Follow the front clip frame by frame as it is presented; `timeupdate`
  // (a few times a second) is only the fallback.
  const watch = (video                  ) => {
    if (!frameTimed) return
    const token = ++watching
    const step = (_now        , frame                            ) => {
      if (disposed || token !== watching) return
      reached(video, frame.mediaTime)
      video.requestVideoFrameCallback(step)
    }
    video.requestVideoFrameCallback(step)
  }

  const onMeta = (event       ) => {
    const video = event.currentTarget                    
    // The first clip starts playing at once from the poster frame; a queued
    // clip waits on its first used frame.
    if (video.paused) video.currentTime = (clipOf(video).from + 0.5) / FPS
    else video.dataset.cued = ''
  }
  const onSeeked = (event       ) => {
    const video = event.currentTarget                    
    video.dataset.cued = ''
    if (video === back && due) handOff()
  }
  const onReady = (event       ) => {
    if (event.currentTarget === back && due) handOff()
  }
  const onTime = (event       ) => {
    const video = event.currentTarget                    
    if (!frameTimed) reached(video, video.currentTime)
  }
  // A clip that ran out before the next was cued holds its last frame (it
  // matches the poster); the hand-over happens as soon as the next is cued.
  const onEnded = (event       ) => {
    if (event.currentTarget === front) handOff()
  }
  const onPlaying = () => {
    stage.dataset.playing = ''
  }

  for (const video of [a, b]) {
    video.muted = true
    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('canplay', onReady)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('ended', onEnded)
    video.addEventListener('playing', onPlaying)
  }

  const seen = new IntersectionObserver(([entry]) => {
    if (!(entry?.isIntersecting ?? true)) front.pause()
    else if (front.ended) handOff()
    else void front.play().catch(() => {})
  })
  seen.observe(stage)

  front.dataset.front = ''
  const first = nextClip()
  load(front, first)
  load(back, nextClip(first))
  void front.play().catch(() => {})
  watch(front)

  return () => {
    disposed = true
    window.clearTimeout(queued)
    seen.disconnect()
    for (const video of [a, b]) {
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('canplay', onReady)
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('playing', onPlaying)
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }
}

/** Poster pixel frame the sigil and hand coordinates are measured in. */
const POSTER = { w: 2304, h: 1728 }
/** The palm sigil: centre, outer radius, the major-axis angle of its tilted
 * disc and the minor/major ratio of that ellipse. */
const SIGIL = { x: 1460, y: 745, r: 83, angle: (-21 * Math.PI) / 180, squash: 0.86 }
/** Where the fingertip mask (knight3d-hand.png) sits on the poster. */
const HAND = { x: 1220, y: 545, w: 480, h: 400 }

/** Small deterministic generator so the runes and rays never reshuffle. */
function seeded(seed        ) {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
}

const RUNES = (() => {
  const random = seeded(7)
  return Array.from({ length: 18 }, () => Array.from({ length: 2 + Math.floor(random() * 3) }, () =>
    [random() - 0.5, random() - 0.5, random() - 0.5, random() - 0.5]         ))
})()
const RAYS = (() => {
  const random = seeded(11)
  return Array.from({ length: 28 }, (_, index) => ({
    angle: (index / 28) * Math.PI * 2 + random() * 0.12, length: 0.06 + random() * 0.28, phase: random() * 6.28,
  }))
})()
const SPARKS = (() => {
  const random = seeded(23)
  return Array.from({ length: 22 }, () => ({
    angle: random() * 6.28, radius: 0.85 + random() * 0.6, speed: 0.2 + random() * 0.5,
    size: 0.012 + random() * 0.02, phase: random() * 6.28,
  }))
})()

/**
 * Draw the sigil into `canvas` (laid over the contained poster) until
 * disposed; one still frame when `still`. Hidden while a clip plays — the
 * clips carry their own sigil, moving with her hand.
 */
function startSigil(stage             , canvas                   , hand                  , still         ) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  let disposed = false
  let frame = 0
  let visible = true
  let ratio = 1
  let width = 0
  let height = 0

  const resize = () => {
    const rect = canvas.getBoundingClientRect()
    ratio = Math.min(window.devicePixelRatio || 1, 2)
    width = rect.width
    height = rect.height
    canvas.width = Math.max(1, Math.round(width * ratio))
    canvas.height = Math.max(1, Math.round(height * ratio))
  }

  const draw = (now        ) => {
    const t = now / 1000
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if ('playing' in stage.dataset || width === 0) return
    const k = Math.min(width / POSTER.w, height / POSTER.h)
    const left = (width - POSTER.w * k) / 2
    const top = (height - POSTER.h * k) / 2
    const radius = SIGIL.r * k * ratio
    const cos = Math.cos(SIGIL.angle)
    const sin = Math.sin(SIGIL.angle)
    // The disc's own plane: rotating inside it is a true turn in perspective.
    ctx.setTransform(cos * radius, sin * radius, -sin * radius * SIGIL.squash, cos * radius * SIGIL.squash,
      (left + SIGIL.x * k) * ratio, (top + SIGIL.y * k) * ratio)
    const px = 1 / radius
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.2)
    const ink = (alpha        ) => `rgba(110, 240, 255, ${alpha})`
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'
    ctx.shadowColor = 'rgba(60, 230, 255, 0.9)'
    ctx.shadowBlur = 10 * ratio
    const ring = (r        , line        , alpha        ) => {
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.lineWidth = line * px
      ctx.strokeStyle = ink(alpha)
      ctx.stroke()
    }
    const turn = (angle        , paint            ) => {
      ctx.save()
      ctx.rotate(angle)
      paint()
      ctx.restore()
    }

    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.42)
    core.addColorStop(0, `rgba(220, 255, 255, ${0.95 * pulse})`)
    core.addColorStop(0.25, `rgba(90, 235, 255, ${0.55 * pulse})`)
    core.addColorStop(1, 'rgba(40, 200, 240, 0)')
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.arc(0, 0, 0.42, 0, Math.PI * 2)
    ctx.fill()

    ring(1, 2.2, 0.9 * pulse)
    ring(1.07, 1, 0.45 * pulse)
    turn(t * 0.32, () => {
      ctx.beginPath()
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2
        const c = Math.cos(a)
        const s = Math.sin(a)
        ctx.moveTo(c * 1.07, s * 1.07)
        ctx.lineTo(c - s * 0.045, s + c * 0.045)
        ctx.lineTo(c * 0.93, s * 0.93)
        ctx.lineTo(c + s * 0.045, s - c * 0.045)
        ctx.closePath()
      }
      ctx.lineWidth = 1.6 * px
      ctx.strokeStyle = ink(0.95)
      ctx.stroke()
      for (const ray of RAYS) {
        const alpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.6 + ray.phase))
        ctx.beginPath()
        ctx.moveTo(Math.cos(ray.angle) * 1.12, Math.sin(ray.angle) * 1.12)
        ctx.lineTo(Math.cos(ray.angle) * (1.12 + ray.length), Math.sin(ray.angle) * (1.12 + ray.length))
        ctx.lineWidth = px
        ctx.strokeStyle = ink(alpha * pulse)
        ctx.stroke()
      }
    })
    turn(-t * 0.45, () => {
      ctx.beginPath()
      RUNES.forEach((glyph, index) => {
        const a = (index / RUNES.length) * Math.PI * 2
        const c = Math.cos(a)
        const s = Math.sin(a)
        for (const [x1, y1, x2, y2] of glyph) {
          // Glyph box: 0.11 along the ring, 0.09 across it, centred at r=0.845.
          ctx.moveTo(c * (0.845 + x1 * 0.09) - s * y1 * 0.11, s * (0.845 + x1 * 0.09) + c * y1 * 0.11)
          ctx.lineTo(c * (0.845 + x2 * 0.09) - s * y2 * 0.11, s * (0.845 + x2 * 0.09) + c * y2 * 0.11)
        }
      })
      ctx.lineWidth = 1.3 * px
      ctx.strokeStyle = ink(0.85 * pulse)
      ctx.stroke()
    })
    ring(0.93, 1.1, 0.6 * pulse)
    ring(0.76, 1.1, 0.6 * pulse)
    turn(t * 0.7, () => {
      ctx.setLineDash([0.07, 0.05])
      ring(0.68, 1.6, 0.8 * pulse)
      ctx.setLineDash([])
    })
    turn(-t * 1.1, () => {
      ring(0.52, 1.6, 0.85 * pulse)
      ctx.beginPath()
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2
        const inner = 0.52 - (i % 3 === 0 ? 0.07 : 0.035)
        ctx.moveTo(Math.cos(a) * 0.52, Math.sin(a) * 0.52)
        ctx.lineTo(Math.cos(a) * inner, Math.sin(a) * inner)
      }
      ctx.lineWidth = px
      ctx.strokeStyle = ink(0.8 * pulse)
      ctx.stroke()
    })
    turn(t * 0.55, () => {
      ctx.beginPath()
      for (let star = 0; star < 2; star++) {
        for (let i = 0; i < 3; i++) {
          const a = (star * Math.PI) / 3 + (i * 2 * Math.PI) / 3 - Math.PI / 2
          if (i === 0) ctx.moveTo(Math.cos(a) * 0.46, Math.sin(a) * 0.46)
          else ctx.lineTo(Math.cos(a) * 0.46, Math.sin(a) * 0.46)
        }
        ctx.closePath()
      }
      ctx.lineWidth = 1.2 * px
      ctx.strokeStyle = ink(0.7 * pulse)
      ctx.stroke()
    })
    ring(0.22, 1.8, 0.9 * pulse)
    for (const spark of SPARKS) {
      const a = spark.angle + t * spark.speed
      ctx.beginPath()
      ctx.arc(Math.cos(a) * spark.radius, Math.sin(a) * spark.radius, spark.size, 0, Math.PI * 2)
      ctx.fillStyle = ink(0.8 * (0.5 + 0.5 * Math.sin(t * 3 + spark.phase)))
      ctx.fill()
    }

    // Her fingertips stay in front of the disc.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.shadowBlur = 0
    ctx.globalCompositeOperation = 'destination-out'
    ctx.drawImage(hand, (left + HAND.x * k) * ratio, (top + HAND.y * k) * ratio, HAND.w * k * ratio, HAND.h * k * ratio)
    ctx.globalCompositeOperation = 'source-over'
  }

  const loop = (now        ) => {
    frame = 0
    if (disposed) return
    draw(now)
    if (!still && visible) frame = requestAnimationFrame(loop)
  }
  const wake = () => {
    if (!frame && !disposed) frame = requestAnimationFrame(loop)
  }
  const sized = new ResizeObserver(() => {
    resize()
    wake()
  })
  sized.observe(canvas)
  const seen = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true
    wake()
  })
  seen.observe(stage)
  const ready = hand.complete ? Promise.resolve() : hand.decode().catch(() => {})
  void ready.then(() => {
    resize()
    wake()
  })

  return () => {
    disposed = true
    if (frame) cancelAnimationFrame(frame)
    sized.disconnect()
    seen.disconnect()
  }
}

/** Deterministic mote field: cyan sparks and rose bokeh drifting upward. */
const MOTES = [
  { left: 4, size: 3, dur: 13, delay: 0, rose: false },
  { left: 11, size: 5, dur: 17, delay: 3.2, rose: true },
  { left: 19, size: 2, dur: 11, delay: 6.1, rose: false },
  { left: 26, size: 4, dur: 15, delay: 1.4, rose: true },
  { left: 34, size: 2, dur: 12, delay: 8.3, rose: false },
  { left: 41, size: 6, dur: 19, delay: 4.6, rose: true },
  { left: 57, size: 5, dur: 18, delay: 2.2, rose: true },
  { left: 64, size: 2, dur: 10, delay: 7.4, rose: false },
  { left: 71, size: 4, dur: 16, delay: 0.8, rose: true },
  { left: 78, size: 3, dur: 13, delay: 5.5, rose: false },
  { left: 85, size: 5, dur: 17, delay: 9.1, rose: true },
  { left: 92, size: 2, dur: 12, delay: 3.8, rose: false },
]         

/**
 * @returns the backdrop element; mount it as the first child of a positioned,
 * isolated container so it paints under that container's content.
 */

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
window.__YOREN_ANIMATIONS__={version:'1.1.0',get mounted(){return mounted.size;},dispose(){
  removeSplash();disposed=true;clearTimeout(compatibilityTimer);observer.disconnect();
  window.removeEventListener('message',receive);window.removeEventListener('keydown',key);
  for(const stop of mounted.values())stop();mounted.clear();
}};

})();
