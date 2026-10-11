// HD-2D 原型的像素素材：地景圖樣、像素樹、草叢與對話框，全部以程式繪製，不需外部圖檔（村民見 villager-art.js）。
// 畫風參考《三角戰略》的立體微縮場景，保留真新鎮的紅屋頂、白柵欄與圓頂樹。
import { DataTexture, RGBAFormat, UnsignedByteType, RepeatWrapping, NearestFilter, LinearMipmapLinearFilter, Color } from 'three'

// ── 地景圖樣 ──────────────────────────────────────────────
// 32×32 明暗圖，每單位 16 格（一張圖涵蓋 2 單位）。shader 以世界座標取樣：
// R 為明暗（tone / TONE_RANGE），G 為點綴色比例（屋瓦青苔、石縫苔蘚、草尖陽光、水面反光）。
export const PATTERN_SIZE = 32
export const PATTERN_WORLD = 2
/** 貼圖存 tone / TONE_RANGE，shader 再乘回；高光才能超過 1。 */
export const TONE_RANGE = 1.5
const D = .6, S = .8, B = 1, L = 1.12, H = 1.26
const N = PATTERN_SIZE

export function hash(x, y, seed = 0) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return s - Math.floor(s)
}
/** 圖樣內的有號相對座標，讓散佈的小圖案跨邊界時仍可平鋪。 */
const offset = (a, b) => ((a - b + N * 1.5) % N) - N / 2

/** 可平鋪的 Worley：回傳兩近點距離差（接縫）、到最近點的距離與方向（明暗）及該格代號。 */
function worley(x, y, cells, seed) {
  const size = N / cells
  const cx = Math.floor(x / size), cy = Math.floor(y / size)
  let f1 = Infinity, f2 = Infinity, dx = 0, dy = 0, id = 0
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const gx = cx + i, gy = cy + j
    const wx = ((gx % cells) + cells) % cells, wy = ((gy % cells) + cells) % cells
    const px = (gx + .2 + hash(wx, wy, seed) * .6) * size
    const py = (gy + .2 + hash(wy, wx, seed + 9) * .6) * size
    const d = Math.hypot(x + .5 - px, y + .5 - py)
    if (d < f1) { f2 = f1; f1 = d; dx = (x + .5 - px) / size; dy = (y + .5 - py) / size; id = hash(wx, wy, seed + 3) } else if (d < f2) f2 = d
  }
  return { edge: f2 - f1, near: f1 / size, shade: -(dx + dy), id }
}

/** 散佈的小圖案：shape 以相對座標回傳明暗（或 [明暗, 點綴]），不在圖案上回傳 null。 */
function scatter(x, y, count, seed, shape) {
  for (let i = 0; i < count; i++) {
    const tone = shape(offset(x, Math.floor(hash(i, 1, seed) * N)), offset(y, Math.floor(hash(i, 2, seed) * N)))
    if (tone !== null) return tone
  }
  return null
}

/** 石塊明暗：左上受光。 */
const lit = shade => (shade > .5 ? H : shade > .15 ? L : shade < -.35 ? S : B)

// 圖樣以影像座標描述：y 向下。牆面上 y 是世界的下方；斜屋頂上 y 是下坡方向。
// 回傳明暗值，或 [明暗, 點綴比例]。
const patterns = {
  // 魚鱗瓦：每片 8×8、上排壓住下排，弧形下緣描深色，弧下是上一片投下的陰影；約四分之一的瓦長青苔。
  roof(x, y) {
    const row = Math.floor(y / 8), shift = (row % 2) * 4
    const lx = (x + shift) % 8, ly = y % 8
    const arc = [4, 6, 7, 7, 7, 7, 6, 4][lx]
    if (ly > arc) return S
    if (ly === arc) return D
    const moss = hash(Math.floor((x + shift) / 8) % 4, row, 3) > .74 ? .55 : 0
    const tone = ly <= 1 && lx >= 1 && lx <= 3 ? H : lx <= 1 || ly <= 1 ? L : lx >= 6 || ly >= arc - 1 ? S : B
    return [tone, moss]
  },
  // 牆板：每片 8 格高的橫向木板，下緣留縫、上緣受光，接縫錯開，帶細木紋。
  siding(x, y) {
    const row = Math.floor(y / 8), ly = y % 8
    if (ly === 7) return D
    if (ly === 6) return S
    if (ly === 0) return L
    if (x === (row * 11 + 5) % N) return S
    const grain = hash(Math.floor(x / 6) + row * 7, ly, 7)
    return grain > .86 ? .92 : grain < .08 ? 1.06 : B
  },
  // 磚牆：16×8 的磚、淺色灰縫、錯縫排列，每塊磚明暗略有不同。
  brick(x, y) {
    const row = Math.floor(y / 8), shift = (row % 2) * 8
    const lx = (x + shift) % 16, ly = y % 8
    if (ly === 7 || lx === 15) return L
    if (ly === 0) return H
    if (ly === 6 || lx === 14) return S
    const tint = .92 + hash(Math.floor((x + shift) / 16) % 2, row, 5) * .14
    return (lx === 0 ? L : B) * tint
  },
  // 擋土牆與階梯：8 格高的切石層，每層兩塊寬度不一的石塊、錯縫，灰縫深色長苔、上緣受光。
  ashlar(x, y) {
    const row = Math.floor(y / 8), ly = y % 8
    const split = 12 + Math.floor(hash(row, 0, 41) * 9), offset = Math.floor(hash(row, 1, 42) * N)
    const lx = (x + offset) % N, second = lx >= split
    const local = second ? lx - split : lx, width = second ? N - split : split
    if (ly === 7 || local === width - 1) return [D, .35]
    if (ly === 0 || local === 0) return L
    if (ly === 6) return S
    return .93 + hash(row, second ? 3 : 2, 43) * .12
  },
  stone(x, y) {
    const { edge, shade } = worley(x, y, 5, 19)
    return edge < .7 ? D : lit(shade)
  },
  // 石板街：小圓石、深色石縫長一點苔。
  cobble(x, y) {
    const { edge, shade, id } = worley(x, y, 8, 11)
    if (edge < .8) return [D, .3]
    return lit(shade) * (.92 + id * .12)
  },
  // 真新鎮步道：16×16 方石板錯縫鋪設，邊緣倒角，石縫長苔。
  paving(x, y) {
    const row = Math.floor(y / 16), shift = (row % 2) * 8
    const lx = (x + shift) % 16, ly = y % 16
    if (lx === 15 || ly === 15) return [S, .6]
    if (lx === 0 || ly === 0) return L
    if (lx === 14 || ly === 14) return S
    if (hash(x, y, 8) > .985) return D
    return hash(Math.floor((x + shift) / 16) % 2, row, 9) > .5 ? 1.03 : .97
  },
  // 土路：夯實的泥土、小石子，四分之一的區塊鋪了零散的石頭。
  dirt(x, y) {
    if (hash(Math.floor(x / 16), Math.floor(y / 16), 13) > .7) {
      // 半埋的圓石：離格心近的是石頭，外圈描深色，左上受光。
      const { near, shade } = worley(x, y, 6, 14)
      if (near < .3) return [lit(shade), .75]
      if (near < .38) return S
    }
    return scatter(x, y, 9, 15, (dx, dy) => (dx === 0 && dy === 0 ? L : (dx === 0 || dx === 1) && dy === 1 ? S : dx === 1 && dy === 0 ? B : null))
      ?? (hash(x, y, 16) > .93 ? L : hash(x, y, 17) > .92 ? S : B)
  },
  // 草地：三格高的小草尖，尖端受陽光（點綴色），其下落影。
  grass: (x, y) => scatter(x, y, 16, 3, (dx, dy) =>
    dx === 0 && dy === 0 ? [H, .7] : Math.abs(dx) === 1 && dy === 1 ? [L, .3] : dx === 0 && dy === 1 ? L : Math.abs(dx) <= 1 && dy === 2 ? S : null)
    ?? (hash(x, y, 5) > .93 ? S : hash(x, y, 6) > .96 ? L : B),
  plaster(x, y) {
    if (hash(Math.floor(x / 2), Math.floor(y / 5), 18) > .985) return S
    return hash(x, y, 17) > .92 ? .94 : hash(x, y, 18) > .95 ? 1.05 : B
  },
  metal: x => (x % 8 === 7 ? S : x % 8 === 0 ? L : B),
  wood(x, y) {
    if (hash(Math.floor(x / 3), Math.floor(y / 10), 21) > .95) return D
    const grain = hash(x, 0, 22)
    return grain > .75 ? L : grain < .22 ? S : B
  },
  // 白色尖頭柵欄：直向木板。
  fence: x => (x % 8 === 7 ? S : x % 8 === 0 ? L : x % 8 === 6 ? .93 : B),
  rock(x, y) {
    const { edge, shade } = worley(x, y, 4, 23)
    return edge < .9 ? D : lit(shade)
  },
  foliage(x, y) {
    const { edge, shade } = worley(x, y, 6, 29)
    return edge < .8 ? D : lit(shade)
  },
  // 水面：短橫的反光（點綴為白色，景深模糊時化成散景）與暗色波紋。
  water: (x, y) => scatter(x, y, 7, 31, (dx, dy) => (dy === 0 && dx >= 0 && dx < 3 ? [H, .8] : dy === 1 && dx >= 1 && dx < 4 ? S : null)) ?? B,
  plain: (x, y) => ((x + y) % 2 ? 1.03 : .97)
}

const categories = {
  grass: ['#72b98a', '#639f75', '#559968'],
  paving: ['#a4d6ae'],
  cobble: ['#d2dfce', '#e3e4d6', '#e0c5aa'],
  dirt: ['#e0cb8e', '#e3cf91'],
  siding: ['#d9e1df', '#dfebe2', '#dae5df', '#d6e5df'],
  plaster: ['#e2dfb9', '#d8ceaa', '#edf1db', '#f1e7cb', '#f7edc4', '#f5e8b5', '#e9debd', '#f6edcf', '#b4c6c8'],
  brick: ['#e9d792'],
  ashlar: ['#8f8374', '#a39884'],
  stone: ['#657788', '#788891', '#73838b', '#586578', '#52677f', '#5d6973'],
  roof: ['#cf6754', '#e38b64', '#e99b70', '#ae4b49', '#d7685c', '#5597c1', '#6e9a4f', '#72a44f', '#b5a15d', '#ca7a68', '#8e5055'],
  metal: ['#9fa8b9', '#737f92', '#454e66'],
  wood: ['#816c50', '#826b4b', '#79734f', '#bfa463', '#8b4d53', '#617c86', '#637b83', '#427f73', '#8b8871'],
  fence: ['#dbe1d4', '#c0c9c6'],
  rock: ['#947965', '#b5987b', '#b0a084', '#867c79'],
  foliage: ['#3b7850', '#73ad64', '#88ba6d', '#a0cb7f', '#3f8c5a', '#85bc6f', '#b4d497', '#8cc58e', '#357953', '#43865b'],
  water: ['#4b98b4', '#8fcad2']
}
/** 各圖樣的點綴色：屋瓦、石縫與擋土牆灰縫的青苔、草尖的陽光、土路的灰石、水面的反光。 */
const accents = { roof: '#6f8a3a', paving: '#5f8f4f', cobble: '#6f8a4a', ashlar: '#6f8a4a', grass: '#e2e07a', dirt: '#a09a8c', water: '#ffffff' }
const categoryByColor = new Map(Object.entries(categories).flatMap(([key, colors]) => colors.map(c => [c, key])))
/** 玻璃維持透亮，不套圖樣。 */
const unpatterned = new Set(['#83c8e2', '#85b5d1', '#8cbfc4', '#779eb0'])

function patternTexture(paint) {
  const data = new Uint8Array(N * N * 4)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const value = paint(x, y)
    const [tone, accent] = Array.isArray(value) ? value : [value, 0]
    const i = ((N - 1 - y) * N + x) * 4 // 資料第一列是貼圖底部
    data[i] = Math.round(Math.min(1, tone / TONE_RANGE) * 255)
    data[i + 1] = Math.round(accent * 255)
    data[i + 2] = 0
    data[i + 3] = 255
  }
  const texture = new DataTexture(data, N, N, RGBAFormat, UnsignedByteType)
  texture.wrapS = texture.wrapT = RepeatWrapping
  // 近看保留銳利像素，遠處由 mipmap 平均成底色，不會閃爍。
  texture.magFilter = NearestFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

/** 依材質色取得 { texture, accent }；玻璃回傳 null。圖樣按需建立並共用。 */
export function createPixelPatterns() {
  const cache = new Map()
  return {
    forColor(color) {
      if (unpatterned.has(color)) return null
      const key = categoryByColor.get(color) ?? 'plain'
      if (!cache.has(key)) cache.set(key, { texture: patternTexture(patterns[key]), accent: new Color(accents[key] ?? '#000000') })
      return cache.get(key)
    },
    dispose() {
      cache.forEach(p => p.texture.dispose())
    }
  }
}

// ── 共用繪製工具 ──────────────────────────────────────────
export function canvasOf(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}

export function pixelWriter(image) {
  return (x, y, hex) => {
    const [r, g, b] = rgb(hex)
    const i = (y * image.width + x) * 4
    image.data[i] = r
    image.data[i + 1] = g
    image.data[i + 2] = b
    image.data[i + 3] = 255
  }
}

export const INK = '#2b2233'

// ── 像素樹 ────────────────────────────────────────────────
// 48×72 像素，與地景貼圖同樣約每單位 16 格。前三種是真新鎮的圓頂闊葉樹，後兩種是外圍樹林的針葉樹。
export const TREE_VARIANTS = 5
export const ROUND_TREES = 3
const TREE_W = 48, TREE_H = 72
const roundPalettes = [
  { outline: '#1d3a2a', deep: '#2a5a3e', shadow: '#3b7850', base: '#5a9a58', light: '#7fb866', highlight: '#b0d88a' },
  { outline: '#1c3833', deep: '#285a4a', shadow: '#347559', base: '#4f9368', light: '#74b27a', highlight: '#a4d49a' },
  { outline: '#243a1f', deep: '#35592c', shadow: '#4a7a3a', base: '#6a9c48', light: '#94c060', highlight: '#c8e08a' }
]
const coniferPalettes = [
  { outline: '#142b22', deep: '#1f4231', shadow: '#2c5a3f', base: '#3f7a4c', light: '#5f9a5a', highlight: '#8cbf74' },
  { outline: '#12282a', deep: '#1b3d3a', shadow: '#27564b', base: '#387260', light: '#56926f', highlight: '#86b98a' }
]
const trunkPalette = { outline: INK, light: '#a58a66', base: '#7d6446', shadow: '#5a4632' }
const TONES = ['deep', 'shadow', 'base', 'light', 'highlight']
/** -1（背光）到 1（受光）對應五階明暗。 */
const toneOf = shade => TONES[Math.max(0, Math.min(4, Math.floor((shade + 1) * 2.5)))]

/** 葉團：以 5 像素格點做 Worley，回傳該團的受光方向與團間縫隙。 */
function clump(x, y, seed) {
  const size = 5, cx = Math.floor(x / size), cy = Math.floor(y / size)
  let f1 = Infinity, f2 = Infinity, dx = 0, dy = 0
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const gx = cx + i, gy = cy + j
    const px = (gx + .15 + hash(gx, gy, seed) * .7) * size, py = (gy + .15 + hash(gy, gx, seed + 5) * .7) * size
    const d = Math.hypot(x + .5 - px, y + .5 - py)
    if (d < f1) { f2 = f1; f1 = d; dx = (x + .5 - px) / size; dy = (y + .5 - py) / size } else if (d < f2) f2 = d
  }
  return { gap: f2 - f1 < 1, shade: -(dx + dy) }
}

/** 數個橢圓葉團聯集，光從左上；每個小葉團各自受光，團間留暗縫，樹冠底部較暗。 */
function drawRoundTree(put, ox, v) {
  const palette = roundPalettes[v % roundPalettes.length]
  const j = (k, amount) => (hash(v, k, 41) - .5) * amount
  const blobs = [
    { cx: 24 + j(1, 4), cy: 17 + j(2, 3), rx: 12 + j(3, 3), ry: 11 },
    { cx: 24, cy: 33, rx: 19 + j(4, 3), ry: 14 },
    { cx: 13 + j(5, 3), cy: 42, rx: 10.5, ry: 9.5 },
    { cx: 35 + j(6, 3), cy: 42, rx: 10.5, ry: 9.5 },
    { cx: 24, cy: 47, rx: 15, ry: 8.5 }
  ]
  const canopy = (x, y) => {
    let best = null
    for (const b of blobs) {
      const nx = (x + .5 - b.cx) / b.rx, ny = (y + .5 - b.cy) / b.ry, d = nx * nx + ny * ny
      if (d < 1 && (!best || d < best.d)) best = { nx, ny, d }
    }
    return best
  }
  const left = y => (y >= 65 ? 19 : 20), right = y => (y >= 65 ? 28 : 27)
  for (let y = 0; y < TREE_H; y++) for (let x = 0; x < TREE_W; x++) {
    const leaf = canopy(x, y)
    if (leaf) {
      if (!canopy(x - 1, y) || !canopy(x + 1, y) || !canopy(x, y - 1) || !canopy(x, y + 1)) { put(ox + x, y, palette.outline); continue }
      const bunch = clump(x, y, v + 50)
      let shade = -(leaf.nx * .59 + leaf.ny * .81) * .7 + (1 - leaf.d) * .25 - .1 + bunch.shade * .45
      if (bunch.gap) shade -= .45
      if (y > 44) shade -= (y - 44) * .03
      shade += (x + y) % 2 ? .04 : -.04
      put(ox + x, y, palette[toneOf(shade)])
    } else if (y >= 48 && x >= left(y) && x <= right(y)) {
      // 樹幹畫到最底列，看板站在地面上時樹腳與地面相接，投下的影子也從樹腳開始。
      const edge = y === TREE_H - 1 || x === left(y) || x === right(y)
      const tone = edge ? 'outline' : y < 53 ? 'shadow' : x === left(y) + 1 ? 'light' : x === right(y) - 1 || hash(x, Math.floor(y / 4), 44) > .8 ? 'shadow' : 'base'
      put(ox + x, y, trunkPalette[tone])
    }
  }
}

/** 五層鋸齒狀枝層，上層蓋住下層並在其上落影；左側受光，帶直向針葉紋理。 */
function drawConifer(put, ox, v) {
  const palette = coniferPalettes[v % coniferPalettes.length]
  const tiers = Array.from({ length: 5 }, (_, t) => {
    const bottom = 3 + (t + 1) * 11
    return { top: t ? bottom - 19 : 3, bottom, width: 6 + t * 3.8 }
  })
  const tierAt = (x, y) => {
    for (let t = 0; t < tiers.length; t++) {
      const { top, bottom, width } = tiers[t]
      const jag = (x + t * 2) % 5 < 2 ? 1.5 : -.5
      if (y < top || y > bottom + jag) continue
      const half = width * (y - top + 2) / (bottom - top + 2)
      if (Math.abs(x + .5 - 24) <= half) return { t, half }
    }
    return null
  }
  for (let y = 0; y < TREE_H; y++) for (let x = 0; x < TREE_W; x++) {
    const tier = tierAt(x, y)
    if (tier) {
      if (!tierAt(x - 1, y) || !tierAt(x + 1, y) || !tierAt(x, y - 1) || !tierAt(x, y + 1)) { put(ox + x, y, palette.outline); continue }
      const { top, bottom } = tiers[tier.t]
      let shade = -((x + .5 - 24) / tier.half) * .5 + (1 - (y - top) / (bottom - top)) * .2 - .1
      if (tier.t > 0 && y - tiers[tier.t - 1].bottom <= 3 && y >= tiers[tier.t - 1].bottom - 1) shade -= .5
      shade += (hash(x, Math.floor(y / 2), v + 60) - .5) * .5
      put(ox + x, y, palette[toneOf(shade)])
    } else if (y >= 56 && x >= 21 && x <= 26) {
      const tone = y === TREE_H - 1 || x === 21 || x === 26 ? 'outline' : y < 61 ? 'shadow' : x === 22 ? 'light' : 'base'
      put(ox + x, y, trunkPalette[tone])
    }
  }
}

/** 欄位 0 到 ROUND_TREES−1 是圓頂樹，其後是針葉樹。 */
export function drawTreeAtlas() {
  const canvas = canvasOf(TREE_W * TREE_VARIANTS, TREE_H)
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(canvas.width, canvas.height)
  const put = pixelWriter(image)
  for (let v = 0; v < TREE_VARIANTS; v++) {
    if (v < ROUND_TREES) drawRoundTree(put, v * TREE_W, v)
    else drawConifer(put, v * TREE_W, v - ROUND_TREES)
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

// ── 草叢與小花 ────────────────────────────────────────────
// 16×16 像素的看板，成簇撒在草地上。前四種是草叢，其後是黃花、白花與真新鎮的紅花。
export const GRASS_VARIANTS = 7
export const GRASS_FLOWERS = 4
const GRASS = 16
const grassPalette = { dark: '#1f3d22', base: '#4f8a3c', light: '#7cb04a', tip: '#c2dc6e' }
const flowerPalettes = [['#f2d24b', '#c98a1f'], ['#f7f4ea', '#e6c34a'], ['#e0584f', '#ffe09b']]

export function drawGrassAtlas() {
  const canvas = canvasOf(GRASS * GRASS_VARIANTS, GRASS)
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(canvas.width, canvas.height)
  const put = pixelWriter(image)
  for (let v = 0; v < GRASS_VARIANTS; v++) {
    const ox = v * GRASS, flower = v >= GRASS_FLOWERS
    const blades = flower ? 4 : 6 + v
    for (let b = 0; b < blades; b++) {
      const bx = 2 + Math.floor(hash(v, b, 70) * 12)
      const height = flower ? 5 + Math.floor(hash(b, v, 71) * 4) : 7 + Math.floor(hash(b, v, 71) * 8)
      const lean = Math.floor(hash(v * 3, b, 72) * 3) - 1
      for (let k = 0; k < height; k++) {
        const x = bx + Math.trunc(lean * k / 5), y = GRASS - 1 - k
        if (x < 0 || x >= GRASS) continue
        const tone = k < 2 ? 'dark' : k >= height - 2 ? 'tip' : k >= height - 4 ? 'light' : 'base'
        put(ox + x, y, grassPalette[tone])
        if (k < height / 2 && x + 1 < GRASS) put(ox + x + 1, y, grassPalette.dark)
      }
    }
    if (!flower) continue
    const [petal, heart] = flowerPalettes[v - GRASS_FLOWERS]
    for (const [fx, fy] of [[4, 6], [9, 4], [12, 8]]) {
      for (let y = fy + 2; y < GRASS; y++) put(ox + fx, y, grassPalette.base)
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) put(ox + fx + dx, fy + dy, petal)
      put(ox + fx, fy, heart)
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

// ── 對話框 ────────────────────────────────────────────────
const PAPER = '#fff8e7'
const PAPER_SHADE = '#ecdcb8'
/**
 * 像素描邊的對話框，尾巴在左下（tailRight 時在右下）。unit 是每個對話框像素佔幾個裝置像素：
 * 外框以 unit 為一格保持方塊感，文字則以原生解析度繪製，小字也清楚。
 * 回傳畫布與尾巴尖端的 x（對話框像素），供 Sprite 對齊說話者頭頂。
 */
export function drawBubble(text, unit = 1, tailRight = false) {
  const font = `${12 * unit}px Huninn, "Noto Sans TC", sans-serif`
  const probe = canvasOf(1, 1).getContext('2d')
  probe.font = font
  const textW = Math.ceil(probe.measureText(text).width / unit)
  const w = textW + 10, boxH = 19
  const canvas = canvasOf(w * unit, (boxH + 2) * unit)
  const ctx = canvas.getContext('2d')
  const fill = (color, x, y, width, height) => { ctx.fillStyle = color; ctx.fillRect(x * unit, y * unit, width * unit, height * unit) }
  fill(PAPER, 1, 1, w - 2, boxH - 2)
  fill(PAPER_SHADE, 1, boxH - 2, w - 2, 1)
  fill(INK, 1, 0, w - 2, 1)
  fill(INK, 1, boxH - 1, w - 2, 1)
  fill(INK, 0, 1, 1, boxH - 2)
  fill(INK, w - 1, 1, 1, boxH - 2)
  // 尾巴：三列逐漸收窄，距離框邊 4 像素。
  const t = tailRight ? w - 9 : 4
  fill(PAPER, t + 1, boxH - 2, 3, 2)
  fill(INK, t, boxH - 1, 1, 1)
  fill(INK, t + 4, boxH - 1, 1, 1)
  fill(INK, t + 1, boxH, 1, 1)
  fill(PAPER, t + 2, boxH, 1, 1)
  fill(INK, t + 3, boxH, 1, 1)
  fill(INK, t + 2, boxH + 1, 1, 1)
  ctx.font = font
  ctx.textBaseline = 'top'
  ctx.fillStyle = INK
  ctx.fillText(text, 5 * unit, 4 * unit)
  return { canvas, tailX: t + 2.5 }
}
