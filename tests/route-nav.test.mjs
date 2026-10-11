import test from 'node:test'
import assert from 'node:assert/strict'
import { createRouteNav, MOVE } from '../src/scene/route-nav.js'
import { PLATEAUS, STAIRS, stairPoint } from '../src/scene/terrain.js'
import { LEDGE_FACES } from '../src/scene/region.js'

const nav = createRouteNav()
const east = PLATEAUS.find(p => p.x0 > 0)
const length = (from, steps) => {
  let p = nav.center(from), d = 0
  for (const s of steps) { d += Math.hypot(s.x - p.x, s.z - p.z); p = s }
  return d
}
const onStairs = (x, z) => STAIRS.some(s => {
  const [along, across] = s.axis === 'z' ? [z, x] : [x, z]
  return Math.abs(across - s.at) <= s.width / 2 && (along - s.top) / (s.bottom - s.top) >= -.3 && (along - s.top) / (s.bottom - s.top) <= 1.3
})

test('grass, tall grass, every terrace and the ground behind each ledge are walkable, with no dead ends', () => {
  // 只保留雙向相通的格子；被剔除的應極少，否則代表擋土牆或樹擋出了死角。
  assert.ok(nav.stats.kept / nav.stats.walkable > .97, `${nav.stats.kept} of ${nav.stats.walkable}`)
  for (const [x, z, where] of [[-6, -29, 'south tall grass'], [4, -48, 'tall grass beside the east ledge'],
    [12, -55, 'ground behind the east ledge'], [-10, -80, 'ground behind the west ledge'],
    [-9, -70, 'second terrace'], [-8, -95, 'third terrace'], [0, -108, 'north terrace']]) {
    assert.ok(nav.isOpen(x, z), where)
  }
})

test('the east ledge is jumped down going south; going north means the detour through the tall grass and up the steps', () => {
  assert.ok(east.x1 >= 15, 'the raised ground stops short of the tree line')
  const north = nav.cellAt(11, east.south - 1.5), south = nav.cellAt(11, east.south + 1.5)
  const down = nav.route(north, south), up = nav.route(south, north)
  assert.ok(down.some(s => s.kind === MOVE.drop), 'going south jumps the ledge')
  assert.ok(length(north, down) < 5)
  assert.ok(up.every(s => s.kind === MOVE.walk), 'going north never jumps')
  assert.ok(up.some(s => s.x < east.x0 - 2), 'going north detours west through the grass')
  assert.ok(length(south, up) > 15)
})

test('no move climbs a wall: every rise happens on stairs, and jumps only go south off a ledge face', () => {
  const jumped = new Set()
  for (const [a, b, kind] of nav.moves()) {
    const p = nav.center(a), q = nav.center(b), rise = nav.heightOf(b) - nav.heightOf(a)
    assert.ok(rise <= .3, `climbs from ${p.x},${p.z} to ${q.x},${q.z}`)
    if (rise < -.3) assert.equal(kind, MOVE.drop, `steps off a wall at ${p.x},${p.z}`)
    if (kind === MOVE.drop) {
      assert.ok(rise < -.3, 'a jump that does not go down')
      // 只能從土坡面往南跳；一般擋土牆與高地側緣兩個方向都過不去。
      const face = LEDGE_FACES.find(f => f.z > p.z && f.z < q.z && p.x >= f.x0 && p.x <= f.x1)
      assert.ok(face && p.x === q.x, `jumps off a plain wall at ${p.x},${p.z}`)
      jumped.add(face)
    }
    if (rise > .05) assert.ok(onStairs(p.x, p.z) || onStairs(q.x, q.z), `rises off the stairs at ${p.x},${p.z}`)
  }
  for (const f of LEDGE_FACES) assert.ok(jumped.has(f), `ledge face at ${f.z} ${f.x0}–${f.x1} can never be jumped`)
  // 每段階梯都真的有人走得上去。
  for (const s of STAIRS.filter(s => s.axis === 'x' || (s.top < -30 && s.top > -111))) {
    assert.ok(nav.isOpen(...stairPoint(s, (s.top + s.bottom) / 2)), `stairs at ${s.at},${s.top} are blocked`)
  }
})

test('wandering villagers always get a path that starts next to them', () => {
  let seed = 7
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let k = 0; k < 200; k++) {
    const start = nav.cells[Math.floor(random() * nav.cells.length)]
    const steps = nav.wander(start, random)
    assert.ok(steps.length > 0)
    // 最多 36 步，斜走每步 0.71 單位：第一個路點不會超出這個距離。
    const p = nav.center(start), first = steps[0]
    assert.ok(Math.hypot(first.x - p.x, first.z - p.z) <= 36 * .5 * Math.SQRT2 + 1e-9)
  }
})
