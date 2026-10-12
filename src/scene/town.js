// 真新鎮場景（PLAN §8）：天空、天空與含世界座標天氣的立體村莊分開渲染。
// 負責月亮、視差、日夜光照過渡與降級／暫停；星空見 stars.js。只 import 用到的 three 模組。

import {
  Scene,
  OrthographicCamera,
  WebGLRenderer,
  PlaneGeometry,
  MeshBasicMaterial,
  ShaderMaterial,
  Mesh,
  CanvasTexture,
  Color,
  LinearFilter,
  ClampToEdgeWrapping,
  SRGBColorSpace,
  PCFShadowMap
} from 'three'
import { MOON, STARS, PARALLAX_PX, HORIZON } from '../config/town.js'
import { createPostPass } from './post.js'
import { createStars } from './stars.js'
import { createSkyWeather } from './sky-weather.js'
import { createSceneLook } from './look.js'
import { createVillage } from './village.js'
import { sampleFlight, LEVEL_PITCH, HD2D_PITCH } from './journey.js'

const SKY_SHADER = {
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform vec3 top; uniform vec3 bottom; uniform float horizon;
    varying vec2 vUv;
    void main() {
      float t = smoothstep(horizon, 1.0, vUv.y);
      gl_FragColor = vec4(mix(bottom, top, t), 1.0);
      #include <colorspace_fragment>
    }
  `
}

/** 月亮：柔光暈加實心圓，不需素材。 */
function drawMoon(size) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.5)
  g.addColorStop(0, 'rgba(255,244,194,0.5)')
  g.addColorStop(1, 'rgba(255,244,194,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#fff4c2'
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size * 0.26, 0, Math.PI * 2)
  ctx.fill()
  return c
}

/** 惡屬性白天的日蝕（PLAN §9.4）：暗紫黑的圓盤、粉白日冕與右上一點鑽石環亮光。 */
function drawEclipse(size) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d'), m = size / 2, r = size * 0.24
  const corona = ctx.createRadialGradient(m, m, r * 0.9, m, m, size * 0.5)
  corona.addColorStop(0, 'rgba(255,236,250,0.95)')
  corona.addColorStop(0.25, 'rgba(230,190,255,0.45)')
  corona.addColorStop(1, 'rgba(200,160,255,0)')
  ctx.fillStyle = corona
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#140b1f'
  ctx.beginPath()
  ctx.arc(m, m, r, 0, Math.PI * 2)
  ctx.fill()
  const x = m + r * 0.7, y = m - r * 0.7
  const diamond = ctx.createRadialGradient(x, y, 0, x, y, r * 0.5)
  diamond.addColorStop(0, 'rgba(255,255,255,1)')
  diamond.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = diamond
  ctx.fillRect(0, 0, size, size)
  return c
}

/** 惡屬性夜晚的紅月：紅色光暈加血紅細月牙，與月亮同大小。 */
function drawBloodMoon(size) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d'), m = size / 2, r = size * 0.26
  const glow = ctx.createRadialGradient(m, m, r * 0.7, m, m, size * 0.5)
  glow.addColorStop(0, 'rgba(255,70,80,0.45)')
  glow.addColorStop(1, 'rgba(255,70,80,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, size, size)
  // 月牙先畫在另一張畫布再疊上，挖掉的部分不會連光暈一起挖掉。
  const crescent = document.createElement('canvas')
  crescent.width = crescent.height = size
  const cc = crescent.getContext('2d')
  cc.fillStyle = '#ff4d5a'
  cc.beginPath()
  cc.arc(m, m, r, 0, Math.PI * 2)
  cc.fill()
  cc.globalCompositeOperation = 'destination-out'
  cc.beginPath()
  cc.arc(m + r * 0.45, m - r * 0.2, r * 0.92, 0, Math.PI * 2)
  cc.fill()
  ctx.drawImage(crescent, 0, 0)
  return c
}

/** 月亮、日蝕與紅月共用的畫布貼圖設定。 */
function skyTexture(canvas) {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  return texture
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ lowPower: boolean, reducedMotion: boolean, isMobile: boolean, hd2d?: boolean, period: object, series?: string, onReady?: Function, onError?: Function }} opts
 */
export function createTown(canvas, opts) {
  const state = {
    lowPower: opts.lowPower,
    reducedMotion: opts.reducedMotion,
    isMobile: opts.isMobile,
    paused: false, // document.hidden
    parallaxFrozen: false, // 卡牌放大中
    width: 1,
    height: 1
  }

  // HD-2D 的場景先畫進後製目標（post.js 自帶 MSAA），畫布只收全畫面四邊形與村民對話框，畫布本身不需要多重取樣。
  const renderer = new WebGLRenderer({ canvas, antialias: !opts.hd2d, alpha: false, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.lowPower ? 1.5 : 2))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.shadowMap.enabled = !!opts.hd2d && !state.lowPower
  renderer.shadowMap.type = PCFShadowMap

  const scene = new Scene()
  const pitch = opts.hd2d ? HD2D_PITCH : LEVEL_PITCH
  // 場景外觀：日夜與屬性天氣的過場只在進行中才重新合成並套用（look.js）。
  const sceneLook = createSceneLook(opts.period)
  const village = createVillage({ lowPower: state.lowPower, hd2d: !!opts.hd2d, pitch, sceneLook, series: opts.series })
  renderer.autoClear = false
  const post = createPostPass({ hd2d: !!opts.hd2d, lowPower: state.lowPower })
  let weatherTime = 0
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  camera.position.z = 10

  const unitPlane = new PlaneGeometry(1, 1)

  // 天空
  const skyMaterial = new ShaderMaterial({
    ...SKY_SHADER,
    uniforms: {
      top: { value: new Color('#79c2ff') },
      bottom: { value: new Color('#d9f0ff') },
      horizon: { value: HORIZON }
    },
    depthTest: false,
    depthWrite: false
  })
  const sky = new Mesh(unitPlane, skyMaterial)
  sky.renderOrder = 0
  scene.add(sky)

  // 星星：遠近、視差與閃爍都在 stars.js 的著色器內；視差以月亮位移為基準按比例縮小
  const stars = createStars({ lowPower: state.lowPower })
  const starFollow = STARS.parallax / MOON.parallax
  scene.add(stars.points)

  const weather = village.weather
  // 龍屬性的流星與超能力的極光（sky-weather.js），在背景層，村莊的雲與遠景會蓋在前面。
  const skyWeather = createSkyWeather({ lowPower: state.lowPower })
  scene.add(...skyWeather.meshes)
  // 後製效果：每幀寫入同一個物件（熱浪、空間扭曲、格鬥權重與震動位移）。
  const postEffects = { heat: 0, warp: 0, quake: 0, shakeX: 0, shakeY: 0 }

  // 月亮
  const moonTexture = skyTexture(drawMoon(MOON.size))
  const moonMaterial = new MeshBasicMaterial({ map: moonTexture, transparent: true, opacity: 0, depthTest: false, depthWrite: false })
  const moonMesh = new Mesh(unitPlane, moonMaterial)
  moonMesh.renderOrder = 10
  scene.add(moonMesh)
  const moon = { base: { x: 0, y: 0 }, current: { x: 0, y: 0 }, target: { x: 0, y: 0 } }
  // 惡屬性：日蝕（清晨、白天、黃昏）與紅月（夜晚）放在月亮的位置；透明度只在套用外觀時寫入，透明時不繪製。
  const omens = [drawEclipse, drawBloodMoon].map(draw => {
    const material = new MeshBasicMaterial({ map: skyTexture(draw(MOON.size)), transparent: true, opacity: 0, depthTest: false, depthWrite: false })
    const mesh = new Mesh(unitPlane, material)
    mesh.renderOrder = 10
    mesh.visible = false
    scene.add(mesh)
    return { mesh, material }
  })

  // 版面
  function layout() {
    const w = (state.width = canvas.clientWidth || window.innerWidth)
    const h = (state.height = canvas.clientHeight || window.innerHeight)
    renderer.setSize(w, h, false)
    camera.left = -w / 2
    camera.right = w / 2
    camera.top = h / 2
    camera.bottom = -h / 2
    camera.updateProjectionMatrix()
    sky.scale.set(w, h, 1)
    weather.resize(w, h)
    post.resize(w, h, Math.min(renderer.getPixelRatio(), state.lowPower ? 1 : 1.5))
    village.resize(w, h)
    // 與低空透視鏡頭的地平線對齊，遠景霧色與天空無接縫。
    skyMaterial.uniforms.horizon.value = .5 + Math.tan(pitch) / (2 * Math.tan(village.camera.fov * Math.PI / 360))

    // 月亮整顆留在地平線以上；斜俯視時天空較窄，依可用高度縮小並上移。
    const skyH = (1 - skyMaterial.uniforms.horizon.value) * h
    const moonSize = Math.min(w * MOON.widthFrac, skyH * 0.7)
    const moonTop = Math.max(0.01 * h, Math.min(MOON.y * h, skyH - moonSize * 1.1))
    moonMesh.scale.set(moonSize, moonSize, 1)
    for (const omen of omens) omen.mesh.scale.set(moonSize, moonSize, 1)
    // HD-2D 的方向光從左上照、影子落在右側，月亮也放左上，與影子方向一致；現行畫風維持右上。
    moon.base.x = (opts.hd2d ? MOON.hd2dX : MOON.x) * w
    moon.base.y = h / 2 - moonSize / 2 - moonTop

    // 星星只在實際地平線以上
    stars.layout(w, h, skyMaterial.uniforms.horizon.value, renderer.getPixelRatio())
    skyWeather.layout(w, h, skyMaterial.uniforms.horizon.value)

    updateParallaxTargets()
    requestFrame()
  }

  // 視差
  const villagePointer = { x: 0, y: 0 }
  const pointer = { x: 0, y: 0 } // -1..1
  let journeyTarget = 0
  let journeyProgress = 0
  let openingAmount = 0
  let firstRendered = false
  let destroyed = false
  function setJourney(progress, opening = 0) {
    journeyTarget = clamp(progress, 0, 1)
    journeyProgress = journeyTarget
    openingAmount = opening
    requestFrame()
  }
  function updateParallaxTargets() {
    if (state.parallaxFrozen) return
    const amp = state.isMobile ? PARALLAX_PX * 0.5 : PARALLAX_PX
    moon.target.x = -pointer.x * MOON.parallax * amp
    moon.target.y = pointer.y * MOON.parallax * amp * 0.5
    if (state.reducedMotion) {
      moon.current.x = moon.target.x
      moon.current.y = moon.target.y
      requestFrame()
    }
  }

  function onPointerMove(e) {
    if (state.isMobile) return
    pointer.x = clamp((e.clientX / state.width) * 2 - 1, -1, 1)
    pointer.y = clamp((e.clientY / state.height) * 2 - 1, -1, 1)
    updateParallaxTargets()
  }
  function setTilt(gamma, beta) {
    if (!state.isMobile) return
    pointer.x = clamp(gamma / 30, -1, 1)
    pointer.y = clamp(beta / 30, -1, 1)
    updateParallaxTargets()
  }

  // 日夜
  village.villagers?.setPeriod(opts.period.key)

  // 只在場景外觀有變化時呼叫：這裡與 village.setLook 寫入的屬性不能再有每幀的寫入者，否則靜止時會停在別處寫的值。
  function applyLook() {
    const l = sceneLook.look
    village.setLook(l, sceneLook.environment)
    skyMaterial.uniforms.top.value.copy(l.skyTop)
    skyMaterial.uniforms.bottom.value.copy(l.skyBottom)
    stars.setOpacity(l.stars)
    moonMaterial.opacity = l.moon
    for (const [omen, opacity] of [[omens[0], l.eclipse], [omens[1], l.bloodMoon]]) {
      omen.material.opacity = opacity
      omen.mesh.visible = opacity > .001
    }
  }

  function setPeriod(period, immediate = false) {
    const instant = immediate || state.reducedMotion
    sceneLook.setPeriod(period, { immediate: instant, now: performance.now() })
    village.villagers?.setPeriod(period.key)
    if (instant) requestFrame()
    else startLoop()
  }

  // 渲染
  let raf = 0
  let lastTime = 0
  let frameRequested = false
  const shouldLoop = () => !state.reducedMotion && !state.paused

  function frame(now) {
    if (destroyed) return
    try { renderFrame(now) }
    catch {
      state.paused = true
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      opts.onError?.()
    }
  }

  function renderFrame(now) {
    raf = 0
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 0
    lastTime = now

    // 天氣權重須在村莊更新前推進：粒子、閃電與村民對話讀同一幀的權重。
    const lookChanged = sceneLook.advance(now, dt, state.reducedMotion)

    const smoothing = state.reducedMotion ? 1 : 1 - Math.exp(-dt * 7)
    if (!state.parallaxFrozen && !state.reducedMotion) {
      villagePointer.x += (pointer.x - villagePointer.x) * smoothing
      villagePointer.y += (pointer.y - villagePointer.y) * smoothing
    }
    moon.current.x += (moon.target.x - moon.current.x) * smoothing
    moon.current.y += (moon.target.y - moon.current.y) * smoothing
    moonMesh.position.set(moon.base.x + moon.current.x, moon.base.y + moon.current.y, 0)
    for (const omen of omens) omen.mesh.position.copy(moonMesh.position)
    stars.update(moon.current.x * starFollow, moon.current.y * starFollow, weatherTime)

    village.update(state.reducedMotion ? { x: 0, y: 0 } : villagePointer, now, state.reducedMotion, journeyProgress, dt)
    if (openingAmount > 0 && !state.reducedMotion) {
      // 在南側道路上方下降，不改動既有地景或低空路徑。
      const { target } = sampleFlight(journeyProgress, undefined, undefined, pitch)
      village.camera.position.y += 6 * openingAmount
      village.camera.position.z += 5 * openingAmount
      target.y += 1.5 * openingAmount
      village.camera.lookAt(target)
    }
    if (lookChanged) applyLook()
    const weights = sceneLook.weather.weights
    skyWeather.update(weatherTime, state.reducedMotion ? 0 : weights.rays, weights.orbs)
    if (!state.reducedMotion) weatherTime += dt
    postEffects.heat = state.reducedMotion ? 0 : sceneLook.environment.heat * (state.lowPower ? .45 : 1)
    postEffects.warp = state.reducedMotion ? 0 : weights.orbs
    postEffects.quake = state.reducedMotion ? 0 : weights.aura
    // 格鬥的畫面震動：每一擊後 0.6 秒內衰減，縱向約 4 像素、橫向約 2 像素（1440×900）；impact 為 (x, z, 經過秒數, 強度)。
    const { impact } = weather
    const shake = impact.w > 0 && impact.z < .6 ? postEffects.quake * Math.exp(-impact.z * 7) : 0
    postEffects.shakeX = shake * .0025 * Math.sin(impact.z * 41 + 1.3)
    postEffects.shakeY = shake * .0045 * Math.sin(impact.z * 52)
    const postActive = post.active(postEffects)
    renderer.setRenderTarget(postActive ? post.target : null)
    renderer.clear()
    renderer.render(scene, camera)
    renderer.clearDepth()
    renderer.render(village.scene, village.camera)
    if (postActive) post.render(renderer, weatherTime, postEffects)
    // 村民對話框在後製之後畫，保持銳利、不受移軸模糊。
    if (village.overlay) renderer.render(village.overlay, village.camera)
    frameRequested = false
    if (!firstRendered) { firstRendered = true; opts.onReady?.() }
    if (shouldLoop()) raf = requestAnimationFrame(frame)
    else lastTime = 0
  }

  function startLoop() {
    if (!raf && shouldLoop()) raf = requestAnimationFrame(frame)
  }
  /** reduced-motion 或暫停時只補一幀 */
  function requestFrame() {
    if (destroyed || state.paused || raf || frameRequested) return
    frameRequested = true
    raf = requestAnimationFrame(frame)
  }

  function onVisibility() {
    state.paused = document.hidden
    if (raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
    frameRequested = false
    lastTime = 0
    if (!state.paused) { if (state.reducedMotion) requestFrame(); else startLoop() }
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('resize', layout)
  document.addEventListener('visibilitychange', onVisibility)

  applyLook()
  layout()
  startLoop()

  return {
    setJourney,
    setPeriod,
    setTilt,
    /** 卡牌系列切換：系列路牌翻面（減少動態時直接換面）。 */
    setSeries(id) {
      village.setSeries(id, state.reducedMotion)
      requestFrame()
    },
    /** null 明確恢復原景；卡牌收合不呼叫此方法。 */
    setWeather(key) {
      sceneLook.setWeather(key)
      requestFrame()
    },
    get weather() {
      return weather
    },
    setParallaxFrozen(frozen) {
      state.parallaxFrozen = frozen
      if (!frozen) updateParallaxTargets()
    },
    setReducedMotion(reduced) {
      state.reducedMotion = reduced
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      frameRequested = false
      lastTime = 0
      // 減少動態時，下一幀的 advance 會把進行中的過場直接推到終點。
      if (reduced) {
        updateParallaxTargets()
        requestFrame()
      } else startLoop()
    },
    setMobile(mobile) {
      state.isMobile = mobile
      updateParallaxTargets()
    },
    /** 測試與除錯用 */
    get isLooping() {
      return !!raf && shouldLoop()
    },
    get look() {
      return sceneLook.look
    },
    get journey() {
      return { progress: journeyProgress, target: journeyTarget,
        location: journeyProgress < 0.27 ? '真新鎮' : journeyProgress < 0.8 ? '一號道路' : '常磐市',
        position: village.camera.position.toArray() }
    },
    get parallaxFrozen() {
      return state.parallaxFrozen
    },
    /** 村民（HD-2D 原型），測試用 */
    get villagers() {
      return village.villagers
    },
    /** 場景鏡頭，測試用（截圖時投影村民位置） */
    get camera() {
      return village.camera
    },
    /** 陰影與繪製狀態，測試用 */
    get renderStats() {
      const sun = village.scene.children.find(child => child.isDirectionalLight)
      let casters = 0
      village.scene.traverse(object => { if (object.castShadow) casters++ })
      return { shadowMap: renderer.shadowMap.enabled, sunCasts: !!sun?.castShadow, shadowTexture: !!sun?.shadow.map, casters, calls: renderer.info.render.calls }
    },
    destroy() {
      destroyed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('resize', layout)
      document.removeEventListener('visibilitychange', onVisibility)
      moonTexture.dispose()
      moonMaterial.dispose()
      for (const omen of omens) { omen.material.map.dispose(); omen.material.dispose() }
      village.dispose()
      post.dispose()
      stars.dispose()
      skyWeather.dispose()
      skyMaterial.dispose()
      unitPlane.dispose()
      renderer.dispose()
    }
  }
}
