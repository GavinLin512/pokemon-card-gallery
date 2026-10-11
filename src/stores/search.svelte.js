// 搜尋狀態與查詢邏輯（PLAN §6.2、§6.3；ADR-0003：TCGdex GraphQL，回應經 config/tcgdex.js 轉成 pokemontcg.io 格式）。
// Search.svelte 只負責輸入框，SearchResults.svelte 只負責結果，狀態都在這裡。

import { cards as cardRegistry } from './cards.svelte.js'
import { GRAPHQL_URL, SERIES_SET_FILTER, buildQuery, parseResponse, foilType } from '../config/tcgdex.js'
import { journey } from './journey.svelte.js'
import { loadNames, zhName } from './names.svelte.js'
import altArts from '../lib/components/alternate-arts.json'
import promos from '../lib/components/promos.json'

/** 凍結區的異圖卡 id 與宇宙閃促銷卡 id，供閃卡類型過濾（只讀取，不修改） */
const FOIL_CTX = {
  alt: new Set(altArts),
  cosmos: new Set(Object.keys(promos).filter((id) => promos[id].style === 'Cosmos'))
}

const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/
const DEBOUNCE_MS = 666
const MIN_EN = 3
const MIN_ZH = 2 // 兩字寶可夢名（超夢、快龍）很常見，中文模式放寬到 2 字
const MAX_NAMES = 8
const PAGE_SIZE = 36
const RETRY_MS = [1000, 2000, 4000]
const REQUEST_TIMEOUT_MS = 10000 // 單次請求逾時，避免伺服器不回應時無限等待
const ID_BATCH = 20 // 逐張 card(id) 查詢每批張數：TCGdex 每張約 150ms，84 張一次送會超過逾時，分批並行

let query = $state('')
/** idle | loading | done | empty | no-name | error */
let status = $state('idle')
let results = $state([])
/** 中文模式命中的譯名 [{ n, zh, en, e }]（e 為卡名的其他英文名） */
let matched = $state([])
/** 中文模式符合的譯名總數；超過 MAX_NAMES 時只查詢前 MAX_NAMES 筆，結果區會提示 */
let matchedTotal = $state(0)
/** 點選的閃卡類型 id（config/tcgdex.js FOIL_TYPES），null 為不限 */
let foil = $state(null)

let timer
let seq = 0

function isChinese(q) {
  return CJK.test(q)
}

function isUsable(q) {
  const t = q.trim()
  return t.length >= (isChinese(t) ? MIN_ZH : MIN_EN)
}

const CARD_NAME_ORDER = 10000 // 訓練家等卡名沒有圖鑑編號，同分時排在寶可夢之後

/** 依 zh 與 aliases 比對（寶可夢與訓練家、物品、能量卡名），排序為完全相符 > 前綴 > 子字串，回傳全部符合者；查詢時只取前 MAX_NAMES 筆。 */
function lookupNames(rows, q) {
  const scored = []
  for (const row of rows) {
    const candidates = [row.zh, ...(row.a ?? [])]
    let best = 0
    for (const c of candidates) {
      if (c === q) best = Math.max(best, 3)
      else if (c.startsWith(q)) best = Math.max(best, 2)
      else if (c.includes(q)) best = Math.max(best, 1)
    }
    if (best) scored.push({ score: best, n: row.n ?? CARD_NAME_ORDER, zh: row.zh, en: row.en, e: row.e, card: row.n === undefined })
  }
  scored.sort((a, b) => b.score - a.score || a.n - b.n)
  return scored.map(({ n, zh, en, e, card }) => ({ n, zh, en, e, card }))
}

/** 卡名以整個單字比對（TCGdex 的名稱條件是子字串比對，Leon 會帶出 Charmeleon、Empoleon 等寶可夢） */
const wordPattern = (name) => new RegExp(`(^|[^a-z0-9])${name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`)

async function fetchWithRetry(query) {
  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  }
  let attempt = 0
  for (;;) {
    let res
    try {
      res = await fetch(GRAPHQL_URL, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    } catch (err) {
      // 5xx 回應通常缺 CORS 標頭，瀏覽器會以網路錯誤拋出，一併視為可重試
      if (attempt < RETRY_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_MS[attempt++]))
        continue
      }
      throw err
    }
    if (res.ok) {
      const json = await res.json()
      if (json.errors?.length) throw new Error(`TCGdex GraphQL：${json.errors[0].message}`)
      return json.data
    }
    if (res.status >= 500 && attempt < RETRY_MS.length) {
      await new Promise((r) => setTimeout(r, RETRY_MS[attempt++]))
      continue
    }
    throw new Error(`TCGdex 回應 ${res.status}`)
  }
}

async function run() {
  const q = query.trim()
  const mySeq = ++seq
  const type = foilType(foil)
  /** 送給 TCGdex 的英文名稱清單（子字串比對，不分大小寫）；只點閃卡類型時為空 */
  let names = []
  /** 中文模式命中訓練家等卡名時的結果過濾：寶可夢名維持子字串比對，卡名改為整個單字比對 */
  let nameFilter = null

  if (!isUsable(q)) {
    matched = []
    matchedTotal = 0
  } else if (isChinese(q)) {
    const rows = await loadNames()
    if (mySeq !== seq) return
    const all = lookupNames(rows, q)
    const hits = all.slice(0, MAX_NAMES)
    matchedTotal = all.length
    if (!hits.length) {
      matched = []
      results = []
      status = 'no-name'
      return
    }
    matched = hits
    names = hits.flatMap((h) => [h.en, ...(h.e ?? [])])
    if (hits.some((h) => h.card)) {
      const pokemon = hits.filter((h) => !h.card).map((h) => h.en.toLowerCase())
      const cards = hits.filter((h) => h.card).flatMap((h) => [h.en, ...(h.e ?? [])]).map(wordPattern)
      nameFilter = (c) => {
        const n = c.name.toLowerCase().replace(/[‘’]/g, "'")
        return pokemon.some((k) => n.includes(k)) || cards.some((re) => re.test(n))
      }
    }
  } else {
    matched = []
    matchedTotal = 0
    names = [q]
  }

  try {
    const ids = type?.byId ? type.byId(FOIL_CTX) : null
    let data
    if (ids) {
      const batches = []
      for (let i = 0; i < ids.length; i += ID_BATCH) batches.push(ids.slice(i, i + ID_BATCH))
      const parts = await Promise.all(batches.map((b) => fetchWithRetry(buildQuery([], [{}], undefined, b))))
      data = Object.fromEntries(parts.flatMap((part, i) => Object.entries(part).map(([k, v]) => [`b${i}${k}`, v])))
    } else {
      // 只在目前系列內找（PLAN §15.7）
      data = await fetchWithRetry(buildQuery(names, type?.blocks, undefined, null, SERIES_SET_FILTER[journey.series]))
    }
    // 為了顯示中文名，英文模式也載入譯名對照（首次搜尋才載，之後快取）
    await loadNames()
    if (mySeq !== seq) return
    let found = parseResponse(data)
    if (type) found = found.filter((c) => type.test(c, FOIL_CTX))
    if (nameFilter) found = found.filter(nameFilter)
    // 逐張查詢的類型沒有送名稱條件，在前端以名稱子字串過濾
    if (ids && names.length) {
      const keys = names.map((n) => n.toLowerCase())
      found = found.filter((c) => keys.some((k) => c.name.toLowerCase().includes(k)))
    }
    const list = found.slice(0, PAGE_SIZE).map((card) => ({
      ...card,
      // 與原作相同：普通、非普通卡隨機標為反閃；點選「反閃卡」時全部標為反閃
      isReverse: type
        ? !!type.isReverse
        : card.rarity === 'Common' || card.rarity === 'Uncommon'
          ? !!Math.round(Math.random())
          : false,
      zh: zhName(card.name)
    }))
    cardRegistry.register(list)
    results = list
    status = list.length ? 'done' : 'empty'
  } catch {
    if (mySeq !== seq) return
    results = []
    status = 'error'
  }
}

/** 輸入文字走 debounce；點選閃卡類型立即查詢 */
function schedule(immediate = false) {
  clearTimeout(timer)
  seq++
  if (!isUsable(query) && !foil) {
    status = 'idle'
    results = []
    matched = []
    matchedTotal = 0
    return
  }
  status = 'loading'
  if (immediate) run()
  else timer = setTimeout(run, DEBOUNCE_MS)
}

export const search = {
  get query() {
    return query
  },
  set query(value) {
    query = value ?? ''
    schedule()
  },
  get status() {
    return status
  },
  get results() {
    return results
  },
  get matched() {
    return matched
  },
  /** 中文模式符合的譯名超過上限時為 { total, limit }，否則為 null */
  get nameOverflow() {
    return matchedTotal > MAX_NAMES ? { total: matchedTotal, limit: MAX_NAMES } : null
  },
  get foil() {
    return foil
  },
  /** 點選閃卡類型；再點同一個取消 */
  set foil(id) {
    foil = id === foil ? null : id ?? null
    schedule(true)
  },
  get foilName() {
    return foilType(foil)?.name ?? ''
  },
  get isChinese() {
    return isChinese(query)
  },
  /** 搜尋中：關鍵字已達最低長度或已點選閃卡類型，供搜尋面板判斷是否有有效查詢。 */
  get active() {
    return isUsable(query) || !!foil
  },
  retry() { schedule(true) },
  clear() {
    query = ''
    foil = null
    schedule()
  }
}
