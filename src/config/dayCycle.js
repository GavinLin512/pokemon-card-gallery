// 日夜循環（PLAN §9.3）：四個時段的天空、光照與額外效果。
// 介面色票由 app.css 依 <html data-daycycle="…"> 同步調整。

export const TRANSITION_MS = 1200

export const periods = [
  {
    key: 'dawn',
    label: '清晨',
    from: 5,
    to: 8,
    sky: ['#f7b98f', '#bfe0f7'],
    light: '#fff0dc',
    intensity: 0.85,
    haze: 0.3,
    stars: 0,
    moon: 0,
    windows: 0
  },
  {
    key: 'day',
    label: '白天',
    from: 8,
    to: 17,
    sky: ['#79c2ff', '#d9f0ff'],
    light: '#ffffff',
    intensity: 1,
    haze: 0,
    stars: 0,
    moon: 0,
    windows: 0
  },
  {
    key: 'dusk',
    label: '黃昏',
    from: 17,
    to: 19,
    sky: ['#f2704b', '#6b3f8f'],
    light: '#e8a070',
    intensity: 0.8,
    haze: 0,
    stars: 0.25,
    moon: 0,
    windows: 0.6
  },
  {
    key: 'night',
    label: '夜晚',
    from: 19,
    to: 29, // 跨日到 05:00
    sky: ['#0d1b3d', '#050912'],
    light: '#9fb4ff',
    intensity: 0.45,
    haze: 0,
    stars: 1,
    moon: 1,
    windows: 1
  }
]

export const periodKeys = periods.map((p) => p.key)

export function periodByKey(key) {
  return periods.find((p) => p.key === key) ?? periods[1]
}

/** 依本地時間（小時，可含小數）判斷時段。 */
export function periodForHour(hour) {
  const h = ((hour % 24) + 24) % 24
  for (const p of periods) {
    if (h >= p.from && h < p.to) return p
    if (p.to > 24 && (h >= p.from || h < p.to - 24)) return p
  }
  return periods[1]
}
