
/**
 * Full-bleed backdrop for the new-session page: the silver-sword knight
 * redrawn as a 3D render, alive through short generated clips that all start
 * and end on the same frame (the poster). She idles — breathing, hair, scarf
 * and whale tail in the wind, the palm sigil turning — and every couple of
 * loops plays one move: a head tilt and wink, leaning in with a heavy-lidded
 * smile, or a hair toss as her sigil flares. Two video elements double-buffer
 * so a clip change is a short crossfade between matching frames. The clips
 * come from the host route the package registers (`/hero-knight/`); until
 * they load, or without them, the poster stands in, and the sigil in her left
 * palm is drawn live: a vector disc in the tilted plane of her palm whose
 * rings, runes, ticks and star turn at their own speeds (the painted sigil is
 * retouched out of the poster), passing behind her fingertips. Decorative:
 * hidden from the accessibility tree, no pointer events; reduced motion keeps
 * the poster and a still sigil.
 */

const MEDIA = '/yoren-animations/media/'
const IDLE = 'idle.mp4'
const MOVES = ['wink.mp4', 'lean.mp4', 'toss.mp4'] as const
/** Seconds before a clip ends when the next one starts fading in. */
const CROSSFADE = 0.3

/** Media query check that tolerates environments without matchMedia. */
function matches(query: string) {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches
}

/**
 * Drive the two video elements until disposed: idle 2–3 loops, then one
 * move (never the same twice in a row), then idle again.
 */
function startClips(stage: HTMLElement, a: HTMLVideoElement, b: HTMLVideoElement) {
  let disposed = false
  let front = a
  let back = b
  let idleLeft = 2
  let lastMove = ''
  let switching = false

  const nextClip = () => {
    if (idleLeft > 0) {
      idleLeft -= 1
      return IDLE
    }
    const choices = MOVES.filter(move => move !== lastMove)
    const move = choices[Math.floor(Math.random() * choices.length)] ?? MOVES[0] ?? IDLE
    lastMove = move
    idleLeft = 2 + Math.floor(Math.random() * 2)
    return move
  }

  const load = (video: HTMLVideoElement, clip: string) => {
    video.src = MEDIA + clip
    video.load()
  }

  const swap = () => {
    if (disposed || switching) return
    switching = true
    const incoming = back
    incoming.currentTime = 0
    void incoming.play().then(() => {
      if (disposed) return
      incoming.dataset.front = ''
      delete front.dataset.front
      back = front
      front = incoming
      switching = false
      // Queue the following clip in the element that just went behind.
      window.setTimeout(() => {
        if (disposed) return
        back.pause()
        load(back, nextClip())
      }, CROSSFADE * 1000 + 80)
    }, () => { switching = false })
  }

  const onTime = (event: Event) => {
    const video = event.currentTarget as HTMLVideoElement
    if (video !== front || !Number.isFinite(video.duration)) return
    if (video.duration - video.currentTime <= CROSSFADE && back.readyState >= 2) swap()
  }
  // A clip that ran out before the next was ready holds its last frame (it
  // matches the poster); the swap happens as soon as the next can play.
  const onEnded = (event: Event) => {
    if (event.currentTarget === front) swap()
  }
  const onReady = (event: Event) => {
    if (event.currentTarget === back && front.ended) swap()
  }
  const onPlaying = () => {
    stage.dataset.playing = ''
  }

  for (const video of [a, b]) {
    video.muted = true
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('ended', onEnded)
    video.addEventListener('canplay', onReady)
    video.addEventListener('playing', onPlaying)
  }

  const seen = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting ?? true) void front.play().catch(() => {})
    else front.pause()
  })
  seen.observe(stage)

  front.dataset.front = ''
  load(front, nextClip())
  load(back, nextClip())
  void front.play().catch(() => {})

  return () => {
    disposed = true
    seen.disconnect()
    for (const video of [a, b]) {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('canplay', onReady)
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
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
}

const RUNES = (() => {
  const random = seeded(7)
  return Array.from({ length: 18 }, () => Array.from({ length: 2 + Math.floor(random() * 3) }, () =>
    [random() - 0.5, random() - 0.5, random() - 0.5, random() - 0.5] as const))
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
function startSigil(stage: HTMLElement, canvas: HTMLCanvasElement, hand: HTMLImageElement, still: boolean) {
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

  const draw = (now: number) => {
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
    const ink = (alpha: number) => `rgba(110, 240, 255, ${alpha})`
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'
    ctx.shadowColor = 'rgba(60, 230, 255, 0.9)'
    ctx.shadowBlur = 10 * ratio
    const ring = (r: number, line: number, alpha: number) => {
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.lineWidth = line * px
      ctx.strokeStyle = ink(alpha)
      ctx.stroke()
    }
    const turn = (angle: number, paint: () => void) => {
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

  const loop = (now: number) => {
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
] as const

/**
 * @returns the backdrop element; mount it as the first child of a positioned,
 * isolated container so it paints under that container's content.
 */
