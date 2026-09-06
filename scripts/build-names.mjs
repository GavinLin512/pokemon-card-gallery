// docs/pokemon-names.csv → src/config/pokemonNames.json
// CSV 欄位：no, zh_tw, en, aliases（別名以 | 分隔）。UTF-8 with BOM，CRLF 或 LF 皆可。
// 輸出精簡格式 [{ n, zh, en, a: [...] }]，供中文搜尋以動態 import 載入。
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'docs/pokemon-names.csv')
const out = resolve(root, 'src/config/pokemonNames.json')

const text = readFileSync(src, 'utf8').replace(/^﻿/, '')
const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
const header = lines.shift().split(',')
const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]))
for (const k of ['no', 'zh_tw', 'en', 'aliases']) {
  if (!(k in col)) throw new Error(`CSV 缺少欄位 ${k}`)
}

// 英文名可能含逗號以外的符號（'、.、空白），CSV 本身不含引號欄位，直接以逗號切四段即可。
const rows = lines.map((line, i) => {
  const parts = line.split(',')
  if (parts.length < 4) throw new Error(`第 ${i + 2} 行欄位不足：${line}`)
  const n = Number(parts[col.no])
  const zh = parts[col.zh_tw].trim()
  const en = parts[col.en].trim()
  const a = parts[col.aliases].split('|').map((s) => s.trim()).filter(Boolean)
  if (!Number.isInteger(n) || !zh || !en) throw new Error(`第 ${i + 2} 行資料不完整：${line}`)
  return a.length ? { n, zh, en, a } : { n, zh, en }
})

// 驗證：正式名不重複、別名不與其他正式名衝突
const zhSet = new Map()
for (const r of rows) {
  if (zhSet.has(r.zh)) throw new Error(`中文正式名重複：${r.zh}（#${zhSet.get(r.zh)} 與 #${r.n}）`)
  zhSet.set(r.zh, r.n)
}
let aliasCount = 0
for (const r of rows) {
  for (const alias of r.a ?? []) {
    aliasCount++
    const hit = zhSet.get(alias)
    if (hit !== undefined && hit !== r.n) {
      throw new Error(`別名「${alias}」（#${r.n}）與 #${hit} 的正式名衝突`)
    }
  }
}

writeFileSync(out, JSON.stringify(rows))
const bytes = Buffer.byteLength(JSON.stringify(rows))
console.log(`已產生 ${out}\n${rows.length} 筆，${aliasCount} 個別名，${(bytes / 1024).toFixed(1)} KB`)
