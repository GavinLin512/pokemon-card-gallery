// 村民（CONTEXT.md）：人數、步行速度與相遇時的對話。
// 對話只聊旅程、卡牌與城鎮，不談技術；每句盡量在十字以內，對話框才不會擋住卡牌。

export const VILLAGER_COUNTS = { town: 7, route: 5, city: 9 }
/** 手機與低記憶體裝置 */
export const VILLAGER_COUNTS_LOW = { town: 4, route: 3, city: 5 }
/** 步行速度範圍（單位／秒） */
export const VILLAGER_SPEED = [0.9, 1.4]
/** 每句對話停留秒數 */
export const CHAT_LINE_SECONDS = 2.6

/** when：any 任何時段、day 白天與清晨、night 黃昏與夜晚。lines 由兩人輪流說。 */
export const chatLines = [
  { when: 'any', lines: ['聽說草叢裡有閃卡！', '真的假的？'] },
  { when: 'any', lines: ['你收集幾張了？', '還差一張就齊了！'] },
  { when: 'any', lines: ['博士又在研究卡牌。', '研究所好熱鬧。'] },
  { when: 'any', lines: ['商店進新卡了喔。', '等等去看看！'] },
  { when: 'any', lines: ['這張卡好閃啊！', '是反閃卡吧？'] },
  { when: 'any', lines: ['要不要交換卡牌？', '讓我考慮一下。'] },
  { when: 'any', lines: ['一號道路好長喔。', '沿著路走就到了。'] },
  { when: 'any', lines: ['我想去道館看看。', '先把卡牌整理好！'] },
  { when: 'day', lines: ['今天天氣真好。', '適合出門冒險！'] },
  { when: 'day', lines: ['你看那朵雲！', '像精靈球耶。'] },
  { when: 'night', lines: ['星星好亮喔。', '明天也會放晴吧。'] },
  { when: 'night', lines: ['時間不早了。', '晚安，明天見！'] }
]
