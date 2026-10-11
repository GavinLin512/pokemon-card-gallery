import test from 'node:test'
import assert from 'node:assert/strict'
import { walkNodes, walkNeighbors } from '../src/scene/walkways.js'
import { villagerFrames, VILLAGER_FRAME, VILLAGER_W, VILLAGER_H } from '../src/scene/villager-art.js'
import { chatLines, chatFits, pickChat, PERIOD_GROUPS, VILLAGER_COUNTS } from '../src/config/villagers.js'
import { weatherEffects } from '../src/config/weather.js'
import { periodKeys } from '../src/config/dayCycle.js'

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

test('chat lines alternate between two speakers, stay short and use 卡牌, never 卡片', () => {
  const weathers = Object.keys(weatherEffects)
  for (const { when, weather, lines } of chatLines) {
    assert.ok(['any', ...periodKeys, ...Object.keys(PERIOD_GROUPS)].includes(when), when)
    if (weather) assert.ok(weathers.includes(weather), weather)
    assert.ok(lines.length >= 2)
    for (const line of lines) {
      assert.ok(!line.includes('卡片'), line)
      assert.ok([...line].length <= 10, line)
    }
  }
})

test('every period and every attribute weather has its own lines, and chats match the moment', () => {
  for (const period of periodKeys) assert.ok(chatLines.some(c => c.when === period), period)
  for (const weather of Object.keys(weatherEffects).filter(k => k !== 'clear')) assert.ok(chatLines.some(c => c.weather === weather), weather)
  // random 回 0：一定挑特定句子，而且是該時段或該天氣的。
  for (const period of periodKeys) {
    for (const weather of [null, ...Object.keys(weatherEffects).filter(k => k !== 'clear')]) {
      const lines = pickChat(period, weather, () => 0)
      const chat = chatLines.find(c => c.lines === lines)
      assert.ok(chatFits(chat, period, weather), `${period}/${weather}: ${lines[0]}`)
      assert.ok(chat.weather || chat.when !== 'any')
      // random 回 .99：也只會挑符合當下的句子。
      assert.ok(chatFits(chatLines.find(c => c.lines === pickChat(period, weather, () => .99)), period, weather))
    }
  }
  // 晴天限定與夜晚限定的句子不會在下雨的白天出現。
  assert.ok(!chatFits({ when: 'daylight', weather: 'clear', lines: [] }, 'day', 'rain'))
  assert.ok(!chatFits({ when: 'night', lines: [] }, 'dusk', null))
  assert.ok(chatFits({ when: 'dark', lines: [] }, 'dusk', null))
  assert.ok(chatFits({ when: 'any', weather: 'rain', lines: [] }, 'dawn', 'rain'))
})
