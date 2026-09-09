import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { journeyStops, stopsFor } from '../src/config/journeyStops.js'
import { sections } from '../src/config/sections.js'
import { SERIES, allSections, seriesOfSection } from '../src/config/series.js'
import { createTimeline, resolvePosition, landingFor, restorePosition, advancePosition } from '../src/journey/timeline.js'

const timeline = createTimeline(journeyStops)
test('each series preserves category order and maps to stable dwell centers', () => {
  assert.deepEqual(journeyStops.map(s => s.id), sections.map(s => s.id))
  assert.deepEqual(SERIES.map(s => s.sections.length), [18, 10])
  for (const series of SERIES) {
    const line = createTimeline(stopsFor(series.sections))
    assert.equal(line.segments.length, series.sections.length)
    let previous = -1
    for (const s of line.segments) {
      const resolved = resolvePosition(line, landingFor(line, s.id))
      assert.equal(resolved.stop.id, s.id)
      assert.equal(resolved.progress, s.progress)
      assert.ok(s.progress > previous)
      assert.ok(Math.abs(resolved.local - .5) < 1e-12)
      previous = s.progress
    }
  }
})
test('section ids are unique across series and 151 stops reference real cards, at most 6 each', () => {
  const ids = allSections.map(s => s.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(seriesOfSection('common'), 'swsh')
  assert.equal(seriesOfSection('151-hyper'), '151')
  assert.equal(seriesOfSection('missing'), null)
  const known = new Set(JSON.parse(readFileSync(new URL('../public/data/cards-151.json', import.meta.url), 'utf8')).map(c => c.id))
  const seen = new Set()
  for (const section of SERIES[1].sections) {
    assert.ok(section.ids.length >= 3 && section.ids.length <= 6, section.id)
    for (const id of section.ids) {
      assert.ok(known.has(id), id)
      assert.ok(!seen.has(id), id)
      seen.add(id)
    }
  }
})
test('continuous forward and reverse flight with stationary dwell and clamped endpoint', () => {
  let last = 0
  for (let position = 0; position <= timeline.length; position += .01) {
    const frame = resolvePosition(timeline, position)
    assert.ok(frame.progress >= last - 1e-12)
    assert.deepEqual(frame, resolvePosition(timeline, position))
    last = frame.progress
  }
  for (const s of timeline.segments) {
    assert.equal(resolvePosition(timeline, s.arrival + .15).progress, resolvePosition(timeline, s.end - .15).progress)
  }
  assert.equal(resolvePosition(timeline, -100).progress, 0)
  assert.equal(resolvePosition(timeline, 999).stop.id, journeyStops.at(-1).id)
})
test('fast jumps skip intermediate stops; boundary jitter preserves the current encounter', () => {
  const first = timeline.segments[0], last = timeline.segments.at(-1)
  assert.equal(resolvePosition(timeline, last.landing, first.id).stop.id, last.id)
  assert.equal(resolvePosition(timeline, first.end + .01, first.id).stop.id, first.id)
  assert.equal(resolvePosition(timeline, first.end + .03, first.id).stop, null)
  assert.equal(resolvePosition(timeline, first.arrival - .01, first.id).stop.id, first.id)
  assert.equal(resolvePosition(timeline, first.arrival - .03, first.id).stop, null)
})
test('history and resize restore normalized station-local distance without pixel drift', () => {
  for (const s of timeline.segments) {
    const position = s.arrival + .37 * s.dwell
    const saved = { journeyPosition: position }
    const restored = restorePosition(timeline, saved)
    const desktop = restored * 1156 / 1156
    const mobile = restored * 844 / 844
    assert.equal(resolvePosition(timeline, desktop).stop.id, s.id)
    assert.equal(resolvePosition(timeline, mobile).stop.id, s.id)
    assert.ok(Math.abs(resolvePosition(timeline, mobile).local - .37) < 1e-12)
  }
  assert.equal(restorePosition(timeline, { journeyPosition: NaN }), 0)
  assert.equal(restorePosition(timeline, { journeyPosition: 1000 }), timeline.length)
  assert.equal(landingFor(timeline, 'missing'), null)
})

test('smooth travel converges without overshooting and fast jumps remain immediate', () => {
  for (const target of [.9, -.9]) {
    let current = 0
    for (let i = 0; i < 120; i++) {
      const next = advancePosition(current, target, 1 / 60)
      assert.ok(Math.abs(target - next) <= Math.abs(target - current))
      assert.ok(Math.abs(next) <= Math.abs(target))
      current = next
    }
    assert.equal(current, target)
  }
  assert.equal(advancePosition(0, 20, 1 / 60), 20)
  assert.equal(advancePosition(.3, .9, 1 / 60, true), .9)
  let sixty = 0, thirty = 0
  for (let i = 0; i < 12; i++) sixty = advancePosition(sixty, 1, 1 / 60)
  for (let i = 0; i < 6; i++) thirty = advancePosition(thirty, 1, 1 / 30)
  assert.ok(Math.abs(sixty - thirty) < 1e-12)
})
