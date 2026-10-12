import { Color } from 'three'
import { weatherEffects, WEATHER_TRANSITION_MS } from '../config/weather.js'
const keys = Object.keys(weatherEffects)
/** 狀態與動畫時間分開：收合不呼叫 select；null 明確恢復原景。 */
export function createWeatherState() {
  let key = 'clear', elapsed = 2
  let from = Object.fromEntries(keys.map(k => [k, k === 'clear' ? 1 : 0]))
  const weights = { ...from }
  return {
    weights,
    get key() { return key === 'clear' ? null : key },
    select(next) {
      next = Object.hasOwn(weatherEffects, next) ? next : 'clear'
      if (next === key) return
      from = { ...weights }; key = next; elapsed = 0
    },
    /** 回傳權重是否改變；過場結束後為 false。 */
    update(dt, reduced = false) {
      elapsed = reduced ? 2 : Math.min(2, elapsed + Math.max(0, dt))
      const t = elapsed / (WEATHER_TRANSITION_MS / 1000), smooth = t * t * (3 - 2 * t)
      let changed = false
      for (const k of keys) {
        const w = from[k] + ((k === key ? 1 : 0) - from[k]) * smooth
        if (w !== weights[k]) { weights[k] = w; changed = true }
      }
      return changed
    },
    environment() {
      const out = { sky: new Color(0, 0, 0), skyLow: new Color(0, 0, 0), cloud: new Color(0, 0, 0) }
      for (const field of FIELDS) out[field] = 0
      for (const k of keys) {
        const p = { ...weatherEffects.clear, ...weatherEffects[k] }, w = weights[k]
        const sky = new Color(p.sky), low = new Color(p.skyLow ?? p.sky), cloud = new Color(p.cloud)
        for (const c of ['r','g','b']) { out.sky[c] += sky[c] * w; out.skyLow[c] += low[c] * w; out.cloud[c] += cloud[c] * w }
        for (const field of FIELDS) out[field] += p[field] * w
      }
      return out
    }
  }
}
const FIELDS = ['tint','cover','thickness','light','fog','wind','wet','metal','heat','sunLow','eclipse','sun']
/**
 * 日夜始終是基底；屬性染色依原時段亮度縮放，不把夜景變白天。
 * 惡（eclipse）：月亮不受雲量遮蔽，沒有月亮的時段（清晨、白天、黃昏）換成日蝕，夜晚換成紅色細月。
 * 火（sun）：沒有月亮的時段天上出現像素大太陽，夜晚月亮外圍一圈暖橘月暈。
 */
export function weatherLook(base, env) {
  const nightScale = 1 - base.windows * .88
  const tint = env.sky.clone().multiplyScalar(nightScale)
  const low = env.skyLow.clone().multiplyScalar(nightScale)
  return { ...base,
    skyTop: base.skyTop.clone().lerp(tint.clone().multiplyScalar(.68), env.tint),
    skyBottom: base.skyBottom.clone().lerp(low, env.tint),
    light: base.light.clone().lerp(env.sky, env.tint * .2).multiplyScalar(env.light),
    stars: base.stars * Math.max(0, 1 - (env.cover - 1) * .9),
    moon: base.moon * Math.max(.1, 1 - (env.cover - 1) * .7) * (1 - env.eclipse),
    bloodMoon: base.moon * env.eclipse,
    eclipse: (1 - base.moon) * env.eclipse,
    sun: (1 - base.moon) * env.sun,
    moonHalo: base.moon * env.sun
  }
}
