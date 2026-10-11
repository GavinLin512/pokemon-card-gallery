// 背景音樂（PLAN §9.8）：四個時段各一首，檔案放 public/audio/。
// 曲目皆來自こんとどぅふぇ（作曲 HiLi-ひぃ-），各曲頁面載明可免費商用、不需署名、可剪裁循環。

import { TRANSITION_MS } from './dayCycle.js'

/** 時段切換時的交叉淡化時間，與場景光照過渡一致。 */
export const CROSSFADE_MS = TRANSITION_MS
/** 循環接縫的交叉淡化時間：四首都不是無縫循環檔。 */
export const LOOP_FADE_MS = 300
/** 關閉時的淡出時間。 */
export const STOP_FADE_MS = 400
/** 換曲時跑馬燈文字淡出、再淡入各花的時間，兩段合計不超過 CROSSFADE_MS。 */
export const TITLE_FADE_MS = 600
export const VOLUME = 0.5
/** 跑馬燈與無障礙標籤用的來源署名。 */
export const CREDIT = 'こんとどぅふぇ（作曲 HiLi-ひぃ-）'

export const tracks = {
  dawn: { src: '/audio/bgm-dawn.mp3', title: 'もうあさだよ' },
  day: { src: '/audio/bgm-day.mp3', title: 'ティンクルハロータウン' },
  dusk: { src: '/audio/bgm-dusk.mp3', title: '草原の歌' },
  night: { src: '/audio/bgm-night.mp3', title: 'First Moon' }
}

export function trackFor(key) {
  return tracks[key] ?? tracks.day
}
