// 卡牌登錄表與目前放大的卡牌（PLAN §9.1、§9.2）。
// cards.json 與搜尋結果都登錄到這裡；放大時由凍結區的 gtag select_item 事件取得 id，再查表補齊資料。

const registry = new Map()
let sectionMap = new Map()

/** 最近一次放大的卡牌（來自 gtag select_item） */
let selected = $state(null)

window.addEventListener('gtag', (e) => {
  const [kind, name, params] = e.detail ?? []
  if (kind !== 'event' || name !== 'select_item') return
  const item = params?.items?.[0]
  if (!item) return
  selected = {
    id: item.item_id,
    name: item.item_name,
    set: item.item_category,
    supertype: item.item_category2,
    subtypes: item.item_category3,
    rarity: item.item_category4
  }
})

export const cards = {
  register(list) {
    for (const c of list ?? []) if (c?.id) registry.set(c.id, c)
  },
  setSectionMap(map) {
    sectionMap = map
  },
  get(id) {
    return registry.get(id)
  },
  sectionOf(id) {
    return sectionMap.get(id)
  },
  /** 由 activeCard 的 DOM 元素解析出卡牌資料；找不到登錄時退回 gtag 提供的基本欄位。 */
  fromElement(el) {
    if (!el) return null
    const domId = el.dataset.set && el.dataset.number ? `${el.dataset.set}-${el.dataset.number}` : null
    const id = selected?.id ?? domId
    if (!id) return null
    const known = registry.get(id) ?? (domId ? registry.get(domId) : undefined)
    if (known) return known
    return selected && selected.id === id
      ? { ...selected, number: el.dataset.number, types: typesFromClass(el) }
      : null
  }
}

const TYPE_NAMES = ['Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Fairy', 'Dragon', 'Colorless']
function typesFromClass(el) {
  return TYPE_NAMES.filter((t) => el.classList.contains(t))
}
