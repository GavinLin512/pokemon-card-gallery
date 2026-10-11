// 一號道路的村民行走格網（HD-2D），沿用原作的格子邏輯：
// 路面、草地、長草與花叢都能走；樹、告示牌與階梯側牆不能走。
// 路中的樹叢依原圖佔 2×2 格，樹叢之間不留原作沒有的縫隙。
// 只有土坡面（原作土坡所在、土色帶碎石的那段擋土牆）能從高處往南跳下；其餘擋土牆兩個方向都不能通行。
// 往上一律只能走階梯。
import { terrainAt, STAIRS, CHEEK, cheekAt } from './terrain.js'
import { ROUTE_TREES, ROUTE_SIGNS, TILE, LEDGE_FACES } from './region.js'

const CELL = .5
/** 格子中心的範圍：兩側樹林之間，南至真新鎮柵欄、北至常磐市前的擋土牆。 */
const X0 = -14.75, COLS = 60
const Z0 = -22.75, ROWS = 178
/** 人物半徑：障礙物外擴此距離，身體不會穿進樹或牆。 */
const BODY = .3
/** 相鄰兩格高度差在此以內可直接走；更大的落差只能從高處跳下。 */
const STEP = .3
const MAX_DROP = 1.3
/** 移動種類：走、從土坡跳下。 */
export const MOVE = { walk: 0, drop: 1 }

const circle = (x, z, r) => (px, pz) => (px - x) ** 2 + (pz - z) ** 2 < (r + BODY) ** 2
const rect = (x0, x1, z0, z1) => (px, pz) => px > x0 - BODY && px < x1 + BODY && pz > z0 - BODY && pz < z1 + BODY

function obstacles() {
  return [
    ...ROUTE_TREES.map(t => (t.grove ? rect(t.x - TILE.x, t.x + TILE.x, t.z - TILE.z, t.z + TILE.z) : circle(t.x, t.z, 1))),
    ...ROUTE_SIGNS.map(([x, z]) => circle(x, z, .45)),
    ...STAIRS.flatMap(s => [-1, 1].map(side => {
      const across = cheekAt(s, side), lo = Math.min(s.top, s.bottom), hi = Math.max(s.top, s.bottom)
      return s.axis === 'z' ? rect(across - CHEEK / 2, across + CHEEK / 2, lo, hi) : rect(lo, hi, across - CHEEK / 2, across + CHEEK / 2)
    }))
  ]
}

export function createRouteNav() {
  const count = COLS * ROWS
  const center = i => ({ x: X0 + (i % COLS) * CELL, z: Z0 - Math.floor(i / COLS) * CELL })
  const cellAt = (x, z) => {
    const col = Math.min(COLS - 1, Math.max(0, Math.round((x - X0) / CELL)))
    const row = Math.min(ROWS - 1, Math.max(0, Math.round((Z0 - z) / CELL)))
    return row * COLS + col
  }
  const height = new Float32Array(count)
  const open = new Uint8Array(count)
  const blocked = obstacles()
  for (let i = 0; i < count; i++) {
    const { x, z } = center(i)
    height[i] = terrainAt(x, z)
    open[i] = blocked.some(hit => hit(x, z)) ? 0 : 1
  }

  /** a 往南一格到 b 之間是否隔著土坡面。 */
  const ledgeBetween = (a, b) => {
    const p = center(a), q = center(b)
    return LEDGE_FACES.some(f => f.z > p.z && f.z < q.z && p.x >= f.x0 && p.x <= f.x1)
  }
  // 每格往外的移動：編碼為 目標格 × 4 + 移動種類。
  let links = Array.from({ length: count }, () => [])
  const link = (a, b, kind) => links[a].push(b * 4 + kind)
  for (let a = 0; a < count; a++) {
    if (!open[a]) continue
    const col = a % COLS, row = Math.floor(a / COLS)
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      if (!dc && !dr) continue
      const c = col + dc, r = row + dr
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue
      const b = r * COLS + c
      if (!open[b]) continue
      const dh = height[b] - height[a]
      if (dc && dr) {
        // 斜走不切角：兩側的格子都要能走，四格高度一致（不斜跨牆）。
        const side1 = row * COLS + c, side2 = r * COLS + col
        if (!open[side1] || !open[side2]) continue
        const hs = [height[a], height[b], height[side1], height[side2]]
        if (Math.max(...hs) - Math.min(...hs) <= STEP) link(a, b, MOVE.walk)
      } else if (Math.abs(dh) <= STEP) link(a, b, MOVE.walk)
      else if (dh < -STEP && dh >= -MAX_DROP && !dc && dr === -1 && ledgeBetween(a, b)) link(a, b, MOVE.drop)
    }
  }

  // 只保留與主要道路雙向相通的格子：跳下去之後一定走得回來，村民不會困在擋土牆下。
  const reach = (from, edges) => {
    const seen = new Uint8Array(count), queue = [from]
    seen[from] = 1
    while (queue.length) for (const code of edges[queue.pop()]) {
      const b = code >> 2
      if (!seen[b]) { seen[b] = 1; queue.push(b) }
    }
    return seen
  }
  const reverse = Array.from({ length: count }, () => [])
  links.forEach((list, a) => { for (const code of list) reverse[code >> 2].push(a * 4) })
  const seed = cellAt(0, -40)
  const forward = reach(seed, links), backward = reach(seed, reverse)
  const walkable = open.filter(Boolean).length
  const cells = []
  for (let i = 0; i < count; i++) {
    open[i] = forward[i] && backward[i] ? 1 : 0
    if (open[i]) cells.push(i)
  }
  links = links.map((list, a) => (open[a] ? list.filter(code => open[code >> 2]) : []))

  // 廣度優先搜尋，結果寫進共用陣列；回傳依距離排序的可達格子。
  const parent = new Int32Array(count), kindOf = new Uint8Array(count), steps = new Int32Array(count)
  function search(start) {
    parent.fill(-1)
    steps.fill(-1)
    steps[start] = 0
    const order = [start]
    for (let k = 0; k < order.length; k++) {
      const a = order[k]
      for (const code of links[a]) {
        const b = code >> 2
        if (steps[b] >= 0) continue
        steps[b] = steps[a] + 1
        parent[b] = a
        kindOf[b] = code & 3
        order.push(b)
      }
    }
    return order
  }

  /** 兩點之間的直線是否都在同一片可走的地面上（不經過障礙、不跨牆）。 */
  function clear(a, b) {
    const p = center(a), q = center(b)
    const n = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / (CELL / 2))
    let previous = height[a]
    for (let k = 1; k <= n; k++) {
      const cell = cellAt(p.x + (q.x - p.x) * k / n, p.z + (q.z - p.z) * k / n)
      if (!open[cell] || Math.abs(height[cell] - previous) > STEP) return false
      previous = height[cell]
    }
    return true
  }

  /** 由搜尋結果回溯到 goal，拉直成路點；跳躍各自成為一個路點。 */
  function waypoints(goal) {
    const chain = []
    for (let c = goal; c >= 0; c = parent[c]) chain.push(c)
    chain.reverse()
    const out = []
    let i = 0
    while (i < chain.length - 1) {
      if (kindOf[chain[i + 1]] !== MOVE.walk) {
        out.push({ ...center(chain[i + 1]), kind: kindOf[chain[i + 1]] })
        i++
        continue
      }
      let j = i + 1
      while (j + 1 < chain.length && kindOf[chain[j + 1]] === MOVE.walk && clear(chain[i], chain[j + 1])) j++
      out.push({ ...center(chain[j]), kind: MOVE.walk })
      i = j
    }
    return out
  }

  return {
    cells,
    stats: { walkable, kept: cells.length },
    center,
    cellAt,
    isOpen: (x, z) => !!open[cellAt(x, z)],
    heightOf: i => height[i],
    /** 所有移動 [起點格, 終點格, 種類]，供測試檢查。 */
    *moves() {
      for (let a = 0; a < count; a++) for (const code of links[a]) yield [a, code >> 2, code & 3]
    },
    /** 從 start 走到 goal 的路點；走不到時為 null。 */
    route(start, goal) {
      search(start)
      return steps[goal] >= 0 ? waypoints(goal) : null
    },
    /** 從 start 隨機挑一個 min–max 步內走得到的格子，回傳沿途路點。 */
    wander(start, random = Math.random, min = 6, max = 36) {
      if (!open[start]) start = cells.reduce((best, c) => {
        const p = center(c), q = center(start), s = center(best)
        return (p.x - q.x) ** 2 + (p.z - q.z) ** 2 < (s.x - q.x) ** 2 + (s.z - q.z) ** 2 ? c : best
      }, cells[0])
      const choices = search(start).filter(c => steps[c] >= min && steps[c] <= max)
      return choices.length ? waypoints(choices[Math.floor(random() * choices.length)]) : []
    }
  }
}
