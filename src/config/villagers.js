// 村民（CONTEXT.md）：人數、步行速度與相遇時的對話。
// 對話只聊旅程、卡牌與城鎮，不談技術；每句十字以內，對話框才不會擋住卡牌。

export const VILLAGER_COUNTS = { town: 7, route: 5, city: 9 }
/** 手機與低記憶體裝置 */
export const VILLAGER_COUNTS_LOW = { town: 4, route: 3, city: 5 }
/** 步行速度範圍（單位／秒） */
export const VILLAGER_SPEED = [0.9, 1.4]
/** 每句對話停留秒數 */
export const CHAT_LINE_SECONDS = 2.6

/** when 的群組：daylight 清晨與白天、dark 黃昏與夜晚。 */
export const PERIOD_GROUPS = { daylight: ['dawn', 'day'], dark: ['dusk', 'night'] }

/**
 * when：any 任何時段、dawn／day／dusk／night 單一時段，或 daylight／dark 群組（PLAN §9.3 的四個時段）。
 * weather：只在該屬性天氣時出現（config/weather.js 的 weatherEffects 鍵），clear 表示沒有屬性天氣；省略則任何天氣都說。
 * lines 由兩人輪流說。
 */
export const chatLines = [
  { when: 'any', lines: ['聽說草叢裡有閃卡！', '真的假的？'] },
  { when: 'any', lines: ['你收集幾張了？', '還差一張就齊了！'] },
  { when: 'any', lines: ['博士又在研究卡牌。', '研究所好熱鬧。'] },
  { when: 'any', lines: ['商店進新卡了喔。', '等等去看看！'] },
  { when: 'any', lines: ['這張卡好閃啊！', '是反閃卡吧？'] },
  { when: 'any', lines: ['要不要交換卡牌？', '讓我考慮一下。'] },
  { when: 'any', lines: ['一號道路好長喔。', '沿著路走就到了。'] },
  { when: 'any', lines: ['我想去道館看看。', '先把卡牌整理好！'] },
  // 清晨
  { when: 'dawn', lines: ['早安！起得好早。', '想第一個到商店。'] },
  { when: 'dawn', lines: ['晨霧還沒散呢。', '太陽快出來了。'] },
  { when: 'dawn', lines: ['研究所的燈亮著。', '博士熬夜了吧。'] },
  // 白天（晴天才說天氣好）
  { when: 'daylight', weather: 'clear', lines: ['今天天氣真好。', '適合出門冒險！'] },
  { when: 'daylight', weather: 'clear', lines: ['你看那朵雲！', '像精靈球耶。'] },
  { when: 'day', lines: ['中午吃什麼？', '先去看卡牌再說。'] },
  // 黃昏
  { when: 'dusk', lines: ['夕陽好漂亮。', '像金色的卡牌。'] },
  { when: 'dusk', lines: ['天快黑了。', '再走一圈就回家。'] },
  { when: 'dusk', lines: ['晚餐時間到了。', '媽媽在叫我了！'] },
  // 夜晚（星星與月亮要晴天才看得到）
  { when: 'night', weather: 'clear', lines: ['星星好亮喔。', '明天也會放晴吧。'] },
  { when: 'night', weather: 'clear', lines: ['月亮好圓。', '像一顆精靈球。'] },
  { when: 'night', lines: ['時間不早了。', '晚安，明天見！'] },
  { when: 'night', lines: ['窗戶的燈好溫暖。', '大家都在家呢。'] },
  // 屬性天氣（放大卡牌時切換，PLAN §9.4）
  { when: 'any', weather: 'rain', lines: ['下大雨了！', '快找地方躲雨！'] },
  { when: 'any', weather: 'rain', lines: ['傘帶了嗎？', '忘在家裡了。'] },
  { when: 'any', weather: 'rain', lines: ['屋簷一直在滴水。', '路邊積了好多水。'] },
  { when: 'night', weather: 'rain', lines: ['雨夜好安靜。', '早點回家吧。'] },
  { when: 'any', weather: 'sparks', lines: ['打雷了！', '別站在樹下！'] },
  { when: 'any', weather: 'sparks', lines: ['屋頂在冒電花！', '皮卡丘在附近嗎？'] },
  { when: 'any', weather: 'sparks', lines: ['雲裡一閃一閃的。', '要打大雷了！'] },
  { when: 'any', weather: 'leaves', lines: ['風裡飄著葉子。', '草叢在跳舞耶。'] },
  { when: 'any', weather: 'leaves', lines: ['柵欄長出藤蔓了！', '還開了小花。'] },
  { when: 'daylight', weather: 'leaves', lines: ['樹蔭下有光斑。', '好舒服的陽光。'] },
  { when: 'dark', weather: 'leaves', lines: ['是螢火蟲嗎？', '草叢一閃一閃的。'] },
  { when: 'any', weather: 'embers', lines: ['今天好熱啊。', '太陽好大！'] },
  { when: 'any', weather: 'embers', lines: ['那邊捲起火焰了！', '是火焰旋渦嗎？'] },
  { when: 'any', weather: 'orbs', lines: ['石頭浮起來了！', '是念力嗎？'] },
  { when: 'any', weather: 'orbs', lines: ['天上有極光耶。', '粉紅色的，好漂亮。'] },
  { when: 'any', weather: 'aura', lines: ['地面在震動！', '是誰在練拳？'] },
  { when: 'any', weather: 'aura', lines: ['夕陽好熱血！', '來比腕力吧！'] },
  { when: 'any', weather: 'mist', lines: ['樹叢裡有眼睛…', '別回頭看。'] },
  { when: 'any', weather: 'mist', lines: ['地上的影子在動。', '走路小心點。'] },
  { when: 'daylight', weather: 'mist', lines: ['太陽被遮住了！', '是日蝕嗎？'] },
  { when: 'night', weather: 'mist', lines: ['月亮紅紅的…', '今晚別出門。'] },
  { when: 'any', weather: 'shards', lines: ['屋頂一閃一閃的。', '像鋼鐵一樣亮！'] },
  { when: 'any', weather: 'shards', lines: ['剛剛有道銀光！', '從地上掃過去了。'] },
  { when: 'any', weather: 'petals', lines: ['花瓣飄下來了！', '好像在作夢。'] },
  { when: 'any', weather: 'rays', lines: ['剛剛有龍飛過！', '影子好大啊！'] },
  { when: 'any', weather: 'rays', lines: ['你看，流星！', '是龍星群嗎？'] },
  { when: 'any', weather: 'feathers', lines: ['有羽毛飄過。', '哪來的羽毛？'] },
  { when: 'any', weather: 'feathers', lines: ['風好舒服。', '雲影跑得好快。'] }
]

/** 這組對話在目前時段與天氣（null 為原景）下能不能說。 */
export function chatFits(chat, period, weather) {
  const now = weather ?? 'clear'
  const inPeriod = chat.when === 'any' || chat.when === period || !!PERIOD_GROUPS[chat.when]?.includes(period)
  return inPeriod && (!chat.weather || chat.weather === now)
}

/** 依目前時段與天氣挑一組對話：符合當下的特定句子優先（六成），其餘從通用句子挑，天氣一變就聽得到。 */
export function pickChat(period, weather, random = Math.random) {
  const pool = chatLines.filter(chat => chatFits(chat, period, weather))
  const special = pool.filter(chat => chat.weather || chat.when !== 'any')
  const list = special.length && random() < .6 ? special : pool
  return list[Math.floor(random() * list.length)].lines
}
