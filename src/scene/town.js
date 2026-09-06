// 真新鎮場景（PLAN §8）：單一 OrthographicCamera，每層一個 PlaneGeometry + MeshBasicMaterial。
// 負責圖層建立、視差、雲朵飄移、日夜光照過渡與降級／暫停。只 import 用到的 three 模組。

import {
  Scene,
  OrthographicCamera,
  WebGLRenderer,
  PlaneGeometry,
  MeshBasicMaterial,
  ShaderMaterial,
  PointsMaterial,
  Mesh,
  Points,
  BufferGeometry,
  Float32BufferAttribute,
  CanvasTexture,
  Color,
  LinearFilter,
  RepeatWrapping,
  ClampToEdgeWrapping,
  SRGBColorSpace
} from 'three'
import { townLayers, PARALLAX_PX, HORIZON } from '../config/town.js'
import { TRANSITION_MS } from '../config/dayCycle.js'
import { drawPlaceholder, loadAsset } from './placeholders.js'
import { createWeather } from './weather.js'

const SKY_SHADER = {
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform vec3 top; uniform vec3 bottom; uniform vec3 ground; uniform vec3 groundFar; uniform float horizon;
    varying vec2 vUv;
    void main() {
      if (vUv.y >= horizon) {
        float t = (vUv.y - horizon) / (1.0 - horizon);
        gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0, 1.0, t)), 1.0);
      } else {
        float t = vUv.y / horizon;
        gl_FragColor = vec4(mix(ground, groundFar, t), 1.0);
      }
    }
  `
}

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function lookFromPeriod(p) {
  return {
    skyTop: new Color(p.sky[0]),
    skyBottom: new Color(p.sky[1]),
    light: new Color(p.light).multiplyScalar(p.intensity),
    stars: p.stars,
    moon: p.moon,
    windows: p.windows,
    haze: p.haze
  }
}

function lerpLook(a, b, t, out) {
  out.skyTop.copy(a.skyTop).lerp(b.skyTop, t)
  out.skyBottom.copy(a.skyBottom).lerp(b.skyBottom, t)
  out.light.copy(a.light).lerp(b.light, t)
  out.stars = a.stars + (b.stars - a.stars) * t
  out.moon = a.moon + (b.moon - a.moon) * t
  out.windows = a.windows + (b.windows - a.windows) * t
  out.haze = a.haze + (b.haze - a.haze) * t
  return out
}

function cloneLook(l) {
  return { ...l, skyTop: l.skyTop.clone(), skyBottom: l.skyBottom.clone(), light: l.light.clone() }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ lowPower: boolean, reducedMotion: boolean, isMobile: boolean, period: object }} opts
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
  const maxTexture = state.lowPower ? 1024 : 2048

  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.lowPower ? 1.5 : 2))
  renderer.outputColorSpace = SRGBColorSpace

  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  camera.position.z = 10

  const unitPlane = new PlaneGeometry(1, 1)

  // 天空
  const skyMaterial = new ShaderMaterial({
    ...SKY_SHADER,
    uniforms: {
      top: { value: new Color('#79c2ff') },
      bottom: { value: new Color('#d9f0ff') },
      ground: { value: new Color('#7ccf7a') },
      groundFar: { value: new Color('#a9e2a0') },
      horizon: { value: HORIZON }
    },
    depthTest: false,
    depthWrite: false
  })
  const sky = new Mesh(unitPlane, skyMaterial)
  sky.renderOrder = 0
  scene.add(sky)

  // 星星
  const starCount = state.lowPower ? 90 : 180
  const starGeometry = new BufferGeometry()
  const starMaterial = new PointsMaterial({
    color: '#ffffff',
    size: 2.2,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false
  })
  const stars = new Points(starGeometry, starMaterial)
  stars.renderOrder = 1
  scene.add(stars)

  // 屬性天氣：桌機 300、手機 150；低效能再減半（§8.4）
  let weatherCount = state.isMobile ? 150 : 300
  if (state.lowPower && !state.isMobile) weatherCount = Math.round(weatherCount / 2)
  const weather = createWeather(scene, { count: weatherCount, pixelRatio: renderer.getPixelRatio(), horizon: HORIZON })

  // 圖層
  const layers = townLayers
    .map((cfg, i) => {
      const material = new MeshBasicMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        opacity: cfg.role === 'night' || cfg.role === 'haze' ? 0 : 1
      })
      const mesh = new Mesh(unitPlane, material)
      mesh.renderOrder = 10 + i
      scene.add(mesh)
      return { cfg, mesh, material, texture: null, base: { x: 0, y: 0 }, displayW: 1, displayH: 1, current: { x: 0, y: 0 }, target: { x: 0, y: 0 } }
    })
    .sort((a, b) => a.cfg.depth - b.cfg.depth)
  layers.forEach((l, i) => (l.mesh.renderOrder = 10 + i))

  async function loadTextures() {
    await Promise.all(
      layers.map(async (l) => {
        let source = l.cfg.src ? await loadAsset(l.cfg.src, maxTexture) : null
        if (!source) source = drawPlaceholder(l.cfg, maxTexture)
        const tex = new CanvasTexture(source)
        tex.colorSpace = SRGBColorSpace
        tex.generateMipmaps = false
        tex.minFilter = LinearFilter
        tex.magFilter = LinearFilter
        tex.wrapS = l.cfg.drift ? RepeatWrapping : ClampToEdgeWrapping
        tex.wrapT = ClampToEdgeWrapping
        l.texture = tex
        l.material.map = tex
        l.material.needsUpdate = true
      })
    )
    requestFrame()
  }

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

    for (const l of layers) {
      const displayW = w * (l.cfg.widthFrac ?? 1.15)
      const scale = displayW / l.cfg.width
      const displayH = l.cfg.height * scale
      l.displayW = displayW
      l.displayH = displayH
      l.mesh.scale.set(displayW, displayH, 1)
      l.base.x = (l.cfg.x ?? 0) * w
      const horizonY = -h / 2 + HORIZON * h
      switch (l.cfg.anchor) {
        case 'top': // 上緣貼視窗頂
          l.base.y = h / 2 - displayH / 2 - l.cfg.y * h
          break
        case 'horizon': // 下緣貼地平線
          l.base.y = horizonY + displayH / 2 + l.cfg.y * h
          break
        case 'horizon-top': // 上緣貼地平線，向下延伸
          l.base.y = horizonY - displayH / 2 + l.cfg.y * h
          break
        default: // bottom：下緣貼視窗底
          l.base.y = -h / 2 + displayH / 2 + l.cfg.y * h
      }
    }

    // 星星只在上半部
    const pos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * w * 1.2
      pos[i * 3 + 1] = -h / 2 + HORIZON * h + h * 0.06 + Math.random() * (1 - HORIZON) * h * 0.9
      pos[i * 3 + 2] = 0
    }
    starGeometry.setAttribute('position', new Float32BufferAttribute(pos, 3))
    starGeometry.computeBoundingSphere()

    updateParallaxTargets()
    requestFrame()
  }

  // 視差
  const pointer = { x: 0, y: 0 } // -1..1
  let scrollY = 0
  function updateParallaxTargets() {
    if (state.parallaxFrozen) return
    const amp = state.isMobile ? PARALLAX_PX * 0.5 : PARALLAX_PX
    const scrollShift = Math.min(scrollY, state.height)
    for (const l of layers) {
      l.target.x = -pointer.x * l.cfg.parallax * amp
      l.target.y = pointer.y * l.cfg.parallax * amp * 0.5 + scrollShift * l.cfg.scrollFactor
    }
    if (state.reducedMotion) {
      for (const l of layers) {
        l.current.x = l.target.x
        l.current.y = l.target.y
      }
      requestFrame()
    }
  }

  function onPointerMove(e) {
    if (state.isMobile) return
    pointer.x = clamp((e.clientX / state.width) * 2 - 1, -1, 1)
    pointer.y = clamp((e.clientY / state.height) * 2 - 1, -1, 1)
    updateParallaxTargets()
  }
  function onScroll() {
    scrollY = window.scrollY
    updateParallaxTargets()
  }
  function setTilt(gamma, beta) {
    if (!state.isMobile) return
    pointer.x = clamp(gamma / 30, -1, 1)
    pointer.y = clamp(beta / 30, -1, 1)
    updateParallaxTargets()
  }

  // 日夜
  let lookFrom = lookFromPeriod(opts.period)
  let lookTo = cloneLook(lookFrom)
  const look = cloneLook(lookFrom)
  let tweenStart = 0
  let tweening = false

  function applyLook(l) {
    skyMaterial.uniforms.top.value.copy(l.skyTop)
    skyMaterial.uniforms.bottom.value.copy(l.skyBottom)
    skyMaterial.uniforms.ground.value.set('#7ccf7a').multiply(l.light)
    skyMaterial.uniforms.groundFar.value.set('#a9e2a0').multiply(l.light)
    starMaterial.opacity = l.stars
    for (const layer of layers) {
      const role = layer.cfg.role
      if (role === 'night') {
        layer.material.color.set('#ffffff')
        layer.material.opacity = layer.cfg.key === 'moon' ? l.moon : l.windows
      } else if (role === 'haze') {
        layer.material.color.set('#ffffff')
        layer.material.opacity = l.haze
      } else {
        layer.material.color.copy(l.light)
      }
    }
  }

  function setPeriod(period, immediate = false) {
    lookFrom = cloneLook(look)
    lookTo = lookFromPeriod(period)
    if (immediate || state.reducedMotion) {
      lerpLook(lookFrom, lookTo, 1, look)
      applyLook(look)
      tweening = false
      requestFrame()
      return
    }
    tweenStart = performance.now()
    tweening = true
    startLoop()
  }

  // 渲染
  let raf = 0
  let lastTime = 0
  let frameRequested = false
  const shouldLoop = () => !state.reducedMotion && !state.paused

  function frame(now) {
    raf = 0
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 0
    lastTime = now

    if (tweening) {
      const t = clamp((now - tweenStart) / TRANSITION_MS, 0, 1)
      lerpLook(lookFrom, lookTo, easeInOut(t), look)
      applyLook(look)
      if (t >= 1) tweening = false
    }

    const smoothing = state.reducedMotion ? 1 : 0.05
    for (const l of layers) {
      l.current.x += (l.target.x - l.current.x) * smoothing
      l.current.y += (l.target.y - l.current.y) * smoothing
      l.mesh.position.set(l.base.x + l.current.x, l.base.y + l.current.y, 0)
      if (l.cfg.drift && l.texture && !state.reducedMotion) {
        l.texture.offset.x = (l.texture.offset.x - (l.cfg.drift * dt) / l.displayW + 1) % 1
      }
    }

    if (!state.reducedMotion) weather.update(dt, now)

    renderer.render(scene, camera)
    frameRequested = false
    if (shouldLoop()) raf = requestAnimationFrame(frame)
    else lastTime = 0
  }

  function startLoop() {
    if (!raf && shouldLoop()) raf = requestAnimationFrame(frame)
  }
  /** reduced-motion 或暫停時只補一幀 */
  function requestFrame() {
    if (raf || frameRequested) return
    frameRequested = true
    raf = requestAnimationFrame(frame)
  }

  function onVisibility() {
    state.paused = document.hidden
    if (raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
    lastTime = 0
    if (!state.paused) startLoop()
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', layout)
  document.addEventListener('visibilitychange', onVisibility)

  applyLook(look)
  layout()
  loadTextures()
  startLoop()

  return {
    setPeriod,
    setTilt,
    /** key 見 config/weather.js；null 為收合淡出。reduced-motion 時粒子關閉。 */
    setWeather(key) {
      weather.set(state.reducedMotion ? null : key)
      startLoop()
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
      lastTime = 0
      if (reduced) {
        tweening = false
        lerpLook(lookFrom, lookTo, 1, look)
        applyLook(look)
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
      return look
    },
    get parallaxFrozen() {
      return state.parallaxFrozen
    },
    /** 前景草的目前位移，供測試確認視差有效 */
    get foregroundOffset() {
      const l = layers[layers.length - 1]
      return { x: l.current.x, y: l.current.y }
    },
    destroy() {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', layout)
      document.removeEventListener('visibilitychange', onVisibility)
      for (const l of layers) {
        l.texture?.dispose()
        l.material.dispose()
      }
      weather.dispose()
      starGeometry.dispose()
      starMaterial.dispose()
      skyMaterial.dispose()
      unitPlane.dispose()
      renderer.dispose()
    }
  }
}
