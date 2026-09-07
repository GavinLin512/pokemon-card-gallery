// TCGdex 轉接層（PLAN §6.2、ADR-0003）。
// 搜尋改由 TCGdex GraphQL 取得英文劍盾卡，這裡把回應轉成 pokemontcg.io 的欄位格式：
// 凍結區 CardProxy 依 set、number、rarity、subtypes 決定閃卡遮罩路徑（poke-holo CDN 只有
// pokemontcg.io 格式的集號與卡號），凍結區 CSS 也依 data-rarity、data-subtypes 選擇效果，
// 所以輸出必須與 pokemontcg.io 逐字相同。純函式，無瀏覽器相依，供 tests/ 直接測試。

export const GRAPHQL_URL = 'https://api.tcgdex.net/v2/graphql'
/** TCGdex 沒有圖片時（TG、GG、SV 畫廊集與部分促銷卡）改用 pokemontcg.io 圖片 CDN，與其 API 是分開的服務 */
const PTCG_IMAGES = 'https://images.pokemontcg.io'

/** GraphQL 單次查詢上限（伺服器最多 100） */
export const FETCH_LIMIT = 100

/**
 * TCGdex 集號 -> pokemontcg.io 集號。
 * 陣列順序即發行順序，搜尋結果依此由新到舊排序（GraphQL 的 sort 參數無效，set.releaseDate 也為 null）。
 * 促銷卡 swshp 放最前（最舊），與 pokemontcg.io 依 releaseDate 排序時促銷卡沉底的行為一致。
 */
const SET_TABLE = [
  ['swshp', 'swshp'],
  ['swsh1', 'swsh1'],
  ['swsh2', 'swsh2'],
  ['swsh3', 'swsh3'],
  ['swsh3.5', 'swsh35'],
  ['swsh4', 'swsh4'],
  ['swsh4.5', 'swsh45'],
  ['swsh4.5sv', 'swsh45sv'],
  ['swsh5', 'swsh5'],
  ['swsh6', 'swsh6'],
  ['swsh7', 'swsh7'],
  ['swsh8', 'swsh8'],
  ['swsh9', 'swsh9'],
  ['swsh9tg', 'swsh9tg'],
  ['swsh10', 'swsh10'],
  ['swsh10tg', 'swsh10tg'],
  ['swsh10.5', 'pgo'],
  ['swsh11', 'swsh11'],
  ['swsh11tg', 'swsh11tg'],
  ['swsh12', 'swsh12'],
  ['swsh12tg', 'swsh12tg'],
  ['swsh12.5', 'swsh12pt5'],
  ['swsh12.5gg', 'swsh12pt5gg']
]
const SET_ID = new Map(SET_TABLE)
const SET_ORDER = new Map(SET_TABLE.map(([, ptcg], i) => [ptcg, i]))

/** 畫廊集（Trainer Gallery、Galarian Gallery）：pokemontcg.io 的稀有度前綴 Trainer Gallery */
const GALLERY = /(tg|gg)$/

const STAGE = {
  Basic: 'Basic',
  Stage1: 'Stage 1',
  Stage2: 'Stage 2',
  VMAX: 'VMAX',
  VSTAR: 'VSTAR',
  'V-UNION': 'V-UNION',
  BREAK: 'BREAK'
}

/** 與 pokemontcg.io 查詢欄位對應的 GraphQL 欄位 */
export const CARD_FIELDS =
  'id localId name image rarity category stage suffix trainerType energyType types set { id }'

/** TCGdex 集號轉 pokemontcg.io 集號；不在劍盾清單內回傳 null。 */
export function mapSetId(tcgdexSetId) {
  return SET_ID.get(tcgdexSetId) ?? null
}

/** localId 轉 pokemontcg.io 卡號：純數字去掉前導零（001 -> 1），TG01、SV001、SWSH076 保持原樣。 */
export function mapNumber(localId) {
  const s = String(localId ?? '')
  return /^\d+$/.test(s) ? String(Number(s)) : s
}

/** 卡號的數字部分，供排序 */
function numericPart(number) {
  const m = String(number).match(/\d+/)
  return m ? Number(m[0]) : 0
}

/**
 * TCGdex 稀有度 -> pokemontcg.io 稀有度。
 * 需要 category、stage、suffix、trainerType 判斷 Secret Rare 是彩虹（Rare Rainbow）還是金色（Rare Secret）：
 * 劍盾系列的彩虹卡是 V、VMAX、VSTAR 與支援者卡，其餘秘稀（一般寶可夢、道具、競技場、能量）是金卡。
 */
export function mapRarity(card, ptcgSet) {
  const r = card.rarity ?? 'None'
  const category = card.category
  const isV = card.suffix === 'V' || card.stage === 'VMAX' || card.stage === 'VSTAR'
  const gallery = GALLERY.test(ptcgSet)

  // pokemontcg.io 只在畫廊集的一般閃卡加 Trainer Gallery 前綴，V 系列與全圖訓練家與主集相同，秘稀一律金卡
  if (gallery && (r === 'Rare' || r === 'Holo Rare')) return 'Trainer Gallery Rare Holo'
  if (gallery && r === 'Secret Rare') return 'Rare Secret'

  switch (r) {
    case 'Common':
    case 'Uncommon':
    case 'Rare':
    case 'Promo':
    case 'Radiant Rare':
    case 'Amazing Rare':
      return r
    case 'Holo Rare':
      return 'Rare Holo'
    case 'Holo Rare V':
    case 'Holo Rare VMAX':
    case 'Holo Rare VSTAR':
      // TCGdex 偶有標錯（Mewtwo VSTAR 標成 Holo Rare VMAX），以 stage、suffix 為準
      if (card.stage === 'VMAX') return 'Rare Holo VMAX'
      if (card.stage === 'VSTAR') return 'Rare Holo VSTAR'
      return 'Rare Holo V'
    case 'Ultra Rare':
    case 'Full Art Trainer':
      // 畫廊集的 V 系列在 pokemontcg.io 是 Rare Holo V 系列，不是 Rare Ultra
      if (gallery && card.stage === 'VMAX') return 'Rare Holo VMAX'
      if (gallery && card.stage === 'VSTAR') return 'Rare Holo VSTAR'
      if (gallery && card.suffix === 'V') return 'Rare Holo V'
      return 'Rare Ultra'
    case 'Shiny rare':
      return 'Rare Shiny'
    // Shiny Vault 的 V、VMAX 在 pokemontcg.io 標為 Rare Holo V、VMAX，凍結區 CardProxy 依 SV 卡號自行轉成 Rare Shiny V、VMAX
    case 'Shiny rare V':
      return 'Rare Holo V'
    case 'Shiny rare VMAX':
      return 'Rare Holo VMAX'
    case 'Secret Rare':
      if (category === 'Pokemon') return isV ? 'Rare Rainbow' : 'Rare Secret'
      if (category === 'Trainer') return card.trainerType === 'Supporter' ? 'Rare Rainbow' : 'Rare Secret'
      return 'Rare Secret'
    default:
      return 'Common'
  }
}

/** 由 category、stage、suffix、trainerType、energyType 拼出 pokemontcg.io 的 subtypes 陣列 */
export function mapSubtypes(card) {
  if (card.category === 'Pokemon') {
    const out = []
    const stage = STAGE[card.stage]
    if (stage) out.push(stage)
    // pokemontcg.io 的 VSTAR、V-UNION 只有單一 subtype，不另加 V
    if (card.suffix === 'V' && card.stage !== 'VSTAR' && card.stage !== 'V-UNION') out.push('V')
    if (/^Radiant\s/.test(card.name ?? '')) out.push('Radiant')
    return out.length ? out : ['Basic']
  }
  if (card.category === 'Trainer') {
    const t = card.trainerType
    if (!t) return []
    return [t === 'Tool' ? 'Pokémon Tool' : t]
  }
  if (card.category === 'Energy') return card.energyType ? [card.energyType] : ['Basic']
  return []
}

export function mapSupertype(category) {
  if (category === 'Pokemon') return 'Pokémon'
  return category ?? ''
}

/** 圖片網址：優先 TCGdex，沒有時退回 pokemontcg.io 圖片 CDN */
export function mapImages(card, set, number) {
  if (card.image) {
    return { small: `${card.image}/low.webp`, large: `${card.image}/high.webp` }
  }
  return { small: `${PTCG_IMAGES}/${set}/${number}.png`, large: `${PTCG_IMAGES}/${set}/${number}_hires.png` }
}

/** TCGdex 卡片 -> pokemontcg.io 格式；不在劍盾清單內的卡回傳 null。 */
export function toCard(card) {
  const set = mapSetId(card.set?.id)
  if (!set) return null
  const number = mapNumber(card.localId)
  return {
    id: `${set}-${number}`,
    name: card.name,
    number,
    set,
    supertype: mapSupertype(card.category),
    subtypes: mapSubtypes(card),
    rarity: mapRarity(card, set),
    types: card.types ?? [],
    images: mapImages(card, set, number)
  }
}

/** 依集號發行順序由新到舊，同集依卡號由大到小（對應 pokemontcg.io 的 -set.releaseDate,-number） */
export function sortCards(list) {
  return [...list].sort((a, b) => {
    const d = (SET_ORDER.get(b.set) ?? -1) - (SET_ORDER.get(a.set) ?? -1)
    return d || numericPart(b.number) - numericPart(a.number)
  })
}

/**
 * 閃卡類型（PLAN §6.4）：搜尋框彈出面板的點選項目，名稱沿用展示區卡種名。
 * blocks 是送給 TCGdex 的篩選條件（rarity 為子字串比對，suffix、stage、category、trainerType 為精確比對），
 * 每個 block 一個 GraphQL 別名區塊；test(card, ctx) 以轉換後的卡再過濾，補足 TCGdex 分不出的差異
 * （彩虹與金卡、畫廊集、異圖、宇宙閃）。ctx.alt 是凍結區 alternate-arts.json 的 id 集合，
 * ctx.cosmos 是凍結區 promos.json 中 style 為 Cosmos 的促銷卡 id 集合（只讀取，不修改）。
 * 宇宙閃卡 TCGdex 沒有欄位，只能列出促銷卡；byId 的類型改以 card(id) 逐張查詢，名稱在前端過濾。
 * 順序與展示區相同。
 */
export const FOIL_TYPES = [
  { id: 'common', name: '普通與非普通', blocks: [{ rarity: 'Common' }, { rarity: 'Uncommon' }], isReverse: false, test: (c) => c.rarity === 'Common' || c.rarity === 'Uncommon' },
  { id: 'reverse', name: '反閃卡', blocks: [{ rarity: 'Common' }, { rarity: 'Uncommon' }], isReverse: true, test: (c) => c.rarity === 'Common' || c.rarity === 'Uncommon' },
  // Holo Rare 是子字串，會連 V、VMAX、VSTAR 一起命中，依 stage 與訓練家分塊，避免被 100 張上限吃掉
  { id: 'holo', name: '閃卡', blocks: [{ rarity: 'Holo Rare', stage: 'Basic' }, { rarity: 'Holo Rare', stage: 'Stage1' }, { rarity: 'Holo Rare', stage: 'Stage2' }, { rarity: 'Holo Rare', category: 'Trainer' }], test: (c) => c.rarity === 'Rare Holo' },
  { id: 'cosmos', name: '宇宙閃卡', byId: (ctx) => [...ctx.cosmos], test: (c, ctx) => ctx.cosmos.has(c.id) },
  { id: 'amazing', name: '驚奇稀有', blocks: [{ rarity: 'Amazing Rare' }], test: (c) => c.rarity === 'Amazing Rare' },
  { id: 'radiant', name: '光輝寶可夢', blocks: [{ rarity: 'Radiant Rare' }], test: (c) => c.rarity === 'Radiant Rare' },
  { id: 'gallery-holo', name: '訓練家畫廊閃卡', blocks: [{ rarity: 'Rare', id: 'tg' }, { rarity: 'Rare', id: 'gg' }], test: (c) => c.rarity === 'Trainer Gallery Rare Holo' },
  { id: 'v', name: '寶可夢 V', blocks: [{ rarity: 'Holo Rare V', suffix: 'V' }], test: (c) => c.rarity === 'Rare Holo V' && !GALLERY.test(c.set) && c.set !== 'swsh45sv' },
  { id: 'v-full-art', name: '寶可夢 V 全圖', blocks: [{ rarity: 'Ultra Rare', suffix: 'V' }], test: (c, ctx) => c.rarity === 'Rare Ultra' && c.subtypes.includes('V') && !ctx.alt.has(c.id) },
  { id: 'v-alt-art', name: '寶可夢 V 異圖', blocks: [{ rarity: 'Ultra Rare', suffix: 'V' }], test: (c, ctx) => c.rarity === 'Rare Ultra' && c.subtypes.includes('V') && ctx.alt.has(c.id) },
  { id: 'vmax', name: 'VMAX', blocks: [{ rarity: 'Holo Rare VMAX', stage: 'VMAX' }], test: (c) => c.rarity === 'Rare Holo VMAX' && !GALLERY.test(c.set) && c.set !== 'swsh45sv' },
  { id: 'vmax-alt', name: 'VMAX 異圖', blocks: [{ rarity: 'Secret Rare', stage: 'VMAX' }, { rarity: 'Ultra Rare', stage: 'VMAX' }], test: (c, ctx) => c.subtypes.includes('VMAX') && ctx.alt.has(c.id) && !GALLERY.test(c.set) },
  { id: 'vstar', name: 'VSTAR', blocks: [{ rarity: 'Holo Rare V', stage: 'VSTAR' }], test: (c) => c.rarity === 'Rare Holo VSTAR' && !GALLERY.test(c.set) },
  { id: 'trainer-full-art', name: '訓練家全圖', blocks: [{ rarity: 'Ultra Rare', category: 'Trainer' }, { rarity: 'Full Art Trainer' }], test: (c) => c.rarity === 'Rare Ultra' && c.supertype === 'Trainer' },
  { id: 'rainbow', name: '彩虹稀有', blocks: [{ rarity: 'Secret Rare', suffix: 'V' }, { rarity: 'Secret Rare', stage: 'VMAX' }, { rarity: 'Secret Rare', trainerType: 'Supporter' }], test: (c, ctx) => c.rarity === 'Rare Rainbow' && !ctx.alt.has(c.id) },
  // Secret Rare 的訓練家以 trainerType 分塊，把支援者（彩虹）排除在外
  { id: 'gold', name: '黃金秘密稀有', blocks: [{ rarity: 'Secret Rare', trainerType: 'Item' }, { rarity: 'Secret Rare', trainerType: 'Stadium' }, { rarity: 'Secret Rare', trainerType: 'Tool' }, { rarity: 'Secret Rare', category: 'Energy' }, { rarity: 'Secret Rare', category: 'Pokemon' }], test: (c) => c.rarity === 'Rare Secret' },
  { id: 'gallery-v', name: '訓練家畫廊 V 與 VMAX', blocks: [{ rarity: 'Ultra Rare', id: 'tg' }, { rarity: 'Ultra Rare', id: 'gg' }], test: (c) => /^Rare Holo V/.test(c.rarity) && GALLERY.test(c.set) },
  { id: 'shiny-vault', name: '閃色寶藏', blocks: [{ rarity: 'Shiny rare' }], test: (c) => c.set === 'swsh45sv' }
]

export function foilType(id) {
  return FOIL_TYPES.find((t) => t.id === id) ?? null
}

function gqlFilters(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(', ')
}

/**
 * 組 GraphQL 查詢：名稱 × 篩選條件，每個組合一個別名欄位（TCGdex 的 name 篩選是不分大小寫的子字串比對，
 * 無法用 OR 合併）。未指定 id 時以 id 含 "swsh" 對應原本的 set.id:swsh*。names 為空時只依篩選條件查詢。
 * 給 ids 時改為逐張 card(id) 查詢，忽略 names 與 blocks。
 */
export function buildQuery(names, blocks = [{}], limit = FETCH_LIMIT, ids = null) {
  const parts = []
  if (ids) {
    for (const id of ids) parts.push(`q${parts.length}: card(id: ${JSON.stringify(id)}) { ${CARD_FIELDS} }`)
    return `{ ${parts.join(' ')} }`
  }
  const nameList = names.length ? names : [null]
  for (const name of nameList) {
    for (const block of blocks) {
      const filters = { ...(name ? { name } : {}), id: 'swsh', ...block }
      parts.push(
        `q${parts.length}: cards(filters: { ${gqlFilters(filters)} }, pagination: { page: 1, count: ${limit} }) { ${CARD_FIELDS} }`
      )
    }
  }
  return `{ ${parts.join(' ')} }`
}

/** 合併各別名欄位（cards 陣列或 card 單筆）、轉格式、去重、排序 */
export function parseResponse(data) {
  const seen = new Set()
  const out = []
  for (const value of Object.values(data ?? {})) {
    const list = Array.isArray(value) ? value : value ? [value] : []
    for (const raw of list) {
      const card = toCard(raw)
      if (!card || seen.has(card.id)) continue
      seen.add(card.id)
      out.push(card)
    }
  }
  return sortCards(out)
}
