import { createWeather } from './weather.js'
import { createSurfaceWeather, addLandscapeWeather } from './weather-surfaces.js'
import { createClouds } from './clouds.js'
import { sampleFlight } from './journey.js'
import { buildNorthernRegion } from './region.js'
import { createGableGeometry, createBladeGeometry, addSurfaceDetail, addPixelTexture } from './scenery.js'
import { createPixelPatterns, drawTreeAtlas, TREE_VARIANTS, ROUND_TREES } from './pixel-art.js'
import { createTufts } from './tufts.js'
import { buildTerrain, groundAt, terrainAt, cameraRise } from './terrain.js'
import { createBillboards } from './billboards.js'
import { createVillagers } from './villagers.js'
import { createSceneLook } from './look.js'
import { createSeriesSign, SERIES_SIGN } from './series-sign.js'
import { BREEZE } from '../config/weather.js'
import { periodByKey } from '../config/dayCycle.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
// 依真新鎮參考圖建立可受光的立體微縮模型；所有幾何與材質共用並集中釋放。
import { Scene, Group, PerspectiveCamera, Fog, Vector3, Mesh, BoxGeometry, ConeGeometry, SphereGeometry, IcosahedronGeometry, CylinderGeometry, MeshStandardMaterial, HemisphereLight, DirectionalLight, Color, Box3, DoubleSide, Float32BufferAttribute } from 'three'

/** 太陽方向（相對受光點）。HD-2D 改為左側光，影子落在物體右側而不被建築本身擋住。 */
const SUN_OFFSET = new Vector3(-18, 30, 15)
const HD2D_SUN_OFFSET = new Vector3(-26, 26, 5)
/** HD-2D 陰影貼圖的涵蓋半徑與解析度。 */
const SHADOW_SPAN = 36
const SHADOW_MAP = 2048
/** HD-2D 看板在夜晚至少保留自身顏色的比例（見 billboards.js 的 setFloor）。 */
const SPRITE_NIGHT_FLOOR = .2
/** 像素樹樹幹的半寬（相對看板寬度，48 格中的 4 格）：樹影從樹根朝光源那一側的邊緣開始延伸。 */
const TREE_ROOT_SHIFT = 4 / 48

/**
 * sceneLook 為場景外觀（look.js），持有天氣權重；未傳入時以白天建立，供單獨建立村莊的測試使用。
 * series 為目前的卡牌系列，決定系列路牌朝外的那一面（PLAN §15.8）。
 */
export function createVillage({ lowPower = false, hd2d = false, pitch, sceneLook = createSceneLook(periodByKey('day')), series } = {}) {
  const scene = new Scene()
  const clouds = createClouds({ lowPower })
  scene.add(clouds.mesh)
  const root = new Group()
  scene.add(root)
  const camera = new PerspectiveCamera(56, 1, 0.1, 240)
  scene.fog = new Fog('#d9f0ff', 45, 130)
  const geometry = {
    box: new BoxGeometry(1, 1, 1),
    crown: new SphereGeometry(1, lowPower ? 8 : 12, lowPower ? 6 : 8),
    bud: new SphereGeometry(1, 7, 5),
    rock: new IcosahedronGeometry(1, 0),
    gable: createGableGeometry(),
    blade: createBladeGeometry(),
    cone: new ConeGeometry(1, 1, 8),
    cylinder: new CylinderGeometry(1, 1, 1, 10)
  }
  // 多面岩石原始幾何沒有索引，補齊後可與其他同色模型合併。
  geometry.rock.setIndex(Array.from({ length: geometry.rock.attributes.position.count }, (_, i) => i))
  const trees = [], flowers = [], surfaces = [], glints = []
  // 草的藤蔓錨點（圍欄柱與牆角，世界座標、已抬上台地）與水的路邊細水流（真新鎮道路邊緣的線段 [x0, z0, x1, z1]，由上游往下游）。
  const posts = [], corners = []
  const streams = [
    ...[-1.75, 1.75].flatMap(x => [[x, -18.5, x, -2.7], [x, .7, x, 7.4], [x, 10.6, x, 18.5]]),
    ...[[-16, -14.5], [-11.5, -2.1], [2.1, 5.8], [8.2, 11.5], [14.5, 16]].map(([x0, x1]) => [x0, 7.75, x1, 7.75]),
    ...[[-16, -14.5], [-11.5, -2.1], [2.1, 11.5], [14.5, 16]].map(([x0, x1]) => [x0, 10.25, x1, 10.25])
  ]
  const weatherUniforms = createSurfaceWeather()
  // 草的光斑只在有陰影貼圖時落在樹蔭與屋影裡（weather-surfaces.js）。
  weatherUniforms.shadowMap.value = hd2d && !lowPower ? 1 : 0
  const patterns = hd2d ? createPixelPatterns() : null
  const vegetation = new Set(['#3b7850','#73ad64','#88ba6d','#a0cb7f','#3f8c5a','#85bc6f','#b4d497','#8cc58e','#357953','#43865b'])
  // HD-2D 的花瓣與花心也隨風擺動，才不會與底下的葉叢錯開。
  const blossoms = new Set(['#e77067','#e77973','#ffe09b'])
  const sways = color => vegetation.has(color) || (hd2d && blossoms.has(color))
  const materials = new Map()
  function material(color) {
    if (!materials.has(color)) {
      const mat = new MeshStandardMaterial({ color, roughness: 0.9, flatShading: !vegetation.has(color) })
      addSurfaceDetail(mat, color)
      if (color === '#3f8c5a' || color === '#85bc6f') mat.side = DoubleSide
      addLandscapeWeather(mat, weatherUniforms, { vegetation: sways(color), water: color === '#8fcad2' || color === '#4b98b4', breeze: hd2d })
      const pattern = patterns?.forColor(color)
      if (pattern) addPixelTexture(mat, pattern)
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
  const ambient = new HemisphereLight('#e6f4ff', '#638366', 1.9)
  const sun = new DirectionalLight('#fff1d0', 2.25)
  const sunOffset = hd2d ? HD2D_SUN_OFFSET : SUN_OFFSET
  // HD-2D 壓低環境光、提高直射光：受光面亮度相近，影子明顯加深。
  const lighting = hd2d ? { sun: 3, ambient: 1.25 } : { sun: 2.25, ambient: 1.9 }
  sun.position.copy(sunOffset)
  scene.add(ambient, sun)
  // HD-2D 的建築與樹投下實際陰影；陰影範圍跟著鏡頭移動（見 update），低效能裝置不開。
  const shadowed = hd2d && !lowPower
  if (shadowed) {
    sun.castShadow = true
    sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP)
    Object.assign(sun.shadow.camera, { left: -SHADOW_SPAN, right: SHADOW_SPAN, top: SHADOW_SPAN, bottom: -SHADOW_SPAN, near: 1, far: 110 })
    sun.shadow.camera.updateProjectionMatrix()
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.04
    sun.shadow.radius = 3
    scene.add(sun.target)
  }
  // 草地與十字路徑：保留原圖的中央南北通道與住宅前方橫向通道。
  // 整片基底草地；HD-2D 的台地另外堆疊在上面，基底本身不抬升。
  box('#72b98a', 0, -0.65, -85, 500, 1, 700).userData.terrain = true
  // 薄荷綠通行地面包圍較深色的四塊庭院，對齊參考圖。
  box('#a4d6ae', 0, -0.13, 0, 31, 0.08, 34)
  for (const [x, z, w, d] of [[-7,-8,9.4,8],[7,-8,9.4,8],[-7.2,4.8,9.4,6.7],[7,4,10.3,7.3]]) {
    box('#72b98a', x, -0.06, z, w, 0.08, d)
    box('#639f75', x + .22, -0.01, z + .35, w - .8, .04, d - .8)
  }
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
    shape('gable', '#d9e1df', 0, 3.4, 0, 6, 1.12, 4.5, p)
    for (const side of [-1,1]) {
      box('#657788', side * 3.01, 1.8, 0, .12, 3.2, 4.5, p)
      box('#d9e1df', side * 3.08, 1.8, 0, .06, 2.95, 4.2, p)
    }
    box('#52677f', 0, 3.36, 0, 6.55, .18, 4.9, p)
    // HD-2D 的牆板橫紋由像素圖樣提供。
    if (!hd2d) for (let y = 0.7; y < 3.3; y += 0.5) box('#b4c6c8', 0, y, 2.26, 6, 0.045, 0.025, p)
    // 雙坡屋頂，稜脊與瓦條都有厚度。
    for (const side of [-1, 1]) {
      const roof = box('#cf6754', 0, 3.9, side * 1.32, 6.8, 0.22, 2.95, p)
      roof.rotation.x = side * 0.39
      for (let i = 0; i < 6; i++) {
        const t = 0.18 + i * 0.45
        const tile = box(i % 2 ? '#e38b64' : '#e99b70', 0, 4.61 - t * Math.tan(.39), side * t, 6.75, 0.09, 0.11, p)
        tile.rotation.x = side * 0.39
      }
      for (const x of [-3.3, 3.3]) {
        const fascia = box('#ae4b49', x, 3.94, side * 1.32, .16, .3, 3.05, p)
        fascia.rotation.x = side * .39
      }
      box('#ae4b49', 0, 3.4, side * 2.68, 6.85, .2, .18, p)
    }
    box('#ae4b49', 0, 4.62, 0, 6.9, 0.19, 0.2, p)
    windowAt(-1.55, 2.65, 2.29, 1.4, 0.65, p)
    windowAt(0.55, 2.65, 2.29, 1.6, 0.65, p)
    windowAt(0.65, 1.2, 2.29, 1.8, 0.65, p)
    box('#8b4d53', -1.9, 0.95, 2.34, 1.1, 1.65, 0.16, p)
    box('#85b5d1', -1.9, 1.35, 2.44, 0.82, 0.57, 0.07, p)
    box('#e0c5aa', -1.9, 0.2, 2.7, 1.4, 0.22, 0.8, p)
    box('#637b83', -4, 0.55, 2, 0.16, 1.1, 0.18, p)
    box('#d6e5df', -4, 1.1, 2, 0.65, 0.55, 0.65, p)
    box('#779eb0', -4, 1.08, 2.34, 0.47, 0.09, 0.03, p)
    shape('crown', '#d6e5df', -4, 1.39, 2, .325, .25, .325, p)
  }
  house(-7, -8); house(7, -8)

  // 黃磚研究所、灰瓦平屋頂、紅色通風塔與四個圓窗。
  const lab = new Group(); lab.position.set(7, 0, 4); root.add(lab)
  box('#73838b', 0, 0.16, 0, 9, 0.32, 5.8, lab)
  box('#e9d792', 0, 1.5, 0, 8.6, 2.7, 5.4, lab)
  for (let row = 0; row < (hd2d ? 0 : 5); row++) {
    const y = 0.5 + row * 0.48
    box('#f5e8b5', 0, y, 2.71, 8.6, 0.055, 0.03, lab)
    for (let j = 0; j < 8; j++) box('#f5e8b5', -3.9 + j * 1.1 + (row % 2) * 0.45, y + 0.23, 2.72, 0.05, 0.42, 0.03, lab)
  }
  box('#586578', 0, 3, 0, 9.1, 0.36, 5.9, lab)
  box('#9fa8b9', 0, 3.23, 0, 8.6, 0.14, 5.4, lab)
  if (!hd2d) {
    for (let x = -4; x <= 4; x += 0.65) box('#737f92', x, 3.32, 0, 0.045, 0.025, 5.4, lab)
    for (let z = -2.6; z < 2.7; z += 0.65) box('#737f92', 0, 3.33, z, 8.6, 0.025, 0.045, lab)
  }
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
  box('#e0c5aa', 0, .15, 3.18, 1.8, .22, .9, lab)
  for (const x of [-4.45,4.45]) box('#586578', x, 3.42, 0, .18, .3, 5.9, lab)
  for (const z of [-2.86,2.86]) box('#586578', 0, 3.42, z, 9.1, .3, .18, lab)

  function fence(x, z, count, vertical = false) {
    if (vertical) {
      const p = new Group(); p.position.set(x, 0, z); p.rotation.y = -Math.PI / 2; root.add(p)
      box('#c0c9c6', (count - 1) * .31, .5, 0, count * .62, .15, .12, p)
      for (let i=0; i<count; i++) {
        box('#52677f', i*.62, .47, 0, .38, .88, .27, p)
        box('#dbe1d4', i*.62, .53, .025, .28, .9, .25, p)
        shape('crown', '#dbe1d4', i*.62, .98, .025, .14, .12, .125, p)
      }
      return
    }
    box('#c0c9c6', x + (count - 1) * 0.31, 0.6, z, count * 0.62, 0.15, 0.12)
    for (let i = 0; i < count; i++) {
      box('#dbe1d4', x + i * 0.62, 0.47, z, 0.35, 0.9, 0.24)
      shape('crown', '#dbe1d4', x + i * 0.62, .93, z, .175, .16, .12)
    }
  }
  fence(-10, 2.5, 9); fence(3, 10, 15); fence(-1, 17, 20)
  // 系列路牌的立柱；會翻面的牌面在合併之後另外加入（series-sign.js）。
  box('#816c50', SERIES_SIGN.x, .43, SERIES_SIGN.z, .16, .86, .16)
  // 花圃：兩排紅花，綠葉與黃色花心。
  box('#639f75', -7.2, 0, 5.7, 7, 0.12, 4)
  for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
    const x = -9.7 + col * 1.25, z = 4.6 + row * 1.5
    shape('crown', '#357953', x, 0.2, z, 0.52, 0.25, 0.5)
    for (let i = 0; i < 5; i++) shape('crown', '#e77067', x + Math.cos(i * 1.257) * 0.24, 0.47, z + Math.sin(i * 1.257) * 0.24, 0.23, 0.17, 0.23)
    shape('crown', '#ffe09b', x, 0.56, z, 0.14, 0.13, 0.14)
  }
  // 兩地共用池岸與水紋，水面保留世界座標以接收降雨漣漪。
  function pond(x, z, w, d) {
    box('#867c79', x, 0, z, w, .3, d)
    box('#52677f', x, .13, z, w-.24, .08, d-.24)
    box('#4b98b4', x, .18, z, w-.55, .06, d-.55)
    for (let i=0; i<Math.ceil(w/.5); i++) {
      for (const side of [-1,1]) box(i%2 ? '#947965' : '#b5987b', x-w/2+.25+i*.5, .18, z+side*(d/2-.1), .38, .18, .22)
    }
    for (let i=0; i<Math.ceil(d/.5); i++) {
      for (const side of [-1,1]) box(i%2 ? '#947965' : '#b5987b', x+side*(w/2-.1), .18, z-d/2+.25+i*.5, .22, .18, .38)
    }
    for (let i=0; i<6; i++) {
      box('#8fcad2', x-w*.33+(i%3)*w*.23, .222, z-d*.4+i*d*.14, .55+(i%3)*.16, .012, .035)
    }
  }
  pond(-7.2, 13.7, 5.6, 6.4)
  const treeSprites = []
  function tree(x, z, seed) {
    trees.push({x,z})
    const s = .9 + (seed % 5) * .035
    // HD-2D 的樹身是像素看板；有真實陰影時不再畫地面的樹影圓盤，低效能裝置沒有陰影，保留圓盤代替。
    if (hd2d) { treeSprites.push({ x, z, seed, s }); if (shadowed) return }
    // 深色根部與三層扇貝狀葉簇，保留遊戲圖的尖頂橢圓輪廓。
    shape('cylinder', '#639f75', x+.15, -.045, z+.18, 1.4*s, .04, 1.2*s)
    if (hd2d) return
    shape('cylinder', '#826b4b', x, .65, z, .27, 1.3, .27)
    shape('crown', '#3b7850', x, 1.45, z, 1.24*s, .88*s, 1.14*s)
    shape('crown', '#73ad64', x, 2.1, z, 1.18*s, .9*s, 1.09*s)
    shape('crown', '#88ba6d', x-.06, 2.83, z, .88*s, .86*s, .81*s)
    shape('crown', '#a0cb7f', x-.1, 3.36, z, .48*s, .62*s, .46*s)
    for (let i=0; i<(lowPower ? 4 : 7); i++) {
      const angle = i*Math.PI*2/(lowPower ? 4 : 7) + seed*.12
      shape('bud', i%2 ? '#88ba6d' : '#73ad64', x+Math.cos(angle)*.83*s, 2.05+(i%2)*.2, z+Math.sin(angle)*.8*s, .43*s, .42*s, .43*s)
    }
    for (let i=0; i<(lowPower ? 3 : 5); i++) {
      const angle=i*Math.PI*2/(lowPower ? 3 : 5)+seed*.1
      shape('bud', '#a0cb7f', x+Math.cos(angle)*.59*s, 2.87, z+Math.sin(angle)*.57*s, .32*s,.32*s,.32*s)
    }
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
  buildNorthernRegion({ box, shape, tree, fence, windowAt, root, lowPower, Group, pond, terraced: hd2d })
  if (hd2d) buildTerrain(box)

  // 同材質的靜態模型合併成一筆繪製，樹列與草地不逐物件發出 draw call。
  root.updateMatrixWorld(true)
  const batches = new Map()
  // HD-2D：合併前記下每個方塊的範圍與顏色，供草叢判斷哪裡是裸露的草地。
  const colorOf = new Map([...materials].map(([color, mat]) => [mat, color]))
  const groundBoxes = []
  const center = new Vector3()
  root.traverse(object => {
    if (!object.isMesh) return
    const bounds = new Box3().setFromObject(object)
    // HD-2D 地形：物件依中心點抬到所在台地或小丘的高度；台地、牆與階梯本身已在正確高度。
    bounds.getCenter(center)
    const lift = hd2d && !object.userData.terrain ? groundAt(center.x, center.z) : 0
    bounds.translate(center.set(0, lift, 0))
    if (hd2d && object.geometry === geometry.box) groundBoxes.push({ box: bounds, color: colorOf.get(object.material) })
    // 屋頂及建築包圍盒作降雨落點；雨不會在屋內继续落下。
    if (object.geometry === geometry.box && object.scale.x > 2 && object.scale.z > 1 && object.position.y > 2.7) {
      surfaces.push(bounds.clone())
      // 鋼的反光星芒沿平屋頂的四邊排列；斜屋頂的包圍盒角落懸空，改由下方的屋脊與屋簷取點。
      if (!object.rotation.x && !object.rotation.z) {
        const { min, max } = bounds
        for (let x = min.x; x <= max.x + .01; x += (max.x - min.x) / Math.max(1, Math.round((max.x - min.x) / 1.5))) {
          glints.push({ x, y: max.y + .12, z: min.z }, { x, y: max.y + .12, z: max.z })
        }
        for (let z = min.z + 1.5; z < max.z - .75; z += 1.5) glints.push({ x: min.x, y: max.y + .12, z }, { x: max.x, y: max.y + .12, z })
      }
    }
    // 屋脊、屋簷與圍欄柱頂也會反光。
    const color = colorOf.get(object.material)
    if (object.geometry === geometry.box && color === '#ae4b49' && object.scale.x > 6) {
      for (let t = .08; t < 1; t += .17) glints.push({ x: bounds.min.x + (bounds.max.x - bounds.min.x) * t, y: bounds.max.y + .1, z: (bounds.min.z + bounds.max.z) / 2 })
    }
    if (object.geometry === geometry.crown && color === '#dbe1d4') {
      glints.push({ x: (bounds.min.x + bounds.max.x) / 2, y: bounds.max.y + .05, z: (bounds.min.z + bounds.max.z) / 2 })
      // 藤蔓沿柱子往上爬：看板中心在柱子半高、稍微往鏡頭方向，才不會被柱子擋住。
      posts.push({ x: (bounds.min.x + bounds.max.x) / 2, y: (bounds.max.y + lift) / 2, z: (bounds.min.z + bounds.max.z) / 2 + .16 })
    }
    // 建築的牆：高 2.4 以上、邊長 3 以上的方塊（屋頂以下，不含 HD-2D 台地的擋土牆）；藤蔓長在面向鏡頭那面的兩個牆角。
    if (object.geometry === geometry.box && !object.userData.terrain && object.scale.y >= 2.4 && object.scale.x >= 3 && object.scale.z >= 3 && (bounds.min.y + bounds.max.y) / 2 < 2.7 + lift) {
      for (const x of [bounds.min.x + .05, bounds.max.x - .05]) corners.push({ x, y: lift + 1, z: bounds.max.z + .12 })
    }
    const transformed = object.geometry.clone().applyMatrix4(object.matrixWorld)
    if (lift) transformed.translate(0, lift, 0)
    // 植物記下所在地面高度，微風依離地高度擺動。
    if (hd2d && sways(colorOf.get(object.material))) {
      transformed.setAttribute('swayBase', new Float32BufferAttribute(new Float32Array(transformed.attributes.position.count).fill(lift), 1))
    }
    if (!batches.has(object.material)) batches.set(object.material, [])
    batches.get(object.material).push(transformed)
  })
  root.clear()
  const merged = []
  batches.forEach((parts, mat) => {
    const combined = mergeGeometries(parts)
    parts.forEach(part => part.dispose())
    merged.push(combined)
    const mesh = new Mesh(combined, mat)
    mesh.castShadow = mesh.receiveShadow = shadowed
    root.add(mesh)
  })
  // HD-2D：天氣的落點與近地效果依含階梯的地形高度抬到台地上。
  const weather = createWeather(scene, { state: sceneLook.weather, lowPower, trees, flowers, surfaces, glints, posts, corners, streams, clouds, ground: hd2d ? terrainAt : null })
  // 樹看板投下真實的樹形影子（billboards.js）；草叢與村民只接收陰影。
  const treeBillboards = hd2d && treeSprites.length ? createBillboards({
    canvas: drawTreeAtlas(), columns: TREE_VARIANTS, count: treeSprites.length, width: 3.1, height: 4.65,
    sway: { time: weatherUniforms.time, wind: weatherUniforms.wind, impact: weatherUniforms.impact }, castShadow: shadowed, sun: sunOffset.clone().normalize(),
    rootShift: TREE_ROOT_SHIFT
  }) : null
  treeSprites.forEach((t, i) => {
    // 真新鎮保留圓頂樹；道路兩側與城外的樹林多為針葉樹。
    const edge = Math.abs(t.x) >= 15.5
    const conifer = edge && (t.z < -19 ? t.seed % 3 !== 0 : t.seed % 3 === 0)
    const variant = conifer ? ROUND_TREES + (t.seed % (TREE_VARIANTS - ROUND_TREES)) : t.seed % ROUND_TREES
    treeBillboards.set(i, t.x, groundAt(t.x, t.z), t.z, variant, 0, false, t.s)
  })
  if (treeBillboards) { treeBillboards.commit(); scene.add(treeBillboards.mesh) }
  const tufts = hd2d ? createTufts({ boxes: groundBoxes, lowPower, sway: { time: weatherUniforms.time, wind: weatherUniforms.wind, impact: weatherUniforms.impact } }) : null
  if (tufts) scene.add(tufts.mesh)
  const villagers = hd2d ? createVillagers({ lowPower, heightAt: terrainAt }) : null
  if (villagers) scene.add(villagers.group)
  const sign = createSeriesSign({ series, ground: hd2d ? groundAt(SERIES_SIGN.x, SERIES_SIGN.z) : 0, weatherUniforms, breeze: hd2d, shadowed })
  scene.add(sign.group)
  let windTime = 0
  // 太陽方向：格鬥的夕陽把仰角壓低（setLook 只在外觀過場時計算），每幀沿用。
  const sunAim = sunOffset.clone()
  const flightPosition = new Vector3()
  const flightTarget = new Vector3()
  const shadowFocus = new Vector3()
  function resize(w, h) {
    camera.aspect = w / h
    // 直向螢幕維持足夠橫向視野，仍保留透視與低空高度。
    camera.fov = w < h ? 72 : 56
    camera.updateProjectionMatrix()
    villagers?.resize(w, h, camera)
  }
  function update(pointer, now, reduced, progress = 0, dt = 0) {
    if (!reduced) windTime += Math.max(0, Math.min(dt, .1))
    weatherUniforms.time.value = reduced ? 0 : windTime
    clouds.update(dt, reduced)
    // 減少動態時固定在真新鎮，完全停用捲動飛行與波紋。
    sampleFlight(reduced ? 0 : progress, flightPosition, flightTarget, pitch)
    const amplitude = camera.aspect < 1 ? 0.25 : 0.55
    // HD-2D 台地：鏡頭與注視點一起隨地形平滑升降，俯角不變。
    const rise = hd2d && !reduced ? cameraRise(flightPosition.z - 16) : 0
    flightPosition.y += rise
    flightTarget.y += rise
    camera.position.copy(flightPosition)
    camera.position.x += reduced ? 0 : pointer.x * amplitude
    camera.position.y += reduced ? 0 : pointer.y * 0.15
    camera.lookAt(flightTarget)
    if (shadowed) {
      // 陰影範圍跟著鏡頭前方地面移動；以陰影貼圖一格為單位對齊，移動時邊緣不閃爍。
      camera.getWorldDirection(shadowFocus).multiplyScalar(18).add(camera.position)
      const step = SHADOW_SPAN * 2 / SHADOW_MAP
      shadowFocus.set(Math.round(shadowFocus.x / step) * step, 0, Math.round(shadowFocus.z / step) * step)
      sun.target.position.copy(shadowFocus)
      sun.position.copy(shadowFocus).add(sunAim)
    }
    weather.update(dt, camera, reduced)
    // 村民依目前屬性天氣（null 為原景）挑對話；時段由 town.js 切換時段時傳入。
    villagers?.setWeather(sceneLook.weather.key)
    villagers?.update(Math.min(dt, .1), camera, reduced)
    sign.update(reduced ? Infinity : Math.min(dt, .1))
    const env = sceneLook.environment
    // HD-2D 晴天也有微風，植物持續輕輕擺動；有風的天氣取較大者。
    weatherUniforms.wind.value = reduced ? 0 : hd2d ? Math.max(BREEZE, env.wind) : env.wind
    weatherUniforms.motion.value = reduced ? 0 : 1
    for (const key of ['leaves','embers','orbs','shards','petals','rain','feathers','mist']) {
      weatherUniforms[key].value = sceneLook.weather.weights[key]
    }
    const { dragon } = weather
    weatherUniforms.dragon.value.set(dragon.x, dragon.z, dragon.angle, dragon.shadow)
    // 格鬥衝擊：減少動態時強度為 0，地景與看板都略過。
    weatherUniforms.impact.value.copy(weather.impact)
    weatherUniforms.impactGround.value = weather.impactGround
    // 雷的落雷點：地面電光圈；減少動態時強度為 0。
    weatherUniforms.strike.value.copy(weather.strike)
    weatherUniforms.strikeGround.value = weather.strikeGround
    // 鏡頭隨地形升降的高度即所在處的地面高度；貼地的暗影觸手與薄紫霧不爬上屋頂。
    weatherUniforms.ground.value = rise
  }
  function setLook(look, env = sceneLook.environment) {
    weatherUniforms.night.value = look.windows
    clouds.setLook(look, env)
    weather.setLook(look)
    scene.fog.near = 45 - env.fog * 28
    scene.fog.far = 130 - env.fog * 65
    // 場景沒有環境貼圖，金屬度高會把漫射光吃掉、整片變暗；鋼只略提金屬度，光澤靠低粗糙度、星芒與反光帶。
    const roughness = Math.max(.15, .85 - env.wet * .64 - env.metal * .45)
    const metalness = Math.min(.72, env.metal * .1 + env.wet * .14)
    for (const [color, mat] of materials) if (!vegetation.has(color)) Object.assign(mat, { roughness, metalness })
    for (const mat of sign.materials) Object.assign(mat, { roughness, metalness })
    sign.setNight(look.windows)
    scene.fog.color.copy(look.skyBottom)
    sun.color.copy(look.light)
    // 格鬥的夕陽：仰角壓低約 45%（HD-2D 約 45° → 25°）、長度不變，影子拉長；受光面變斜，直射光加強補回亮度。
    sunAim.copy(sunOffset)
    if (env.sunLow > 1e-6) {
      const flat = Math.hypot(sunOffset.x, sunOffset.z), length = sunOffset.length()
      const elevation = Math.atan2(sunOffset.y, flat) * (1 - env.sunLow * .45)
      sunAim.set(sunOffset.x / flat * Math.cos(elevation) * length, Math.sin(elevation) * length, sunOffset.z / flat * Math.cos(elevation) * length)
    }
    if (!shadowed) sun.position.copy(sunAim)
    sun.intensity = lighting.sun * (1 - look.windows * 0.65) * (1 + env.sunLow * .5)
    // 草的光斑：朝上地面在無遮蔽時的直射光量（強度 × 光色亮度 × 仰角 ÷ π），著色器以它判斷哪裡在影子裡。
    weatherUniforms.sunLit.value = sun.intensity * (sun.color.r + sun.color.g + sun.color.b) / 3 * Math.max(0, sunAim.y / sunAim.length()) / Math.PI
    ambient.intensity = lighting.ambient * (1 - look.windows * 0.34) * Math.max(.55, env.light)
    ambient.color.copy(new Color('#d7edff')).lerp(new Color('#879cdb'), look.windows).lerp(env.sky, env.tint*.28)
    glass.emissive.set('#ffc875'); glass.emissiveIntensity = look.windows * 1.4
    glass.color.set('#83c8e2').lerp(new Color('#ffe4a2'), look.windows)
    if (shadowed) {
      // 影子深淺跟著時段（config/dayCycle.js 的 shadow）：白天最深、清晨黃昏較淡、月光最淡；雲層厚時再變柔。
      sun.shadow.intensity = look.shadow * Math.max(.25, 1 - Math.max(0, env.cover - 1) * .6)
    }
    if (hd2d) {
      // 看板由場景燈光照亮、接收影子；夜晚另給最低亮度，人物與樹不會黑成剪影。
      const floor = look.windows * SPRITE_NIGHT_FLOOR
      treeBillboards?.setFloor(floor)
      tufts?.setFloor(floor)
      villagers?.setLook(floor)
    }
  }
  /** 切換系列時路牌翻面；instant 時直接換面（首次載入、減少動態）。 */
  function setSeries(id, instant = false) {
    sign.setSeries(id, instant)
  }
  return { scene, camera, weather, villagers, seriesSign: sign, resize, update, setLook, setSeries, overlay: villagers?.overlay ?? null, dispose() {
    clouds.dispose()
    sign.dispose()
    treeBillboards?.dispose()
    tufts?.dispose()
    villagers?.dispose()
    patterns?.dispose()
    weather.dispose()
    merged.forEach(g => g.dispose())
    Object.values(geometry).forEach(g => g.dispose())
    materials.forEach(m => m.dispose())
    scene.clear()
  } }
}
