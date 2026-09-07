// 第一屬性決定場景氣候；null 表示原景，不推測寶可夢本體的其他屬性。
export const weatherByType = {
  Grass: 'leaves', Fire: 'embers', Water: 'rain', Lightning: 'sparks',
  Psychic: 'orbs', Fighting: 'aura', Darkness: 'mist', Metal: 'shards',
  Fairy: 'petals', Dragon: 'rays', Colorless: 'feathers'
}
export function weatherKeyFor(card) {
  const type = Array.isArray(card?.types) ? card.types[0]
    : typeof card?.types === 'string' ? card.types.trim().split(/[\s,]+/)[0] : null
  return weatherByType[type] ?? null
}
export const WEATHER_TRANSITION_MS = 2000
// 雲量、厚度、環境亮度、近地霧、風、濕度、金屬光澤及背景熱浪。
export const weatherEffects = {
  clear: { sky: '#b7daee', tint: 0, cloud: '#f4f8ff', cover: 1, thickness: 1, light: 1, fog: 0, wind: 0, wet: 0, metal: 0, heat: 0 },
  leaves: { sky: '#b9e4d9', tint: .22, cloud: '#f5faf0', cover: .74, thickness: .8, light: 1, fog: 0, wind: .5 },
  embers: { sky: '#f2b778', tint: .45, cloud: '#f4d8b9', cover: .45, thickness: .5, light: 1.08, fog: .06, heat: 1 },
  rain: { sky: '#7c95aa', tint: .72, cloud: '#7e8e9e', cover: 1.9, thickness: 2, light: .7, fog: .3, wind: .14, wet: 1 },
  sparks: { sky: '#59677e', tint: .8, cloud: '#505b70', cover: 2.2, thickness: 2.9, light: .58, fog: .12, wind: .3 },
  orbs: { sky: '#b8a1cc', tint: .2, cloud: '#c8bfd7', cover: 1, thickness: 1, light: .88, fog: .45 },
  aura: { sky: '#eac6a4', tint: .12, cloud: '#f4e5d4', cover: 1, thickness: 1, light: 1, fog: 0, wind: .12 },
  mist: { sky: '#59616e', tint: .85, cloud: '#515864', cover: 2.1, thickness: 2.2, light: .52, fog: .55, wind: .08 },
  shards: { sky: '#bac6d4', tint: .6, cloud: '#cbd1dc', cover: 1.25, thickness: 1, light: .95, fog: .08, metal: .65, wind: .12 },
  petals: { sky: '#f2baca', tint: .5, cloud: '#ffe0d9', cover: .85, thickness: .85, light: 1, fog: .05, wind: .25 },
  rays: { sky: '#b8cbdc', tint: .3, cloud: '#dfdbc7', cover: 1.5, thickness: 1.7, light: 1, fog: .1, wind: .2 },
  feathers: { sky: '#a8d6ef', tint: .15, cloud: '#ffffff', cover: 1, thickness: 1.1, light: 1, fog: 0, wind: .2 }
}
