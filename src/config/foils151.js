// 151 系列的閃卡素材路徑與稀有度規則（PLAN §15.3、ADR-0005），移植自 pokemon-cards-151 的 CardProxy。
// 差異：反閃卡不做 20% 隨機升大師球；Rare 對應 Rare Holo 151（配合作用域化 CSS 的改名）。

export const SET_151 = 'sv3pt5'
const CDN = import.meta.env.VITE_CDN_151 || 'https://poke-holo.b-cdn.net/foils/151'
const CDN_SET = 'sv3-5'
/** 固定為大師球反閃的卡號 */
const MASTERBALL = new Set([1, 4, 7, 25, 133, 144, 146, 161])
const PATTERN_HOLO = ['Common', 'Uncommon', 'Pokeball Holo', 'Masterball Holo']
const ETCHED = ['Ultra Rare', 'Special Illustration Rare', 'Hyper Rare']

export function is151(card) {
  return card?.set === SET_151
}

/** 回傳交給 lib151 Card 的 rarity、foil、mask 與最終 isReverse。 */
export function resolve151(card, isReverse = false) {
  let rarity = card.rarity
  if (MASTERBALL.has(parseInt(card.number, 10))) { rarity = 'Masterball Holo'; isReverse = true }
  else if (isReverse) rarity = 'Pokeball Holo'
  if (rarity === 'Rare') rarity = 'Rare Holo 151'
  const suffix = isReverse || PATTERN_HOLO.includes(rarity) ? 'ph' : 'std'
  const number = String(card.number).padStart(3, '0')
  const foilSheet = `${CDN}/foils/${CDN_SET}_en_${number}_${suffix}.foil.webp`
  const foil = ETCHED.includes(rarity) ? `${CDN}/etches/${CDN_SET}_en_${number}_${suffix}.etch.webp` : foilSheet
  return { rarity, isReverse, foil, mask: foilSheet }
}
