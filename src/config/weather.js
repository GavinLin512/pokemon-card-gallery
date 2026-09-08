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
  leaves: { sky: '#a4e4b6', tint: .4, cloud: '#f5faf0', cover: .8, thickness: 1.25, light: 1.1, fog: 0, wind: 1.15 },
  embers: { sky: '#f7a052', tint: .68, cloud: '#f4b97b', cover: .4, thickness: .55, light: 1.16, fog: .12, heat: 1.8 },
  rain: { sky: '#657f99', tint: .85, cloud: '#637589', cover: 2.35, thickness: 3.2, light: .55, fog: .65, wind: 1.15, wet: 1 },
  sparks: { sky: '#44566d', tint: .87, cloud: '#414d61', cover: 2.6, thickness: 4.2, light: .48, fog: .28, wind: 1 },
  orbs: { sky: '#a486ce', tint: .48, cloud: '#b2a1ce', cover: 1.15, thickness: 1.4, light: .85, fog: .6 },
  aura: { sky: '#e9b284', tint: .32, cloud: '#efd3ad', cover: 1, thickness: 1.15, light: 1.05, fog: .1, wind: .35 },
  mist: { sky: '#384556', tint: .94, cloud: '#354353', cover: 2.65, thickness: 4, light: .4, fog: .8, wind: .6 },
  shards: { sky: '#c0cddd', tint: .8, cloud: '#d4dce7', cover: 1.35, thickness: 1.5, light: 1.08, fog: .15, metal: 1, wind: .4 },
  petals: { sky: '#f3aec8', tint: .72, cloud: '#ffdadb', cover: 1, thickness: 1.35, light: 1.05, fog: .12, wind: .65 },
  rays: { sky: '#acb9d0', tint: .45, cloud: '#d7caa7', cover: 1.9, thickness: 3.2, light: 1.05, fog: .2, wind: .85 },
  feathers: { sky: '#83c9f5', tint: .32, cloud: '#ffffff', cover: 1.25, thickness: 2.2, light: 1.1, fog: 0, wind: .8 }
}
