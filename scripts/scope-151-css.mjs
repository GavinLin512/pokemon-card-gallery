// 由 simeydotme/pokemon-cards-151 的 public/css 產生 public/css151/cards-151.css（PLAN §15.2、ADR-0005）。
// 用法：node scripts/scope-151-css.mjs <151 專案的 public/css 路徑>
// 規則：每條選擇器前綴 .era-151；:root 改為 .era-151；@keyframes 內不動；
//       [data-rarity="rare holo"] 改為 [data-rarity="rare holo 151"]；/img/glitter.webp（上游不存在）改指 /img/glitter.png。
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SCOPE = '.era-151'
// 與 151 專案 index.html 的載入順序一致
const FILES = ['cards/base.css', 'cards.css', 'cards/basic.css', 'cards/reverse-holo.css', 'cards/regular-holo.css', 'cards/ex-regular.css', 'cards/ex-full-art.css', 'cards/illustration-rare.css', 'cards/poke-ball-holo.css', 'cards/ex-special-illustration-rare.css', 'cards/hyper-rare.css']
const URL_REWRITES = [['/img/glitter.webp', '/img/glitter.png']]

const source = process.argv[2]
if (!source) { console.error('請指定 151 專案的 public/css 路徑'); process.exit(1) }
const outFile = resolve('public/css151/cards-151.css')

export function scopeSelector(selector) {
  return selector.split(',').map(part => {
    const s = part.trim()
    if (!s) return s
    const renamed = s.replaceAll('[data-rarity="rare holo"]', '[data-rarity="rare holo 151"]')
    if (renamed.startsWith(':root')) return SCOPE + renamed.slice(5)
    return `${SCOPE} ${renamed}`
  }).join(', ')
}

/** 逐字掃描：追蹤註解、字串與區塊層級，只改寫規則的選擇器。 */
export function scopeCss(css) {
  let out = ''
  let i = 0
  const stack = [] // 每層記錄是否位於 @keyframes 內
  let pending = '' // 尚未寫出的選擇器或 at-rule 前導文字
  const inKeyframes = () => stack.some(Boolean)
  while (i < css.length) {
    const ch = css[i]
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2)
      const j = end === -1 ? css.length : end + 2
      pending += css.slice(i, j); i = j; continue
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1
      while (j < css.length && css[j] !== ch) { if (css[j] === '\\') j++; j++ }
      pending += css.slice(i, j + 1); i = j + 1; continue
    }
    if (ch === '{') {
      const head = pending
      const trimmed = head.trim()
      const isAt = trimmed.startsWith('@')
      if (isAt || inKeyframes()) {
        out += head + '{'
        stack.push(isAt && /^@(-webkit-)?keyframes\b/.test(trimmed))
      } else {
        const lead = head.match(/^\s*/)[0]
        const comment = head.slice(lead.length).match(/^(\/\*[\s\S]*?\*\/\s*)*/)[0]
        const selector = head.slice(lead.length + comment.length)
        out += lead + comment + scopeSelector(selector) + ' {'
        stack.push(false)
      }
      pending = ''; i++; continue
    }
    if (ch === '}') { out += pending + '}'; pending = ''; stack.pop(); i++; continue }
    if (ch === ';') { out += pending + ';'; pending = ''; i++; continue }
    pending += ch; i++
  }
  out += pending
  for (const [from, to] of URL_REWRITES) out = out.replaceAll(from, to)
  return out
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const parts = [`/* 產生檔，請勿手改：node scripts/scope-151-css.mjs <151 專案的 public/css>\n   來源 simeydotme/pokemon-cards-151 public/css，規則見 docs/PLAN.md §15.2 */\n`]
  for (const file of FILES) {
    const path = join(source, file)
    if (!existsSync(path)) { console.error(`找不到 ${path}`); process.exit(1) }
    parts.push(`\n/* ===== ${file} ===== */\n` + scopeCss(readFileSync(path, 'utf8')).trim() + '\n')
  }
  writeFileSync(outFile, parts.join(''))
  console.log(`已寫入 ${outFile}`)
}
