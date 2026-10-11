// HD-2D 原型的地形高低差，參考《三角戰略》的擋土牆與階梯：
// 一號道路沿原本的土坡線分成四層台地、往北逐層升高，常磐市坐落在較低一層的台地；
// 沒有橫跨全寬的土坡，後方是往北延伸、與下一層台地相連的高地，土坡就是高地南緣的擋土牆。
// 真新鎮保持平地，只有研究所座落在石牆圍起的小丘上（動畫中研究所位於坡頂）。
// 路面跨越高低差處都設階梯，村民沿路走動時高度連續。只在 HD-2D 畫風建立。

/** 由南往北的台地邊界：z 以北的地面比以南高 rise（負值為往下）。 */
export const TERRACES = [
  { z: -34.7, rise: .8 },
  { z: -62.8, rise: .8 },
  { z: -87.8, rise: .8 },
  { z: -101.3, rise: .8 },
  { z: -112, rise: -1.2 }
]
/** 研究所小丘：與研究所庭院同範圍。 */
export const LAB_HILL = { x0: 1.85, x1: 12.15, z0: .35, z1: 7.65, height: 1.2 }
/** 地形方塊的東西範圍；高地延伸到這裡，兩側樹林下不留斷面。 */
const EDGE = 60

const WALL = '#8f8374'
const STEP = '#a39884'
const TURF = '#72b98a'

/** 台地高度，只看南北位置。 */
export function bandHeight(z) {
  return TERRACES.reduce((height, t) => (z < t.z ? height + t.rise : height), 0)
}

/**
 * 土坡後方的高地：south 是土坡（高地南緣的擋土牆），往北延伸到 north 與下一層台地同高相連。
 * 東側土坡橫跨東側土路，西緣靠土路處設石階；西側土坡的東端留出原作的缺口。
 */
export const PLATEAUS = [
  { x0: 9, x1: EDGE, north: -62.8, south: -47.96 },
  { x0: -EDGE, x1: -4.25, north: -87.8, south: -75.8 }
].map(p => ({ ...p, height: bandHeight(p.north - .01) }))

const onHill = (x, z) => x >= LAB_HILL.x0 && x <= LAB_HILL.x1 && z >= LAB_HILL.z0 && z <= LAB_HILL.z1
const plateauAt = (x, z) => PLATEAUS.find(p => x >= p.x0 && x <= p.x1 && z >= p.north && z < p.south)

/** 不含階梯的地面高度：物件依中心點抬到這個高度。 */
export function groundAt(x, z) {
  if (onHill(x, z)) return LAB_HILL.height
  return plateauAt(x, z)?.height ?? bandHeight(z)
}

/**
 * 階梯：沿 axis（'z' 南北向、'x' 東西向）由 top（高處邊緣）往 bottom（低處）下降，
 * 以另一軸的 at 置中、寬 width。都架在低處那一側。
 */
const STAIR_SPECS = [
  { axis: 'z', at: 0, width: 3, top: -34.7, bottom: -32.3 },
  { axis: 'z', at: -7.6, width: 3, top: -62.8, bottom: -60.4 },
  { axis: 'z', at: 11, width: 3, top: -87.8, bottom: -85.4 },
  { axis: 'z', at: 12, width: 3, top: -101.3, bottom: -98.9 },
  { axis: 'z', at: 0, width: 3.4, top: -112, bottom: -114.4 },
  { axis: 'z', at: 7, width: 2.2, top: 7.65, bottom: 9.2 },
  { axis: 'x', at: -60.4, width: 3, top: 9, bottom: 6.6 }
]
/** 階梯上一點的世界座標 [x, z]：along 沿階梯方向，across 為橫向（預設階梯中線）。 */
export const stairPoint = (s, along, across = s.at) => (s.axis === 'z' ? [across, along] : [along, across])

/** 階梯兩端的高度由地形推得：高處取邊緣外側一點，低處取階梯末端。 */
export const STAIRS = STAIR_SPECS.map(s => {
  const outward = Math.sign(s.top - s.bottom) * .05
  return { ...s, high: groundAt(...stairPoint(s, s.top + outward)), low: groundAt(...stairPoint(s, s.bottom)) }
})
/** 階梯兩側矮牆的寬度與中心（橫向座標）；村民不能穿過矮牆從階梯側面跳下。 */
export const CHEEK = .36
export const cheekAt = (s, side) => s.at + side * (s.width + CHEEK) / 2

/** 可行走的地面高度（含階梯斜坡），村民依此上下樓梯。 */
export function terrainAt(x, z) {
  for (const s of STAIRS) {
    const [along, across] = s.axis === 'z' ? [z, x] : [x, z]
    if (Math.abs(across - s.at) > s.width / 2) continue
    const t = (along - s.top) / (s.bottom - s.top)
    if (t >= 0 && t <= 1) return s.high + (s.low - s.high) * t
  }
  return groundAt(x, z)
}

const smoothstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t) }

/** 鏡頭高度的平滑補償：跨越台地時在前後 7 單位內漸變，不會突然跳動。 */
export function cameraRise(z) {
  return TERRACES.reduce((height, t) => height + t.rise * smoothstep(t.z + 7, t.z - 7, z), 0)
}

/** 把跨越台地邊界或高地邊緣的路面矩形切成數段 [x, z, w, d]，各段再依中心抬到所在高度。 */
export function splitAtEdges(x, z, w, d) {
  const west = x - w / 2, east = x + w / 2, north = z - d / 2, south = z + d / 2
  const zCuts = TERRACES.map(t => t.z), xCuts = []
  for (const p of PLATEAUS) {
    if (p.x1 <= west || p.x0 >= east || p.south <= north || p.north >= south) continue
    zCuts.push(p.north, p.south)
    xCuts.push(p.x0, p.x1)
  }
  const cut = (lo, hi, cuts) => {
    const edges = [lo, ...cuts.filter(c => c > lo && c < hi).sort((a, b) => a - b), hi]
    return edges.slice(1).map((edge, i) => [(edges[i] + edge) / 2, edge - edges[i]])
  }
  return cut(west, east, xCuts).flatMap(([cx, cw]) => cut(north, south, zCuts).map(([cz, cd]) => [cx, cz, cw, cd]))
}

/** 距離台地邊界不到 margin 的原有土坡由擋土牆取代。 */
export const nearTerrace = (z, margin = 1) => TERRACES.some(t => Math.abs(t.z - z) < margin)

/**
 * 建立台地、高地、擋土牆、研究所小丘與階梯，回傳建立的方塊（標記 userData.terrain，合併時不再抬升）。
 * box(color, x, y, z, w, h, d) 與 village.js 相同。
 */
export function buildTerrain(box) {
  const made = []
  const add = mesh => { mesh.userData.terrain = true; made.push(mesh) }
  let height = 0
  TERRACES.forEach((t, i) => {
    height += t.rise
    const south = t.z, north = TERRACES[i + 1]?.z ?? -200
    // 頂面比台地高度低 0.08，與平地的地面同高，原本貼地的路面與長草抬升後剛好露出；
    // 草皮往較低的一側多伸出一點，形成牆頂的草緣。
    const lipSouth = t.rise > 0 ? .12 : 0, lipNorth = (TERRACES[i + 1]?.rise ?? 0) < 0 ? .12 : 0
    add(box(WALL, 0, (height - .1) / 2, (south + north) / 2, EDGE * 2, height - .1, south - north))
    add(box(TURF, 0, height - .13, (south + lipSouth + north - lipNorth) / 2, EDGE * 2, .1, south + lipSouth - north + lipNorth))
  })
  // 高地：南緣與朝向低處的側緣是擋土牆並留草緣；北端接上同高的台地，由台地的草緣蓋住接縫。
  for (const p of PLATEAUS) {
    add(box(WALL, (p.x0 + p.x1) / 2, (p.height - .1) / 2, (p.north + p.south) / 2, p.x1 - p.x0, p.height - .1, p.south - p.north))
    const west = p.x0 - (p.x0 > -EDGE ? .12 : 0), east = p.x1 + (p.x1 < EDGE ? .12 : 0), north = p.north + .12, south = p.south + .12
    add(box(TURF, (west + east) / 2, p.height - .13, (north + south) / 2, east - west, .1, south - north))
  }
  // 研究所小丘：石牆比庭院略內縮，庭院抬升後成為丘頂並留出草緣。
  const hill = LAB_HILL
  add(box(WALL, (hill.x0 + hill.x1) / 2, hill.height / 2 - .02, (hill.z0 + hill.z1) / 2, hill.x1 - hill.x0 - .1, hill.height - .04, hill.z1 - hill.z0 - .1))
  // 階梯：每階約 0.2 高，從低處地面砌起；兩側有略高於階面的石牆。
  for (const s of STAIRS) {
    const steps = Math.max(2, Math.round(Math.abs(s.high - s.low) / .2))
    const run = (s.bottom - s.top) / steps
    // 沿階梯方向長 length、橫向寬 breadth 的方塊。
    const block = (color, along, across, bottom, top, length, breadth) => {
      const [x, z] = stairPoint(s, along, across)
      const [w, d] = s.axis === 'z' ? [breadth, length] : [length, breadth]
      return box(color, x, (bottom + top) / 2, z, w, top - bottom, d)
    }
    for (let i = 0; i < steps; i++) {
      const top = s.high - (s.high - s.low) * i / steps, along = s.top + (i + .5) * run
      add(block(STEP, along, s.at, s.low, top, Math.abs(run), s.width))
      for (const side of [-1, 1]) add(block(WALL, along, cheekAt(s, side), s.low, top + .25, Math.abs(run), CHEEK))
    }
  }
  return made
}
