// docs/pokemon-names.csv → src/config/pokemonNames.json
// docs/card-names.csv    → src/config/cardNames.json
// 寶可夢 CSV 欄位：no, zh_tw, en, aliases；卡名 CSV（訓練家、物品、能量）欄位：en, zh_tw, aliases, source。
// 別名以 | 分隔；卡名的 en 也可用 | 列出多個英文名（同一張卡在不同系列的英文名，例如 Basic Psychic Energy|Psychic Energy）。
// source 為確認繁中正式名用的 TCGdex zh-tw 卡號，只供查證、不輸出。UTF-8 with BOM，CRLF 或 LF 皆可。
// 輸出精簡格式：寶可夢 [{ n, zh, en, a: [...] }]、卡名 [{ zh, en, e: [其他英文名], a: [...] }]，供中文搜尋與卡名顯示以動態 import 載入。
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 英文名可能含逗號以外的符號（'、.、é、空白），CSV 本身不含引號欄位，直接以逗號切段即可。
function readCsv(file, required) {
  const text = readFileSync(resolve(root, file), 'utf8').replace(/^﻿/, '')
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  const header = lines.shift().split(',')
  const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]))
  for (const k of required) {
    if (!(k in col)) throw new Error(`${file} 缺少欄位 ${k}`)
  }
  return lines.map((line, i) => {
    const parts = line.split(',')
    if (parts.length < header.length) throw new Error(`${file} 第 ${i + 2} 行欄位不足：${line}`)
    const get = (k) => parts[col[k]].trim()
    const a = get('aliases').split('|').map((s) => s.trim()).filter(Boolean)
    return { line: i + 2, get, a }
  })
}

const pokemon = readCsv('docs/pokemon-names.csv', ['no', 'zh_tw', 'en', 'aliases']).map(({ line, get, a }) => {
  const n = Number(get('no'))
  const zh = get('zh_tw')
  const en = get('en')
  if (!Number.isInteger(n) || !zh || !en) throw new Error(`pokemon-names.csv 第 ${line} 行資料不完整`)
  return a.length ? { n, zh, en, a } : { n, zh, en }
})

const cards = readCsv('docs/card-names.csv', ['en', 'zh_tw', 'aliases', 'source']).map(({ line, get, a }) => {
  const zh = get('zh_tw')
  const [en, ...e] = get('en').split('|').map((s) => s.trim()).filter(Boolean)
  if (!zh || !en || !get('source')) throw new Error(`card-names.csv 第 ${line} 行資料不完整`)
  return { zh, en, ...(e.length ? { e } : {}), ...(a.length ? { a } : {}) }
})

// 驗證（兩份一起）：正式名不重複、英文名（含卡名的其他英文名）不重複、別名不與其他正式名衝突
const label = (r) => (r.n === undefined ? `卡名「${r.en}」` : `#${r.n}`)
const zhOwner = new Map()
const enOwner = new Map()
for (const r of [...pokemon, ...cards]) {
  if (zhOwner.has(r.zh)) throw new Error(`中文正式名重複：${r.zh}（${label(zhOwner.get(r.zh))} 與 ${label(r)}）`)
  zhOwner.set(r.zh, r)
  for (const name of [r.en, ...(r.e ?? [])]) {
    const en = name.toLowerCase()
    if (enOwner.has(en)) throw new Error(`英文名重複：${name}（${label(enOwner.get(en))} 與 ${label(r)}）`)
    enOwner.set(en, r)
  }
}
let aliasCount = 0
for (const r of [...pokemon, ...cards]) {
  for (const alias of r.a ?? []) {
    aliasCount++
    const hit = zhOwner.get(alias)
    if (hit && hit !== r) throw new Error(`別名「${alias}」（${label(r)}）與 ${label(hit)} 的正式名衝突`)
  }
}

for (const [rows, file] of [[pokemon, 'src/config/pokemonNames.json'], [cards, 'src/config/cardNames.json']]) {
  const json = JSON.stringify(rows)
  writeFileSync(resolve(root, file), json)
  console.log(`已產生 ${file}：${rows.length} 筆，${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`)
}
console.log(`別名共 ${aliasCount} 個`)
