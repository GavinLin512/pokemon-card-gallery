// 151 系列的 10 個展示區（PLAN §15）。卡牌以 ids 指定 cards-151.json 的卡，每站最多 6 張（151 效果層數多，手機負擔較重）。
// 大師球反閃由 config/foils151.js 依卡號固定；精靈球反閃以展示區 isReverse 渲染。
// blurb 為博士對話框文字：大木博士第一人稱，30 到 50 字，只講卡牌本身，不講效果如何做出來。

const ids = (...numbers) => numbers.map(n => `sv3pt5-${n}`)

export const sections151 = [
  {
    id: '151-common',
    name: '普通與非普通',
    ids: ids(10, 16, 19, 39, 52, 54),
    isReverse: false,
    passSet: true,
    blurb: '151 系列的普通卡把關都地區的寶可夢按圖鑑編號排好。從妙蛙種子一路數到夢幻，真是令人懷念的順序啊。'
  },
  {
    id: '151-pokeball',
    name: '精靈球反閃',
    ids: ids(35, 58, 63, 92, 120, 129),
    isReverse: true,
    passSet: true,
    blurb: '這個系列的反閃卡框上印滿了小小的精靈球圖樣。翻動卡牌時，一顆顆球會跟著閃爍，很有這個系列的味道。'
  },
  {
    id: '151-masterball',
    name: '大師球反閃',
    ids: ids(1, 4, 7, 25, 133, 144),
    isReverse: true,
    passSet: true,
    blurb: '大師球反閃卡非常罕見，卡框上是紫色的大師球圖樣。能抽到一張，連我這個老博士都會忍不住炫耀呢。'
  },
  {
    id: '151-holo',
    name: '閃卡',
    ids: ids(26, 94, 130, 134, 149, 150),
    isReverse: false,
    passSet: true,
    blurb: '151 的閃卡插畫會泛出細緻的彩虹光澤。超夢、快龍這些老朋友換上新畫風，看起來還是那麼有威嚴。'
  },
  {
    id: '151-ex',
    name: '寶可夢 ex',
    ids: ids(3, 6, 9, 65, 145, 151),
    isReverse: false,
    passSet: true,
    blurb: '寶可夢 ex 是這個系列的主力卡，卡框帶著金屬質感的紋路。噴火龍 ex 更是許多訓練家夢寐以求的一張。'
  },
  {
    id: '151-illustration',
    name: '插畫稀有',
    ids: ids(166, 168, 170, 173, 175, 181),
    isReverse: false,
    passSet: true,
    blurb: '插畫稀有卡以整張畫面描繪寶可夢的日常。看著皮卡丘和傑尼龜在關都各地生活的樣子，我也想再出門旅行了。'
  },
  {
    id: '151-ex-full-art',
    name: 'ex 全圖',
    ids: ids(182, 183, 184, 188, 192, 193),
    isReverse: false,
    passSet: true,
    blurb: 'ex 全圖卡把寶可夢放大到整個卡面，金色的紋理會隨著角度變化。這種氣勢，光是看著就覺得很強。'
  },
  {
    id: '151-trainer-full-art',
    name: '訓練家全圖',
    ids: ids(194, 195, 196, 197),
    isReverse: false,
    passSet: true,
    blurb: '訓練家全圖卡畫的是關都的熟面孔，莉佳、坂木都在裡面。想起當年和他們打交道的日子，真是感慨呢。'
  },
  {
    id: '151-special-illustration',
    name: '特別插畫稀有',
    ids: ids(198, 199, 200, 201, 202, 203),
    isReverse: false,
    passSet: true,
    blurb: '特別插畫稀有卡是整個系列最精緻的畫作，噴火龍 ex 的那張更是人人搶著收藏。請仔細看看畫裡的細節吧。'
  },
  {
    id: '151-hyper',
    name: '超稀有',
    ids: ids(205, 206, 207),
    isReverse: false,
    passSet: true,
    blurb: '超稀有卡整張都是金色的，連基本能量卡也閃閃發亮。這是 151 系列裡最難遇見的卡，請好好欣賞吧。'
  }
]
