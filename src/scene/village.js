import { createWeather } from './weather.js'
import { createClouds } from './clouds.js'
import { sampleFlight } from './journey.js'
import { buildNorthernRegion } from './region.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
// 依真新鎮參考圖建立可受光的立體微縮模型；所有幾何與材質共用並集中釋放。
import { Scene, Group, PerspectiveCamera, Fog, Vector3, Mesh, BoxGeometry, ConeGeometry, SphereGeometry, CylinderGeometry, MeshStandardMaterial, HemisphereLight, DirectionalLight, Color, Box3 } from 'three'

export function createVillage({ lowPower = false } = {}) {
  const scene = new Scene()
  const clouds = createClouds({ lowPower })
  scene.add(clouds.mesh)
  const root = new Group()
  scene.add(root)
  const camera = new PerspectiveCamera(56, 1, 0.1, 240)
  scene.fog = new Fog('#d9f0ff', 45, 130)
  const geometry = {
    box: new BoxGeometry(1, 1, 1),
    crown: new SphereGeometry(1, lowPower ? 7 : 10, 6),
    cone: new ConeGeometry(1, 1, 8),
    cylinder: new CylinderGeometry(1, 1, 1, 10)
  }
  const trees = [], flowers = [], surfaces = []
  const weatherUniforms = { time: { value: 0 }, wind: { value: 0 }, aura: { value: 0 } }
  const vegetation = new Set(['#3b7850','#73ad64','#88ba6d','#a0cb7f','#3f8c5a','#85bc6f','#b4d497','#8cc58e','#357953','#43865b'])
  const materials = new Map()
  function material(color) {
    if (!materials.has(color)) {
      const mat = new MeshStandardMaterial({ color, roughness: 0.85, flatShading: true })
      if (vegetation.has(color)) {
        mat.onBeforeCompile = shader => {
          shader.uniforms.weatherTime = weatherUniforms.time
          shader.uniforms.weatherWind = weatherUniforms.wind
          shader.uniforms.weatherAura = weatherUniforms.aura
          shader.vertexShader = 'uniform float weatherTime, weatherWind, weatherAura;\n' + shader.vertexShader
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
            #include <begin_vertex>
            float sway = sin(weatherTime*1.3+position.z*.28+position.x*.4);
            float ringIndex = clamp(floor((14.-position.z)/11.+.5),0.,17.);
            vec2 center = vec2(sin(ringIndex*3.)*3.,14.-ringIndex*11.);
            float phase = fract(weatherTime*.65+ringIndex*.618);
            float pulse = exp(-abs(length(position.xz-center)-phase*6.)*5.)*(1.-phase)*weatherAura;
            transformed.x += (sway*weatherWind*.18+pulse*.25)*min(3.,max(0.,position.y));
            transformed.y -= pulse*min(.25,max(0.,position.y)*.22);
          `)
        }
        mat.customProgramCacheKey = () => 'weather-vegetation-v1'
      }
      materials.set(color, mat)
    }
    return materials.get(color)
  }
  function shape(kind, color, x, y, z, sx, sy, sz, parent = root) {
    const mesh = new Mesh(geometry[kind], material(color))
    if (color === '#e77067' || color === '#e77973') flowers.push({ x, z })
    mesh.position.set(x, y, z)
    mesh.scale.set(sx, sy, sz)
    parent.add(mesh)
    return mesh
  }
  const box = (c, x, y, z, w, h, d, p = root) => shape('box', c, x, y, z, w, h, d, p)
  const ambient = new HemisphereLight('#d7edff', '#548355', 2.2)
  const sun = new DirectionalLight('#fff1d0', 2.8)
  sun.position.set(-18, 30, 15)
  scene.add(ambient, sun)
  // 草地與十字路徑：保留原圖的中央南北通道與住宅前方橫向通道。
  box('#72b98a', 0, -0.65, -85, 500, 1, 700)
  box('#a4d6ae', 0, -0.1, 0, 4, 0.12, 38)
  box('#a4d6ae', 0, -0.09, -1, 33, 0.12, 3.2)
  box('#a4d6ae', 0, -0.08, 9, 33, 0.12, 3)
  box('#a4d6ae', -13, -0.08, 0, 2.8, 0.12, 32)
  box('#a4d6ae', 13, -0.08, 0, 2.8, 0.12, 32)
  box('#e0cb8e', 7.2, -0.01, 12.1, 11, 0.12, 1.9)

  const glass = material('#83c8e2')
  function windowAt(x, y, z, w, h, p) {
    box('#52677f', x, y, z, w + 0.18, h + 0.18, 0.16, p)
    box('#83c8e2', x, y, z + 0.1, w, h, 0.08, p)
    box('#edf1db', x, y, z + 0.16, 0.07, h, 0.06, p)
    box('#edf1db', x, y - h / 2, z + 0.17, w + 0.2, 0.12, 0.18, p)
  }
  function house(x, z) {
    const p = new Group(); p.position.set(x, 0, z); root.add(p)
    box('#657788', 0, 0.18, 0, 6.4, 0.36, 4.9, p)
    box('#d9e1df', 0, 1.8, 0, 6, 3.2, 4.5, p)
    for (let y = 0.7; y < 3.3; y += 0.5) box('#b4c6c8', 0, y, 2.26, 6, 0.045, 0.025, p)
    // 雙坡屋頂，稜脊與瓦條都有厚度。
    for (const side of [-1, 1]) {
      const roof = box('#cf6754', 0, 3.9, side * 1.32, 6.8, 0.22, 2.95, p)
      roof.rotation.x = side * 0.39
      for (let i = 0; i < 5; i++) {
        const t = 0.24 + i * 0.53
        const tile = box(i % 2 ? '#e38b64' : '#e99b70', 0, 4.48 - t * 0.39, side * t, 6.75, 0.09, 0.11, p)
        tile.rotation.x = side * 0.39
      }
    }
    box('#ae4b49', 0, 4.5, 0, 6.9, 0.19, 0.2, p)
    windowAt(-1.55, 2.65, 2.29, 1.4, 0.65, p)
    windowAt(0.55, 2.65, 2.29, 1.6, 0.65, p)
    windowAt(0.65, 1.2, 2.29, 1.8, 0.65, p)
    box('#8b4d53', -1.9, 0.95, 2.34, 1.1, 1.65, 0.16, p)
    box('#85b5d1', -1.9, 1.35, 2.44, 0.82, 0.57, 0.07, p)
    box('#e0c5aa', -1.9, 0.2, 2.7, 1.4, 0.22, 0.8, p)
    box('#637b83', -4, 0.55, 2, 0.16, 1.1, 0.18, p)
    box('#d6e5df', -4, 1.1, 2, 0.65, 0.55, 0.65, p)
    box('#779eb0', -4, 1.08, 2.34, 0.47, 0.09, 0.03, p)
  }
  house(-7, -8); house(7, -8)

  // 黃磚研究所、灰瓦平屋頂、紅色通風塔與四個圓窗。
  const lab = new Group(); lab.position.set(7, 0, 4); root.add(lab)
  box('#73838b', 0, 0.16, 0, 9, 0.32, 5.8, lab)
  box('#e9d792', 0, 1.5, 0, 8.6, 2.7, 5.4, lab)
  for (let row = 0; row < 5; row++) {
    const y = 0.5 + row * 0.48
    box('#f5e8b5', 0, y, 2.71, 8.6, 0.055, 0.03, lab)
    for (let j = 0; j < 8; j++) box('#f5e8b5', -3.9 + j * 1.1 + (row % 2) * 0.45, y + 0.23, 2.72, 0.05, 0.42, 0.03, lab)
  }
  box('#586578', 0, 3, 0, 9.1, 0.36, 5.9, lab)
  box('#9fa8b9', 0, 3.23, 0, 8.6, 0.14, 5.4, lab)
  for (let x = -4; x <= 4; x += 0.65) box('#737f92', x, 3.32, 0, 0.045, 0.025, 5.4, lab)
  for (let z = -2.6; z < 2.7; z += 0.65) box('#737f92', 0, 3.33, z, 8.6, 0.025, 0.045, lab)
  box('#8e5055', 3, 3.85, -1.3, 1.35, 1.2, 1.45, lab)
  box('#ca7a68', 3, 4.47, -1.3, 1.5, 0.13, 1.6, lab)
  box('#454e66', 3, 4.55, -1.3, 0.95, 0.05, 1.05, lab)
  windowAt(-2.6, 0.9, 2.75, 1.8, 0.75, lab); windowAt(2.6, 0.9, 2.75, 1.8, 0.75, lab)
  for (const x of [-3.1, -1.7, 1.7, 3.1]) {
    const rim = shape('cylinder', '#f7edc4', x, 2.25, 2.8, 0.39, 0.14, 0.39, lab); rim.rotation.x = Math.PI / 2
    const pane = shape('cylinder', '#83c8e2', x, 2.25, 2.9, 0.28, 0.08, 0.28, lab); pane.rotation.x = Math.PI / 2
  }
  box('#427f73', 0, 0.9, 2.8, 1.25, 1.65, 0.18, lab)
  box('#8cbfc4', 0, 1.2, 2.92, 0.8, 0.7, 0.08, lab)

  function fence(x, z, count) {
    box('#c0c9c6', x + (count - 1) * 0.31, 0.6, z, count * 0.62, 0.15, 0.12)
    for (let i = 0; i < count; i++) {
      box('#dbe1d4', x + i * 0.62, 0.55, z, 0.35, 1.05, 0.24)
      shape('cone', '#dbe1d4', x + i * 0.62, 1.13, z, 0.25, 0.25, 0.18)
    }
  }
  fence(-10, 2.5, 9); fence(3, 10, 15); fence(-1, 17, 20)
  // 花圃：兩排紅花，綠葉與黃色花心。
  box('#639f75', -7.2, 0, 5.7, 7, 0.12, 4)
  for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
    const x = -9.7 + col * 1.25, z = 4.6 + row * 1.5
    shape('crown', '#357953', x, 0.2, z, 0.52, 0.25, 0.5)
    for (let i = 0; i < 5; i++) shape('crown', '#e77067', x + Math.cos(i * 1.257) * 0.24, 0.47, z + Math.sin(i * 1.257) * 0.24, 0.23, 0.17, 0.23)
    shape('crown', '#ffe09b', x, 0.56, z, 0.14, 0.13, 0.14)
  }
  // 池塘以實體岸邊包圍水面，淺色波紋在水面緩慢漂移。
  box('#867c79', -7.2, 0, 13.7, 5.6, 0.3, 6.4)
  box('#4b98b4', -7.2, 0.17, 13.7, 5.05, 0.08, 5.85)
  const ripples = []
  for (let i = 0; i < 8; i++) {
    const r = box('#8fcad2', -8.8 + (i % 3) * 1.45, 0.22, 11.4 + i * 0.62, 0.8, 0.012, 0.055)
    ripples.push(r)
  }
  function tree(x, z, seed) {
    trees.push({x,z})
    const s = 0.85 + (seed % 5) * 0.07
    shape('cylinder', '#826b4b', x, 0.7, z, 0.26, 1.4, 0.26)
    shape('crown', '#3b7850', x, 1.75, z, 1.25 * s, 1.25 * s, 1.18 * s)
    shape('crown', seed % 2 ? '#73ad64' : '#88ba6d', x - 0.1, 2.65, z, 1.12 * s, 1.2 * s, 1.05 * s)
    shape('cone', '#a0cb7f', x - 0.1, 3.5, z, 0.65 * s, 1.15 * s, 0.65 * s)
  }
  for (let i = 0; i < 15; i++) {
    if (Math.abs(-18 + i * 2.6) > 3) tree(-18 + i * 2.6, -15, i)
    tree(-17, -12 + i * 2.6, i + 3)
    tree(17, -12 + i * 2.6, i + 7)
  }
  for (let i = 0; i < 5; i++) { tree(-16 + i * 2.5, 18, i); tree(7 + i * 2.5, 18, i + 4) }
  // 固定種子草地細節，避免每次進站地形跳動。
  for (let i = 0; i < (lowPower ? 140 : 320); i++) {
    const x = Math.sin(i * 127.1) * 15.5, z = Math.sin(i * 311.7) * 16
    if (Math.abs(x) < 2.2 || Math.abs(z + 1) < 1.8 || Math.abs(z - 9) < 1.7) continue
    box(i % 2 ? '#b4d497' : '#8cc58e', x, 0.015, z, 0.1, 0.07, 0.2)
  }
  buildNorthernRegion({ box, shape, tree, fence, windowAt, root, lowPower, Group })

  // 同材質的靜態模型合併成一筆繪製，樹列與草地不逐物件發出 draw call。
  root.updateMatrixWorld(true)
  const batches = new Map()
  root.traverse(object => {
    if (!object.isMesh || ripples.includes(object)) return
    // 屋頂及建築包圍盒作降雨落點；雨不會在屋內继续落下。
    if (object.geometry === geometry.box && object.scale.x > 2 && object.scale.z > 1 && object.position.y > 2.7) {
      surfaces.push(new Box3().setFromObject(object))
    }
    const transformed = object.geometry.clone().applyMatrix4(object.matrixWorld)
    if (!batches.has(object.material)) batches.set(object.material, [])
    batches.get(object.material).push(transformed)
  })
  root.clear()
  const merged = []
  batches.forEach((parts, mat) => {
    const combined = mergeGeometries(parts)
    parts.forEach(part => part.dispose())
    merged.push(combined)
    root.add(new Mesh(combined, mat))
  })
  ripples.forEach(ripple => root.add(ripple))
  const weather = createWeather(scene, { lowPower, trees, flowers, surfaces, clouds })
  let windTime = 0
  const flightPosition = new Vector3()
  const flightTarget = new Vector3()
  function resize(w, h) {
    camera.aspect = w / h
    // 直向螢幕維持足夠橫向視野，仍保留透視與低空高度。
    camera.fov = w < h ? 72 : 56
    camera.updateProjectionMatrix()
  }
  function update(pointer, now, reduced, progress = 0, dt = 0) {
    if (!reduced) windTime += Math.max(0, Math.min(dt, .1))
    weatherUniforms.time.value = reduced ? 0 : windTime
    clouds.update(dt, reduced)
    // 減少動態時固定在真新鎮，完全停用捲動飛行與波紋。
    sampleFlight(reduced ? 0 : progress, flightPosition, flightTarget)
    const amplitude = camera.aspect < 1 ? 0.25 : 0.55
    camera.position.copy(flightPosition)
    camera.position.x += reduced ? 0 : pointer.x * amplitude
    camera.position.y += reduced ? 0 : pointer.y * 0.15
    camera.lookAt(flightTarget)
    weather.update(dt, camera, reduced)
    const env = weather.environment()
    weatherUniforms.wind.value = reduced ? 0 : env.wind
    weatherUniforms.aura.value = reduced ? 0 : weather.state.weights.aura
    if (!reduced) ripples.forEach((r, i) => { r.scale.x = 0.7 + Math.sin(now / 1200 + i) * 0.2 })
  }
  function setLook(look, env = weather.environment()) {
    clouds.setLook(look, env)
    weather.setLook(look)
    scene.fog.near = 45 - env.fog * 28
    scene.fog.far = 130 - env.fog * 65
    for (const [color, mat] of materials) {
      if (vegetation.has(color)) continue
      mat.roughness = .85 - env.wet * .57 - env.metal * .3
      mat.metalness = env.metal * .45 + env.wet * .08
    }
    scene.fog.color.copy(look.skyBottom)
    sun.color.copy(look.light)
    sun.intensity = 2.8 * (1 - look.windows * 0.65)
    ambient.intensity = 2.1 - look.windows * 0.75
    ambient.color.copy(new Color('#d7edff')).lerp(new Color('#879cdb'), look.windows)
    glass.emissive.set('#ffc875'); glass.emissiveIntensity = look.windows * 1.4
    glass.color.set('#83c8e2').lerp(new Color('#ffe4a2'), look.windows)
  }
  return { scene, camera, weather, resize, update, setLook, dispose() {
    clouds.dispose()
    weather.dispose()
    merged.forEach(g => g.dispose())
    Object.values(geometry).forEach(g => g.dispose())
    materials.forEach(m => m.dispose())
    scene.clear()
  } }
}
