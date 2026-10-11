// 場景外觀（CONTEXT.md）：日夜循環的時段與屬性天氣疊合成天色、光照與霧。
// 只有時段或天氣過場進行中、或剛切換時才重新合成；靜止時 advance 回報沒有變化，呼叫端不必重套材質。

import { Color } from 'three'
import { TRANSITION_MS } from '../config/dayCycle.js'
import { createWeatherState, weatherLook } from './weather-state.js'

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function lookFromPeriod(p) {
  return {
    skyTop: new Color(p.sky[0]),
    skyBottom: new Color(p.sky[1]),
    light: new Color(p.light).multiplyScalar(p.intensity),
    stars: p.stars,
    moon: p.moon,
    windows: p.windows,
    shadow: p.shadow ?? 1
  }
}

function lerpLook(a, b, t, out) {
  out.skyTop.copy(a.skyTop).lerp(b.skyTop, t)
  out.skyBottom.copy(a.skyBottom).lerp(b.skyBottom, t)
  out.light.copy(a.light).lerp(b.light, t)
  out.stars = a.stars + (b.stars - a.stars) * t
  out.moon = a.moon + (b.moon - a.moon) * t
  out.windows = a.windows + (b.windows - a.windows) * t
  out.shadow = a.shadow + (b.shadow - a.shadow) * t
  return out
}

function cloneLook(l) {
  return { ...l, skyTop: l.skyTop.clone(), skyBottom: l.skyBottom.clone(), light: l.light.clone() }
}

/** @param {object} period config/dayCycle.js 的時段 */
export function createSceneLook(period) {
  const weather = createWeatherState()
  let lookFrom = lookFromPeriod(period)
  let lookTo = cloneLook(lookFrom)
  const base = cloneLook(lookFrom)
  let tweenStart = 0
  let tweening = false
  let dirty = true
  let environment = weather.environment()
  let look = weatherLook(base, environment)

  return {
    /** 天氣粒子與村民讀取的權重與目前天氣（null 為原景），唯讀。 */
    weather: {
      get weights() { return weather.weights },
      get key() { return weather.key }
    },
    /** 疊上天氣後的外觀：天色、光照、星月與窗光。 */
    get look() { return look },
    /** 天氣帶來的天色、雲量、霧、風、濕度與熱浪。 */
    get environment() { return environment },
    /** 時段切換：immediate 直接到位，否則從目前外觀以 TRANSITION_MS 漸變，now 為 performance.now()。 */
    setPeriod(period, { immediate = false, now = 0 } = {}) {
      lookFrom = cloneLook(base)
      lookTo = lookFromPeriod(period)
      if (immediate) {
        lerpLook(lookFrom, lookTo, 1, base)
        tweening = false
        dirty = true
      } else {
        tweenStart = now
        tweening = true
      }
    },
    /** null 明確恢復原景；過場由 advance 推進。 */
    setWeather(key) {
      weather.select(key)
    },
    /** 推進一幀；減少動態時兩種過場都直接到終點。回傳外觀是否與上一幀不同。 */
    advance(now, dt, reduced = false) {
      let changed = dirty
      dirty = false
      if (tweening) {
        const t = reduced ? 1 : clamp((now - tweenStart) / TRANSITION_MS, 0, 1)
        lerpLook(lookFrom, lookTo, easeInOut(t), base)
        if (t >= 1) tweening = false
        changed = true
      }
      if (weather.update(dt, reduced)) {
        environment = weather.environment()
        changed = true
      }
      if (changed) look = weatherLook(base, environment)
      return changed
    }
  }
}
