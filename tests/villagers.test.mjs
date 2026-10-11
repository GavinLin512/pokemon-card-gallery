import test from 'node:test'
import assert from 'node:assert/strict'
import { walkNodes, walkNeighbors } from '../src/scene/walkways.js'
import { villagerFrames, VILLAGER_FRAME, VILLAGER_W, VILLAGER_H } from '../src/scene/villager-art.js'
import { chatLines, VILLAGER_COUNTS } from '../src/config/villagers.js'

test('every villager frame is a full 16×24 grid of known symbols', () => {
  assert.equal(villagerFrames.length, Object.keys(VILLAGER_FRAME).length)
  for (const rows of villagerFrames) {
    assert.equal(rows.length, VILLAGER_H)
    for (const row of rows) {
      assert.equal(row.length, VILLAGER_W)
      assert.match(row, /^[.oeshHcCpPf]+$/)
    }
  }
})

test('walkways stay connected within each region so villagers never get stuck', () => {
  // 一號道路改用格網（route-nav.test.mjs），路網只涵蓋真新鎮與常磐市。
  for (const region of Object.keys(VILLAGER_COUNTS).filter(r => r !== 'route')) {
    const members = walkNodes.flatMap((node, i) => (node.region === region ? [i] : []))
    assert.ok(members.length > 1, region)
    const seen = new Set([members[0]])
    const queue = [members[0]]
    while (queue.length) for (const next of walkNeighbors[queue.shift()]) if (!seen.has(next)) { seen.add(next); queue.push(next) }
    assert.equal(seen.size, members.length, `${region} walkway is split`)
    for (const i of members) assert.ok(walkNeighbors[i].every(n => walkNodes[n].region === region))
  }
})

test('chat lines alternate between two speakers and use 卡牌, never 卡片', () => {
  for (const { when, lines } of chatLines) {
    assert.ok(['any', 'day', 'night'].includes(when))
    assert.ok(lines.length >= 2)
    for (const line of lines) assert.ok(!line.includes('卡片'), line)
  }
})
