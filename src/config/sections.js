// 18 個展示區設定（PLAN §7）。切片與旗標完全沿用原作 App.svelte 的 index，cards.json 已凍結，不得調整。
// blurb 為博士對話框文字：大木博士第一人稱，30 到 50 字，只講卡牌本身，不講效果如何做出來。

export const sections = [
  {
    id: 'common',
    name: '普通與非普通',
    slices: [[1, 4]],
    isReverse: false,
    passSet: false,
    blurb: '這是最常見的卡牌，每一包卡都會有幾張。雖然不會發光，卻是每位訓練家旅程的起點喔。'
  },
  {
    id: 'reverse',
    name: '反閃卡',
    slices: [[4, 7], [70, 76]],
    isReverse: true,
    passSet: true,
    blurb: '反閃卡的閃光不在插畫上，而是整個卡框都會閃。同一張卡有沒有反閃，在收藏家眼中可差得多呢。'
  },
  {
    id: 'holo',
    name: '閃卡',
    slices: [[7, 13]],
    isReverse: false,
    passSet: true,
    blurb: '閃卡的插畫會泛出彩虹般的光芒。我年輕時抽到第一張閃卡，可是興奮了好幾天呢。'
  },
  {
    id: 'cosmos',
    name: '宇宙閃卡',
    slices: [[13, 16]],
    isReverse: false,
    passSet: true,
    blurb: '宇宙閃卡的插畫背後布滿星點，像把整片夜空收進卡裡。老玩家一看到，就會想起小時候。'
  },
  {
    id: 'amazing',
    name: '驚奇稀有',
    slices: [[76, 85]],
    isReverse: false,
    passSet: true,
    blurb: '驚奇稀有的閃光會滿出卡框，色彩格外強烈。這個系列只出過短短幾年，如今相當罕見。'
  },
  {
    id: 'radiant',
    name: '光輝寶可夢',
    slices: [[16, 19]],
    isReverse: false,
    passSet: true,
    blurb: '光輝寶可夢畫的是異色個體，卡面有交錯的光紋。每套牌組只能放一張，所以格外珍貴。'
  },
  {
    id: 'gallery-holo',
    name: '訓練家畫廊閃卡',
    slices: [[19, 22]],
    isReverse: false,
    passSet: true,
    blurb: '訓練家畫廊的卡描繪寶可夢與訓練家相處的日常。金屬般的光澤，讓每個場景都更有溫度。'
  },
  {
    id: 'v',
    name: '寶可夢 V',
    slices: [[22, 25]],
    isReverse: false,
    passSet: true,
    blurb: '寶可夢 V 是實力強大的特別型態，卡面帶著斜向流光。牠們在對戰中可是牌組的主力呢。'
  },
  {
    id: 'v-full-art',
    name: '寶可夢 V 全圖',
    slices: [[25, 28]],
    isReverse: false,
    passSet: true,
    blurb: '全圖卡讓插畫延伸到整張卡面，連文字都疊在畫上。角度一轉，還看得到細細的紋理。'
  },
  {
    id: 'v-alt-art',
    name: '寶可夢 V 異圖',
    slices: [[28, 34]],
    isReverse: false,
    passSet: true,
    blurb: '異圖卡由不同畫師重新詮釋同一隻寶可夢，畫面更像一幅畫。這些可是收藏家最搶手的卡。'
  },
  {
    id: 'vmax',
    name: 'VMAX',
    slices: [[37, 40]],
    isReverse: false,
    passSet: true,
    blurb: 'VMAX 是超極巨化後的寶可夢，體型龐大、氣勢驚人。卡面的光澤也跟著變得深沉厚實。'
  },
  {
    id: 'vmax-alt',
    name: 'VMAX 異圖',
    slices: [[40, 43]],
    isReverse: false,
    passSet: true,
    blurb: 'VMAX 異圖卡把超極巨化的場面畫成全幅插畫，再灑上細碎亮片，看起來就像彩虹一樣。'
  },
  {
    id: 'vstar',
    name: 'VSTAR',
    slices: [[43, 46]],
    isReverse: false,
    passSet: true,
    blurb: 'VSTAR 擁有一場對戰只能使用一次的星星力量。卡面色調淡雅，像是被柔和的光包圍著。'
  },
  {
    id: 'trainer-full-art',
    name: '訓練家全圖',
    slices: [[46, 52]],
    isReverse: false,
    passSet: true,
    blurb: '這些是訓練家的全圖卡，畫的是道館館主、博士和支援者。角色的表情與姿態都很有故事。'
  },
  {
    id: 'rainbow',
    name: '彩虹稀有',
    slices: [[52, 58]],
    isReverse: false,
    passSet: true,
    blurb: '彩虹稀有卡整張泛著粉彩般的七色光，還布滿亮片。這是每一盒卡裡最令人期待的驚喜。'
  },
  {
    id: 'gold',
    name: '黃金秘密稀有',
    slices: [[58, 64]],
    isReverse: false,
    passSet: true,
    blurb: '黃金秘密稀有卡的編號超過該系列的總張數，通體金光閃閃。能抽到一張，真是幸運呢。'
  },
  {
    id: 'gallery-v',
    name: '訓練家畫廊 V 與 VMAX',
    slices: [[64, 70]],
    isReverse: false,
    passSet: true,
    blurb: '訓練家畫廊裡的 V 與 VMAX 卡，把強大的寶可夢與夥伴的互動畫在一起，氣勢與溫情兼具。'
  },
  {
    id: 'shiny-vault',
    name: '閃色寶藏',
    slices: [[85, 91]],
    isReverse: false,
    passSet: true,
    blurb: '閃色寶藏收錄的都是異色寶可夢，卡面是銀白色的底。想集齊這些稀有色彩，可得花不少功夫。'
  }
]

/** 依 slices 從 cards.json 陣列取出該展示區的卡牌。 */
export function sliceCards(cards, section) {
  return section.slices.flatMap(([from, to]) => cards.slice(from, to))
}

/** 建立 cardId → sectionId 的對應（PLAN §9.2），供捕捉時寫入 sectionId。 */
export function buildCardSectionMap(cards) {
  const map = new Map()
  for (const section of sections) {
    for (const card of sliceCards(cards, section)) map.set(card.id, section.id)
  }
  return map
}
