// 搜尋狀態與查詢邏輯（PLAN §6.2、§6.3；ADR-0002：原生 fetch，不用 pokemontcgsdk）。
// Search.svelte 只負責輸入框，SearchResults.svelte 只負責結果，狀態都在這裡。

import { cards as cardRegistry } from './cards.svelte.js'

const API = 'https://api.pokemontcg.io/v2/cards'
const SELECT = 'id,name,number,supertype,subtypes,rarity,images,types,set'
const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/
const DEBOUNCE_MS = 666
const MIN_EN = 3
const MIN_ZH = 2 // 兩字寶可夢名（超夢、快龍）很常見，中文模式放寬到 2 字
const MAX_NAMES = 8
const PAGE_SIZE = 36
const RETRY_MS = [1000, 2000, 4000]
const REQUEST_TIMEOUT_MS = 10000 // 單次請求逾時，避免伺服器不回應時無限等待

// 英文卡名去掉前後綴後再反查中文名
const EN_PREFIX = /^(Radiant|Galarian|Alolan|Hisuian|Paldean|Shiny|Dark|Light|Team Rocket's|Detective)\s+/i
const EN_SUFFIX = /\s+(V|VMAX|VSTAR|V-UNION|GX|EX|ex|BREAK|LV\.X|δ|Prime|LEGEND)$/

let query = $state('')
/** idle | loading | done | empty | no-name | error */
let status = $state('idle')
let results = $state([])
/** 中文模式命中的譯名 [{ n, zh, en }] */
let matched = $state([])

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

async function fetchWithRetry(url) {
  const headers = {}
  const key = import.meta.env.VITE_API_KEY
  if (key) headers['X-Api-Key'] = key
  let attempt = 0
  for (;;) {
    let res
    try {
      res = await fetch(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    } catch (err) {
      // 5xx 回應通常缺 CORS 標頭，瀏覽器會以網路錯誤拋出，一併視為可重試
      if (attempt < RETRY_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_MS[attempt++]))
        continue
      }
      throw err
    }
    if (res.ok) return res.json()
    if (res.status >= 500 && attempt < RETRY_MS.length) {
      await new Promise((r) => setTimeout(r, RETRY_MS[attempt++]))
      continue
    }
    throw new Error(`pokemontcg.io 回應 ${res.status}`)
  }
}

async function run() {
  const q = query.trim()
  const mySeq = ++seq
  let nameFilter

  if (isChinese(q)) {
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
    nameFilter = `(${hits.map((h) => `name:"${h.en}"`).join(' OR ')})`
  } else {
    matched = []
    nameFilter = `name:"*${q}*"`
  }

  const params = new URLSearchParams({
    q: `(set.id:swsh* AND ${nameFilter})`,
    select: SELECT,
    orderBy: '-set.releaseDate,-number',
    pageSize: String(PAGE_SIZE)
  })

  try {
    const data = await fetchWithRetry(`${API}?${params}`)
    // 為了顯示中文名，英文模式也載入譯名對照（首次搜尋才載，之後快取）
    await loadNames()
    if (mySeq !== seq) return
    const list = (data.data ?? []).slice(0, PAGE_SIZE).map((card) => ({
      ...card,
      set: card.set.id,
      // 與原作相同：普通、非普通卡隨機標為反閃
      isReverse: card.rarity === 'Common' || card.rarity === 'Uncommon' ? !!Math.round(Math.random()) : false,
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

function schedule() {
  clearTimeout(timer)
  seq++
  if (!isUsable(query)) {
    status = 'idle'
    results = []
    matched = []
    return
  }
  status = 'loading'
  timer = setTimeout(run, DEBOUNCE_MS)
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
  get isChinese() {
    return isChinese(query)
  },
  /** 搜尋中：關鍵字已達最低長度，頁面只顯示搜尋結果。 */
  get active() {
    return isUsable(query)
  },
  clear() {
    query = ''
    schedule()
  }
}
