// The DeepSeek Harness launch splash, its live part. The silver-haired
// knight's entrance is a video rendered offline (video/intro.py ->
// intro.mp4), played natively by Sources/Splash.swift under this page; the
// page only adds what changes from launch to launch:
//   - the greeting, by the Mac's local time with a random line, typed onto
//     the strip the video draws, at the time intro.json gives
//   - the loader at the bottom left, which follows the app itself: "正在载入
//     超算中心" decodes in letter by letter, flickering like an unsteady
//     hologram, a status lamp blinking and a light running along a
//     segmented bar; once the app has loaded it decodes into "超算中心已就绪",
//     the bar fills and the lamp holds. No percentage: nothing here knows one.
// The scene is the video's 1200x780 frame, fitted to the window and centred
// just as the video is (aspect fit), so the greeting lands on its strip.
;(function (root) {
  'use strict'

  const NAME = 'Yoren'
  const LEAVE_MS = 450
  // One is picked at random on every start; at most 16 characters each, so
  // the greeting fits its strip.
  const LINES = [
    '本王已苏醒，今天征服什么？',
    '深海听令，随时出击！',
    '难题？交给本王碾碎。',
    '所有工具已就位，下令吧。',
    '推理链展开，问题无处可逃。',
    '潜得够深，才看得清问题。',
    '深度思考模式，启动！',
    '声呐扫描完毕，目标锁定。',
    '王座已暖，开始干活。',
    '浪已经起了，代码开始流动。',
    '今天也一起探到最底层吧。',
    '上下文已装填，随时开工。',
  ]
  const NIGHT_LINES = [
    '夜已深，本王陪你收尾。',
    '深夜值守中，最后一件交给我。',
    '海面很静，别熬太晚。',
    '低功耗巡航，收尾就好。',
    '通宵不是好习惯，听本王的。',
  ]

  const pick = (list, random) => list[Math.min(list.length - 1, Math.floor(random() * list.length))]

  // Greets by the Mac's local time, with a random line.
  function introText(date, random = Math.random) {
    const hour = date.getHours()
    if (hour >= 23 || hour < 5) return { title: '夜深了', line: pick(NIGHT_LINES, random) }
    const title = hour < 11 ? '早上好' : hour < 13 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
    return { title, line: pick(LINES, random) }
  }

  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  const escape = text => String(text).replace(/[&<>"']/g, char => ESCAPES[char] || char)

  // The scene, in the video's design pixels.
  const W = 1200
  const H = 780
  const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`
  // The face the video's own text is set in.
  const FONT = "font-family=\"'Hiragino Sans GB','PingFang SC',sans-serif\""

  // When the greeting types out, seconds after play (intro.json).
  const TIMING = { greetingAt: 7.45, greetingFor: 1.1 }

  // The loader: what it says while the app loads and once it has, when it
  // starts, how fast it types, and the glyphs a letter flickers through
  // before it settles.
  const LOADING = '正在载入超算中心'
  const READY = '超算中心已就绪'
  const LOADER_AT = 0.6
  const NOISE = 'ｱｳｶｷｸｻｼｿﾀﾅﾈﾑﾗﾜ0123456789ΣΛΞΨ#$%&*+=<>/▓▒░█'
  const SEGMENTS = 12

  // A fixed scramble, so a given moment always shows the same noise.
  const noise = (i, tick) => NOISE[((i + 1) * 7919 + tick * 104729) % 1999 % NOISE.length]

  // The loader's line, t seconds after play: `text` typed from `start`,
  // `step` apart, each letter flickering through noise for `decode` seconds
  // before it settles. The app loading at `loadedAt` decodes it into READY.
  function loaderText(t, loadedAt = null) {
    const ready = loadedAt !== null && t >= loadedAt
    const text = ready ? READY : LOADING
    const start = ready ? Math.max(loadedAt, LOADER_AT) : LOADER_AT
    const step = ready ? 0.05 : 0.09
    const decode = 0.16
    const tick = Math.floor(t / 0.04)
    let out = ''
    for (let i = 0; i < text.length; i++) {
      const at = start + i * step
      if (t < at) break
      out += t < at + decode ? noise(i, tick) : text[i]
    }
    return out
  }

  function style({ greetingAt, greetingFor }) {
    return `
#scene{position:relative;width:${W}px;height:${H}px;flex:none}
#scene *{position:absolute;box-sizing:border-box}
#scene svg{position:static;display:block}
.typing{left:110px;top:472px;width:500px;height:40px;overflow:hidden;animation:reveal ${greetingFor}s linear ${greetingAt}s both}
.typing>.counter{left:-110px;top:-472px;width:${W}px;height:${H}px;animation:counter ${greetingFor}s linear ${greetingAt}s both}
.loader{left:96px;top:712px;width:420px;height:48px;opacity:0;animation:loaderin .4s ease-out ${LOADER_AT}s both}
.flicker{inset:0;animation:flicker 4.3s linear ${LOADER_AT + 0.8}s infinite}
.lamp{left:2px;top:10px;width:6px;height:6px;background:#8fe3ff;box-shadow:0 0 6px #5fd0ff,0 0 14px rgba(80,190,255,.6);animation:lamp .9s steps(2,jump-none) infinite}
.ready .lamp{animation:none;background:#c6f4ff}
.line{left:16px;top:0;white-space:nowrap;font:300 13px/26px 'PingFang SC','Hiragino Sans GB',sans-serif;letter-spacing:.34em;color:#d4f1ff;text-shadow:0 0 5px rgba(110,205,255,.85),0 0 14px rgba(60,160,255,.45)}
#scene .line span{position:static}
#scene .line i{position:static;display:inline-block;width:7px;height:13px;margin-left:2px;vertical-align:-1px;background:#9fe6ff;box-shadow:0 0 6px rgba(110,205,255,.9);animation:cursor 1s steps(2,jump-none) infinite}
.bar{left:16px;top:31px;width:${SEGMENTS * 8 - 2}px;height:4px;background:repeating-linear-gradient(90deg,rgba(140,215,255,.22) 0 6px,transparent 6px 8px)}
.run{left:0;top:0;width:22px;height:4px;background:repeating-linear-gradient(90deg,#aeeaff 0 6px,transparent 6px 8px);box-shadow:0 0 8px rgba(120,210,255,.8);animation:run 1.6s steps(${SEGMENTS - 2},jump-none) infinite alternate}
.ready .run{width:${SEGMENTS * 8 - 2}px;animation:none}
.code{left:${16 + SEGMENTS * 8 + 12}px;top:25px;white-space:nowrap;font:500 9.5px/14px ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.3em;color:rgba(150,210,240,.72)}
.leaving #scene{animation:leave ${LEAVE_MS / 1000}s ease-in both}
@keyframes reveal{from{transform:translateX(-500px)}to{transform:none}}
@keyframes counter{from{transform:translateX(500px)}to{transform:none}}
@keyframes loaderin{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
@keyframes flicker{0%,100%{opacity:1;transform:none}4%{opacity:.35}5%{opacity:1}6%{opacity:.6}7%{opacity:1}38%{opacity:1;transform:none}39%{opacity:.75;transform:translateX(1.5px)}40%{opacity:1;transform:none}71%{opacity:.9}72%{opacity:.25}73%{opacity:1}74%{opacity:.7}75%{opacity:1}}
@keyframes lamp{from{opacity:1}to{opacity:.2}}
@keyframes cursor{from{opacity:1}to{opacity:0}}
@keyframes run{from{transform:translateX(0)}to{transform:translateX(${(SEGMENTS - 3) * 8}px)}}
@keyframes leave{to{opacity:0;transform:translateX(-24px)}}
@media (prefers-reduced-motion:reduce){.flicker,.lamp,.run,.line i{animation:none}}
`
  }

  function splashMarkup({ title, line }, timing = TIMING) {
    const greeting = escape(`${NAME}，${title}。${line}`)
    return `<style>${style(timing)}</style>
<div id="scene">
<div class="typing"><div class="counter">${svg(`<text x="112" y="499" ${FONT} font-size="17" font-weight="600" fill="#f4f8fc">${greeting}</text>`)}</div></div>
<div class="loader"><div class="flicker">
<b class="lamp"></b><div class="line"><span id="loader-text"></span><i></i></div>
<div class="bar"><b class="run"></b></div><div class="code" id="loader-code">SUPERCOMPUTE CORE // LINKING</div>
</div></div>
</div>`
  }

  // Messages to the native app: prepared, skip, left.
  function post(message) {
    const handler = root.webkit && root.webkit.messageHandlers && root.webkit.messageHandlers.splash
    if (handler) handler.postMessage(message)
  }

  // The scene is zoomed to fit the window and centred, as the video is.
  function fit(document) {
    const scene = document.getElementById('scene')
    if (scene) scene.style.zoom = String(Math.min(root.innerWidth / W, root.innerHeight / H))
  }

  let prepared = null
  let began = null
  let frozenAt = null
  let loadedAt = null

  // Waits for the fonts, so the greeting does not change face mid-type.
  function prepare() {
    prepared = prepared || Promise.resolve(root.document.fonts && root.document.fonts.ready).then(() => post('prepared'))
    return prepared
  }

  const elapsed = () => (frozenAt !== null ? frozenAt : (root.performance.now() - began) / 1000)

  // Draws the loader as it is now.
  function drawLoader(document) {
    const t = elapsed()
    const text = document.getElementById('loader-text')
    if (!text) return
    const value = loaderText(t, loadedAt)
    if (text.textContent !== value) text.textContent = value
    const ready = loadedAt !== null && t >= loadedAt
    document.body.classList.toggle('ready', ready)
    document.getElementById('loader-code').textContent = `SUPERCOMPUTE CORE // ${ready ? 'ONLINE' : 'LINKING'}`
  }

  // Called by the app the moment the video starts.
  function play(document, timing = TIMING) {
    document.getElementById('stage').innerHTML = splashMarkup(introText(new Date()), timing)
    began = root.performance.now()
    fit(document)
    root.addEventListener('resize', () => fit(document))
    document.addEventListener('mousedown', () => post('skip'), { once: true })
    const tick = () => {
      if (frozenAt === null) drawLoader(document)
      root.requestAnimationFrame(tick)
    }
    root.requestAnimationFrame(tick)
  }

  // The app has loaded: the loader decodes into READY.
  function loaded(document) {
    if (loadedAt !== null) return
    loadedAt = began === null ? 0 : elapsed()
    drawLoader(document)
  }

  // The text fades out with the video; posts "left".
  function leave(document) {
    document.body.classList.add('leaving')
    root.setTimeout(() => post('left'), LEAVE_MS)
  }

  // Freezes everything at `seconds` after play() (for --splash-snapshot).
  function seek(document, seconds) {
    for (const animation of document.getAnimations()) {
      animation.pause()
      animation.currentTime = seconds * 1000
    }
    frozenAt = seconds
    drawLoader(document)
  }

  const api = { LEAVE_MS, LINES, NIGHT_LINES, TIMING, LOADING, READY, LOADER_AT, introText, loaderText, splashMarkup, prepare, play, loaded, leave, seek }
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.DeepSeekSplash = api
})(typeof window === 'undefined' ? globalThis : window)
