// 搜尋狀態與查詢邏輯（PLAN §6.2、§6.3；ADR-0003：TCGdex GraphQL，回應經 config/tcgdex.js 轉成 pokemontcg.io 格式）。
// Search.svelte 只負責輸入框，SearchResults.svelte 只負責結果，狀態都在這裡。

import { cards as cardRegistry } from './cards.svelte.js'
import { GRAPHQL_URL, buildQuery, parseResponse, foilType } from '../config/tcgdex.js'
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

// 英文卡名去掉前後綴後再反查中文名
const EN_PREFIX = /^(Radiant|Galarian|Alolan|Hisuian|Paldean|Shiny|Dark|Light|Team Rocket's|Detective)\s+/i
const EN_SUFFIX = /\s+(V|VMAX|VSTAR|V-UNION|GX|EX|ex|BREAK|LV\.X|δ|Prime|LEGEND)$/

let query = $state('')
/** idle | loading | done | empty | no-name | error */
let status = $state('idle')
let results = $state([])
/** 中文模式命中的譯名 [{ n, zh, en }] */
let matched = $state([])
/** 點選的閃卡類型 id（config/tcgdex.js FOIL_TYPES），null 為不限 */
let foil = $state(null)

let timer
let seq = 0
let names = null
let enIndex = null

function isChinese(q) {
  return CJK.test(q)
}

function isUsable(q) {
  const t = q.trim()
  return t.length >= (isChinese(t) ? MIN_ZH : MIN_EN)
}

async function loadNames() {
  if (names) return names
  const mod = await import('../config/pokemonNames.json')
  names = mod.default
  enIndex = new Map(names.map((r) => [r.en.toLowerCase(), r.zh]))
  return names
}

/** 依 zh 與 aliases 比對：完全相符 > 前綴 > 子字串，最多 MAX_NAMES 隻。 */
function lookupNames(q) {
  const scored = []
  for (const row of names) {
    const candidates = [row.zh, ...(row.a ?? [])]
    let best = 0
    for (const c of candidates) {
      if (c === q) best = Math.max(best, 3)
      else if (c.startsWith(q)) best = Math.max(best, 2)
      else if (c.includes(q)) best = Math.max(best, 1)
    }
    if (best) scored.push({ score: best, n: row.n, zh: row.zh, en: row.en })
  }
  scored.sort((a, b) => b.score - a.score || a.n - b.n)
  return scored.slice(0, MAX_NAMES).map(({ n, zh, en }) => ({ n, zh, en }))
}

/** 英文卡名反查中文名，找不到回傳空字串。 */
function zhName(en) {
  if (!enIndex || !en) return ''
  let base = en.trim()
  for (let i = 0; i < 3; i++) base = base.replace(EN_PREFIX, '').replace(EN_SUFFIX, '')
  return enIndex.get(base.toLowerCase()) ?? ''
}

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

  if (!isUsable(q)) {
    matched = []
  } else if (isChinese(q)) {
    await loadNames()
    if (mySeq !== seq) return
    const hits = lookupNames(q)
    if (!hits.length) {
      matched = []
      results = []
      status = 'no-name'
      return
    }
    matched = hits
    names = hits.map((h) => h.en)
  } else {
    matched = []
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
      data = await fetchWithRetry(buildQuery(names, type?.blocks))
    }
    // 為了顯示中文名，英文模式也載入譯名對照（首次搜尋才載，之後快取）
    await loadNames()
    if (mySeq !== seq) return
    let found = parseResponse(data)
    if (type) found = found.filter((c) => type.test(c, FOIL_CTX))
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
