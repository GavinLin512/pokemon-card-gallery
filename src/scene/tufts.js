import { createBillboards } from './billboards.js'
import { drawGrassAtlas, GRASS_VARIANTS, GRASS_FLOWERS } from './pixel-art.js'

const GRASS_COLORS = new Set(['#72b98a', '#639f75', '#559968'])
const TALL_GRASS = '#559968'
const CELL = 4

/** 固定種子的亂數：每次載入的草叢位置相同，進站時地景不會跳動。 */
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 以 4 單位網格索引地景方塊，查詢某點最上層的方塊。 */
function groundLookup(boxes) {
  const grid = new Map(), wide = []
  for (const entry of boxes) {
    const { min, max } = entry.box
    if (max.x - min.x > 60 || max.z - min.z > 60) { wide.push(entry); continue }
    for (let cx = Math.floor(min.x / CELL); cx <= Math.floor(max.x / CELL); cx++) {
      for (let cz = Math.floor(min.z / CELL); cz <= Math.floor(max.z / CELL); cz++) {
        const key = `${cx},${cz}`
        if (!grid.has(key)) grid.set(key, [])
        grid.get(key).push(entry)
      }
    }
  }
  return (x, z) => {
    let top = null
    for (const list of [wide, grid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []]) {
      for (const entry of list) {
        const { min, max } = entry.box
        if (x < min.x || x > max.x || z < min.z || z > max.z) continue
        if (!top || max.y > top.box.max.y) top = entry
      }
    }
    return top
  }
}

/**
 * HD-2D 的草叢與小花：成簇撒在草地上，只長在「最上層是草地、且貼近地面」的位置，
 * 路面、建築、柵欄、池塘與土坡都由較高或非草色的方塊自然避開。紅花只開在真新鎮。
 * boxes 是合併前記下的地景方塊 { box, color }。
 */
export function createTufts({ boxes, lowPower = false, sway = null }) {
  const surfaceAt = groundLookup(boxes)
  const random = seeded(20260928)
  const spots = []
  for (let c = 0; c < (lowPower ? 320 : 900); c++) {
    const cx = -24 + random() * 48, cz = -186 + random() * 210
    const size = 3 + Math.floor(random() * 5)
    for (let k = 0; k < size; k++) {
      const x = cx + (random() - .5) * 1.8, z = cz + (random() - .5) * 1.8
      const ground = surfaceAt(x, z)
      if (!ground || !GRASS_COLORS.has(ground.color)) continue
      const roll = random()
      const variant = roll < .05 ? GRASS_FLOWERS : roll < .09 ? GRASS_FLOWERS + 1 : roll < .14 && z > -20 ? GRASS_FLOWERS + 2 : Math.floor(random() * GRASS_FLOWERS)
      spots.push({ x, y: ground.box.max.y, z, variant, flip: random() < .5, scale: .75 + random() * .5 })
    }
  }
  // 長草區（一號道路的深綠草地）密鋪成片，呈現寶可夢的長草；被階梯等蓋住的地方略過。
  for (const { box, color } of boxes) {
    if (color !== TALL_GRASS) continue
    for (let x = box.min.x + .3; x < box.max.x; x += lowPower ? .8 : .55) {
      for (let z = box.min.z + .3; z < box.max.z; z += lowPower ? .8 : .55) {
        const jx = x + (random() - .5) * .3, jz = z + (random() - .5) * .3
        if (surfaceAt(jx, jz)?.box !== box) continue
        spots.push({ x: jx, y: box.max.y, z: jz, variant: Math.floor(random() * GRASS_FLOWERS), flip: random() < .5, scale: 1.05 + random() * .3 })
      }
    }
  }
  const billboards = createBillboards({ canvas: drawGrassAtlas(), columns: GRASS_VARIANTS, count: spots.length, width: .95, height: .95, sway })
  spots.forEach((s, i) => billboards.set(i, s.x, s.y, s.z, s.variant, 0, s.flip, s.scale))
  billboards.commit()
  return billboards
}
