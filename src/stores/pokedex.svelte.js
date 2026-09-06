// 我的圖鑑（PLAN §9.1）：訪客在此瀏覽器捕捉的卡牌，只存本機 localStorage['pokedex.v1']。
// 每筆 { id, name, set, number, sectionId?, capturedAt }

const STORAGE_KEY = 'pokedex.v1'

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((e) => e && e.id) : []
  } catch {
    return []
  }
}

let entries = $state(load())
let open = $state(false)
/** 每次新增遞增，TopBar 計數據此彈跳一次 */
let bump = $state(0)

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    /* 私密模式等情況忽略 */
  }
}

export const pokedex = {
  get entries() {
    return entries
  },
  get count() {
    return entries.length
  },
  get open() {
    return open
  },
  set open(v) {
    open = !!v
  },
  get bump() {
    return bump
  },
  has(id) {
    return entries.some((e) => e.id === id)
  },
  add(card, sectionId) {
    if (!card?.id || this.has(card.id)) return false
    const entry = {
      id: card.id,
      name: card.name,
      set: card.set,
      number: card.number,
      capturedAt: new Date().toISOString()
    }
    if (sectionId) entry.sectionId = sectionId
    entries = [...entries, entry]
    bump += 1
    persist()
    return true
  },
  remove(id) {
    const next = entries.filter((e) => e.id !== id)
    if (next.length === entries.length) return false
    entries = next
    persist()
    return true
  },
  toggle() {
    open = !open
  }
}
