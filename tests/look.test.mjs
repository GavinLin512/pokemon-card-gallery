import test from 'node:test'
import assert from 'node:assert/strict'
import { createSceneLook } from '../src/scene/look.js'
import { periodByKey, TRANSITION_MS } from '../src/config/dayCycle.js'

const snapshot = look => ({
  skyTop: look.skyTop.toArray(), skyBottom: look.skyBottom.toArray(), light: look.light.toArray(),
  stars: look.stars, moon: look.moon, windows: look.windows, shadow: look.shadow
})

test('steady scene reports no change and keeps the same look object', () => {
  const s = createSceneLook(periodByKey('day'))
  assert.equal(s.advance(0, 0), true, 'first frame applies the initial look')
  const look = s.look, environment = s.environment
  for (let i = 1; i <= 120; i++) assert.equal(s.advance(i * 16, .016), false)
  assert.equal(s.look, look)
  assert.equal(s.environment, environment)
})

test('weather transition reports change until it settles, then stops', () => {
  const s = createSceneLook(periodByKey('day'))
  s.advance(0, 0)
  const clearSky = snapshot(s.look)
  s.setWeather('rain')
  let frames = 0
  while (s.advance(frames * 100, .1)) frames++
  assert.equal(frames, 20, 'two-second transition at 0.1s per frame')
  assert.equal(s.weather.weights.rain, 1)
  assert.ok(s.environment.wet > 0)
  assert.notDeepEqual(snapshot(s.look), clearSky)
  assert.equal(s.advance(5000, .1), false)
})

test('period transition eases from the current look and lands where an immediate switch lands', () => {
  const night = periodByKey('night')
  const tweened = createSceneLook(periodByKey('day')), instant = createSceneLook(periodByKey('day'))
  tweened.advance(0, 0); instant.advance(0, 0)
  tweened.setPeriod(night, { now: 1000 })
  instant.setPeriod(night, { immediate: true })
  assert.equal(instant.advance(0, 0), true)
  assert.equal(tweened.advance(1000, 0), true)
  const midway = (tweened.advance(1000 + TRANSITION_MS / 2, 0), snapshot(tweened.look))
  assert.ok(midway.windows > 0 && midway.windows < night.windows)
  // 過場中途改回白天：從目前外觀出發，不跳回夜晚或白天的端點。
  tweened.setPeriod(periodByKey('day'), { now: 1000 + TRANSITION_MS / 2 })
  tweened.advance(1000 + TRANSITION_MS / 2, 0)
  assert.deepEqual(snapshot(tweened.look), midway)
  tweened.setPeriod(night, { now: 3000 })
  tweened.advance(3000 + TRANSITION_MS, 0)
  assert.equal(tweened.advance(3000 + TRANSITION_MS + 16, 0), false)
  const a = snapshot(tweened.look), b = snapshot(instant.look)
  for (const key of Object.keys(a)) {
    if (Array.isArray(a[key])) a[key].forEach((v, i) => assert.ok(Math.abs(v - b[key][i]) < 1e-12, key))
    else assert.ok(Math.abs(a[key] - b[key]) < 1e-12, key)
  }
})

test('reduced motion finishes both transitions on the next frame', () => {
  const s = createSceneLook(periodByKey('day'))
  s.advance(0, 0)
  s.setPeriod(periodByKey('dusk'), { now: 0 })
  s.setWeather('embers')
  assert.equal(s.advance(10, 0, true), true)
  assert.equal(s.weather.weights.embers, 1)
  assert.equal(s.look.windows, periodByKey('dusk').windows)
  assert.equal(s.advance(20, 0, true), false)
})
