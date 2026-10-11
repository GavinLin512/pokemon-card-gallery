import test from 'node:test'
import assert from 'node:assert/strict'
import { terrainAt, groundAt, bandHeight, cameraRise, splitAtEdges, stairPoint, STAIRS, TERRACES, PLATEAUS } from '../src/scene/terrain.js'
import { ROUTE_LEDGES, LEDGE_FACES } from '../src/scene/region.js'
import { walkNodes, walkNeighbors } from '../src/scene/walkways.js'

test('every walkway climbs by stairs, never through a retaining wall', () => {
  walkNeighbors.forEach((list, a) => {
    for (const b of list) {
      const from = walkNodes[a], to = walkNodes[b]
      let previous = terrainAt(from.x, from.z)
      for (let i = 1; i <= 400; i++) {
        const t = i / 400
        const height = terrainAt(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t)
        assert.ok(Math.abs(height - previous) < .15, `walkway ${a}→${b} jumps from ${previous} to ${height}`)
        previous = height
      }
    }
  })
})

test('stairs join the upper and lower ground at both ends', () => {
  for (const s of STAIRS) {
    assert.ok(Math.abs(s.high - s.low) > .79, `stairs at ${s.at},${s.top} do not climb`)
    assert.equal(terrainAt(...stairPoint(s, s.top)), s.high)
    assert.equal(terrainAt(...stairPoint(s, s.bottom)), s.low)
    assert.equal(groundAt(...stairPoint(s, s.bottom)), s.low)
  }
})

test('every Route 1 ledge is a terrace edge or the front of higher ground that runs back to the next terrace', () => {
  for (const l of ROUTE_LEDGES) {
    if (TERRACES.some(t => Math.abs(t.z - l.z) < 1)) continue
    const plateau = PLATEAUS.find(p => Math.abs(p.south - l.z) < .1 && p.x0 <= l.x0 + .01 && p.x1 >= l.x1 - .01)
    assert.ok(plateau, `ledge at ${l.z} has no ground behind it`)
    const x = (l.x0 + l.x1) / 2
    // 土坡後方一路與下一層台地同高：北端與台地之間沒有高低差。
    for (let z = plateau.south - .05; z > plateau.north - 1; z -= .25) {
      assert.ok(groundAt(x, z) >= groundAt(x, plateau.south - .05) - 1e-9, `dips behind the ledge at ${z}`)
    }
    assert.ok(Math.abs(groundAt(x, plateau.north + .05) - groundAt(x, plateau.north - .05)) < 1e-9, 'plateau does not meet the next terrace')
    assert.ok(groundAt(x, l.z - .05) - groundAt(x, l.z + .05) > .79, 'ledge is not a step up')
  }
})

test('the camera follows the terraces smoothly and ends at the city level', () => {
  let previous = cameraRise(27)
  for (let z = 27; z >= -143; z -= .1) {
    const rise = cameraRise(z)
    assert.ok(Math.abs(rise - previous) < .05, `camera jumps near z ${z.toFixed(1)}`)
    previous = rise
  }
  assert.ok(Math.abs(cameraRise(-150) - bandHeight(-150)) < 1e-9)
})

test('ledge faces sit where the original ledges are, on a real step up, clear of the stairs', () => {
  assert.ok(LEDGE_FACES.length >= 6)
  for (const f of LEDGE_FACES) {
    // 土坡面兩端都落在同一道牆上的原作土坡範圍內。
    const onLedge = x => ROUTE_LEDGES.some(l => (Math.abs(l.z - f.z) < 1) && x >= l.x0 - 1e-9 && x <= l.x1 + 1e-9)
    assert.ok(onLedge(f.x0) && onLedge(f.x1), `face at ${f.z} ${f.x0}–${f.x1} is not on an original ledge`)
    for (let x = f.x0 + .05; x < f.x1; x += .25) {
      assert.ok(groundAt(x, f.z - .05) - groundAt(x, f.z + .05) > .79, `no wall under the ledge face at ${x},${f.z}`)
      assert.ok(!STAIRS.some(s => s.axis === 'z' && s.top === f.z && Math.abs(x - s.at) < s.width / 2), `ledge face covers the stairs at ${x}`)
    }
  }
})

test('paths crossing a terrace edge or a plateau rim are cut into pieces that stay on one level', () => {
  // 東側土路：縱向跨過東側土坡，橫向的土路跨過高地西緣。
  for (const [x, z, w, d] of [[11, -48.7, 3.3, 22], [1.8, -60.4, 22.2, 4.3], [0, -60, 4, 30]]) {
    const parts = splitAtEdges(x, z, w, d)
    assert.ok(Math.abs(parts.reduce((sum, [, , pw, pd]) => sum + pw * pd, 0) - w * d) < 1e-9)
    for (const [px, pz, pw, pd] of parts) {
      const levels = [[-.49, -.49], [.49, -.49], [-.49, .49], [.49, .49], [0, 0]].map(([u, v]) => groundAt(px + u * pw, pz + v * pd))
      assert.ok(Math.max(...levels) - Math.min(...levels) < 1e-9, `piece at ${px},${pz} spans two levels`)
    }
  }
})
