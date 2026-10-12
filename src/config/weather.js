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
/** HD-2D 的微風：植物擺動的最低風力，晴天也不會靜止。 */
export const BREEZE = .35
// 雲量、厚度、環境亮度、近地霧、風、濕度、金屬光澤及背景熱浪。
// skyLow：地平線的天色（未設定時與 sky 相同）；sunLow：太陽壓低的比例（格鬥的夕陽）；eclipse：日蝕與紅月（惡）。
export const weatherEffects = {
  clear: { sky: '#b7daee', tint: 0, cloud: '#f4f8ff', cover: 1, thickness: 1, light: 1, fog: 0, wind: 0, wet: 0, metal: 0, heat: 0, sunLow: 0, eclipse: 0 },
  leaves: { sky: '#a4e4b6', tint: .4, cloud: '#f5faf0', cover: .8, thickness: 1.25, light: 1.1, fog: 0, wind: 1.15 },
  embers: { sky: '#f7a052', tint: .68, cloud: '#f4b97b', cover: .4, thickness: .55, light: 1.16, fog: .12, heat: 1.8 },
  rain: { sky: '#657f99', tint: .85, cloud: '#637589', cover: 2.35, thickness: 3.2, light: .55, fog: .65, wind: 1.15, wet: 1 },
  sparks: { sky: '#44566d', tint: .87, cloud: '#414d61', cover: 2.6, thickness: 4.2, light: .48, fog: .28, wind: 1 },
  // 2026-10-12 改版：超能力天空上紫下粉；格鬥為橘紅夕陽；惡為暗紫，雲量由 2.65 降為 1.7，日蝕與紅月才露得出來。
  orbs: { sky: '#7a52c8', skyLow: '#efa0d6', tint: .78, cloud: '#dcc2f0', cover: .85, thickness: 1.2, light: .92, fog: .4 },
  aura: { sky: '#f0603a', skyLow: '#ffb24a', tint: .8, cloud: '#f7a56c', cover: .9, thickness: 1.1, light: 1.1, fog: .12, wind: .35, sunLow: 1 },
  mist: { sky: '#3b2a58', skyLow: '#5b3f72', tint: .9, cloud: '#3c3152', cover: 1.7, thickness: 2.6, light: .5, fog: .5, wind: .4, eclipse: 1 },
  shards: { sky: '#b4c9e4', tint: .55, cloud: '#eef3fa', cover: 1.15, thickness: 1.3, light: 1.18, fog: .08, metal: 1, wind: .4 },
  petals: { sky: '#f3aec8', tint: .72, cloud: '#ffdadb', cover: 1, thickness: 1.35, light: 1.05, fog: .12, wind: .65 },
  rays: { sky: '#6d5f9c', tint: .62, cloud: '#a99cc4', cover: 1.9, thickness: 3.2, light: .9, fog: .22, wind: .85 },
  feathers: { sky: '#83c9f5', tint: .32, cloud: '#ffffff', cover: 1.25, thickness: 2.2, light: 1.1, fog: 0, wind: .8 }
}
