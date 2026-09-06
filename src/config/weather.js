// 屬性天氣（PLAN §9.4）：放大檢視中卡牌的第一個屬性 → 粒子效果。
// mode 對應 scene/weather.js 的頂點著色器分支；additive 為發光類型的疊加混色。

export const weatherByType = {
  Grass: 'leaves',
  Fire: 'embers',
  Water: 'rain',
  Lightning: 'sparks',
  Psychic: 'orbs',
  Fighting: 'dust',
  Darkness: 'mist',
  Metal: 'shards',
  Fairy: 'stars',
  Dragon: 'scales',
  Colorless: 'feathers'
}

export const weatherEffects = {
  leaves: { mode: 0, color: '#7fd66a', size: 14, additive: false },
  embers: { mode: 1, color: '#ff9a3c', size: 8, additive: true },
  rain: { mode: 2, color: '#d8ecff', size: 14, additive: false },
  sparks: { mode: 3, color: '#fff2a8', size: 6, additive: true, lightning: true },
  orbs: { mode: 4, color: '#c88cff', size: 12, additive: true },
  dust: { mode: 5, color: '#d9c28a', size: 10, additive: false },
  mist: { mode: 6, color: '#4a3560', size: 90, additive: false },
  shards: { mode: 7, color: '#e3e8f0', size: 12, additive: false },
  stars: { mode: 8, color: '#ffa8d8', size: 14, additive: true },
  scales: { mode: 9, color: '#ffd35c', size: 9, additive: true },
  feathers: { mode: 10, color: '#ffffff', size: 16, additive: false },
  /** 無屬性（訓練家、能量）：柔和光暈，無粒子 */
  glow: { mode: -1, color: '#fff3c4', size: 0, additive: true, glow: true }
}

/** 依卡牌資料決定天氣 key；雙屬性取第一個，無屬性回 glow。 */
export function weatherKeyFor(card) {
  if (!card) return null
  const type = Array.isArray(card.types) ? card.types[0] : typeof card.types === 'string' ? card.types.split(/[\s,]+/)[0] : null
  return (type && weatherByType[type]) || 'glow'
}

/** 收合後淡出時間（毫秒） */
export const WEATHER_FADE_OUT_MS = 2000
