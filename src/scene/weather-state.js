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
    update(dt, reduced = false) {
      elapsed = reduced ? 2 : Math.min(2, elapsed + Math.max(0, dt))
      const t = elapsed / (WEATHER_TRANSITION_MS / 1000), smooth = t * t * (3 - 2 * t)
      for (const k of keys) weights[k] = from[k] + ((k === key ? 1 : 0) - from[k]) * smooth
    },
    environment() {
      const out = { sky: new Color(0, 0, 0), cloud: new Color(0, 0, 0) }
      for (const field of ['tint','cover','thickness','light','fog','wind','wet','metal','heat']) out[field] = 0
      for (const k of keys) {
        const p = { ...weatherEffects.clear, ...weatherEffects[k] }, w = weights[k]
        const sky = new Color(p.sky), cloud = new Color(p.cloud)
        for (const c of ['r','g','b']) { out.sky[c] += sky[c] * w; out.cloud[c] += cloud[c] * w }
        for (const field of ['tint','cover','thickness','light','fog','wind','wet','metal','heat']) out[field] += p[field] * w
      }
      return out
    }
  }
}
/** 日夜始終是基底；屬性染色依原時段亮度縮放，不把夜景變白天。 */
export function weatherLook(base, env) {
  const nightScale = 1 - base.windows * .88
  const tint = env.sky.clone().multiplyScalar(nightScale)
  return { ...base,
    skyTop: base.skyTop.clone().lerp(tint.clone().multiplyScalar(.68), env.tint),
    skyBottom: base.skyBottom.clone().lerp(tint, env.tint),
    light: base.light.clone().lerp(env.sky, env.tint * .2).multiplyScalar(env.light),
    stars: base.stars * Math.max(0, 1 - (env.cover - 1) * .9),
    moon: base.moon * Math.max(.1, 1 - (env.cover - 1) * .7)
  }
}
