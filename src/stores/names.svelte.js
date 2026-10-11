// 譯名對照（PLAN §6.3）：中文搜尋與卡牌中文名共用。包含寶可夢名（pokemonNames.json，約 60KB）
// 與訓練家、物品、能量卡名（cardNames.json），第一次需要時才以動態 import() 載入。

// 卡名整串先比對（訓練家等卡名不拆前後綴）；比對前把彎引號換成直引號、去掉結尾的括號副標，
// 例如 TCGdex 的 Bill’s Analysis、Boss's Orders (Lysandre)。
const clean = (s) => s.trim().replace(/[‘’]/g, "'").replace(/\s*[(（][^()（）]*[)）]$/, '')

// 比對不到時視為寶可夢卡，去掉前後綴後再反查中文名。地區型態與起源型態是寶可夢本身的型態，翻成中文保留在卡名前；
// 其餘前綴（光輝、一擊、連擊等）只去掉不顯示。
const FORM_ZH = { alolan: '阿羅拉', galarian: '伽勒爾', hisuian: '洗翠', paldean: '帕底亞', 'origin forme': '起源型態' }
const EN_FORM = /^(Alolan|Galarian|Hisuian|Paldean|Origin Forme)\s+/i
const EN_PREFIX = /^(Radiant|Shiny|Dark|Light|Team Rocket's|Detective|Single Strike|Rapid Strike)\s+/i
const EN_SUFFIX = /\s+(V|VMAX|VSTAR|V-UNION|GX|EX|ex|BREAK|LV\.X|δ|Prime|LEGEND)$/
// 對照表把性別符號直接接在英文名後（Nidoran♀），中文名不含符號，顯示時當成後綴補回
const EN_GENDER = /\s*([♀♂])$/

/** 載入前為 null；用 $state.raw 讓顯示中文名的元件在載入完成後自動更新 */
let table = $state.raw(null)
let pending = null

/**
 * 載入譯名對照，回傳寶可夢與卡名合併的 [{ n?, zh, en, e?, a? }]（卡名沒有 n，e 為同一張卡的其他英文名）；
 * 重複呼叫共用同一次載入，失敗後下次呼叫會重試。
 */
export function loadNames() {
  pending ??= Promise.all([import('../config/pokemonNames.json'), import('../config/cardNames.json')]).then(
    ([pokemon, cards]) => {
      const rows = [...pokemon.default, ...cards.default]
      const en = new Map()
      for (const r of rows) for (const name of [r.en, ...(r.e ?? [])]) en.set(clean(name).toLowerCase(), r.zh)
      table = { rows, en }
      return rows
    },
    (err) => {
      pending = null
      throw err
    }
  )
  return pending
}

/**
 * 查對照表，回傳 { zh, prefix, suffix }；查不到為 null。整串比對不到才去掉前後綴再查。
 * prefix 為中文型態，直接接在中文名前（例如 '阿羅拉'）；suffix 含前導空白（例如 ' VMAX'、' ♀'）。
 */
function lookup(en) {
  if (!table || !en) return null
  let base = clean(en)
  const whole = table.en.get(base.toLowerCase())
  if (whole) return { zh: whole, prefix: '', suffix: '' }
  let prefix = ''
  let suffix = ''
  for (let i = 0; i < 3; i++) {
    base = base.replace(EN_PREFIX, '')
    const form = base.match(EN_FORM)
    if (form) {
      prefix += FORM_ZH[form[1].toLowerCase()]
      base = base.slice(form[0].length)
    }
    const m = base.match(EN_SUFFIX)
    if (m) {
      suffix = ` ${m[1]}${suffix}`
      base = base.slice(0, m.index)
    }
  }
  const gender = base.match(EN_GENDER)
  if (gender) {
    base = base.slice(0, gender.index) + gender[1]
    suffix = ` ${gender[1]}${suffix}`
  }
  const zh = table.en.get(base.toLowerCase())
  return zh ? { zh, prefix, suffix } : null
}

/** 英文卡名反查中文名（不含前後綴）；對照表還沒載入或找不到時回傳空字串。 */
export function zhName(en) {
  return lookup(en)?.zh ?? ''
}

/** 同 zhName，但保留型態與後綴，例如 Espeon VMAX → 太陽伊布 VMAX、Alolan Vulpix VSTAR → 阿羅拉六尾 VSTAR。 */
export function zhCardName(en) {
  const hit = lookup(en)
  return hit ? hit.prefix + hit.zh + hit.suffix : ''
}
