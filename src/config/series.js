// 卡牌系列（PLAN §15）：每個系列有自己的展示區與停靠點，同一條真新鎮到常磐市的路徑共用。
import { sections as swshSections } from './sections.js'
import { sections151 } from './sections151.js'

export const SERIES = [
  { id: 'swsh', name: '劍盾', full: '劍盾系列', intro: '從真新鎮出發，沿著一號道路前往常磐市。', sections: swshSections },
  { id: '151', name: '151', full: '151 系列', intro: '帶著 151 系列的卡牌，再走一次真新鎮到常磐市的路。', sections: sections151 }
]
export const DEFAULT_SERIES = 'swsh'
export const allSections = SERIES.flatMap(s => s.sections)

export function findSeries(id) {
  return SERIES.find(s => s.id === id) ?? null
}

/** 展示區屬於哪個系列；不存在回傳 null。 */
export function seriesOfSection(sectionId) {
  return SERIES.find(s => s.sections.some(section => section.id === sectionId))?.id ?? null
}

const STORAGE_KEY = 'pokemon-card-gallery:series'

/** 優先網址 ?series=，其次上次選擇，最後預設劍盾。瀏覽器以外的環境（測試）直接回預設。 */
export function readSeriesPreference() {
  try {
    const query = new URLSearchParams(location.search).get('series')
    if (findSeries(query)) return query
    const saved = localStorage.getItem(STORAGE_KEY)
    if (findSeries(saved)) return saved
  } catch { /* 無 location 或 localStorage */ }
  return DEFAULT_SERIES
}

export function writeSeriesPreference(id) {
  try { localStorage.setItem(STORAGE_KEY, id) } catch { /* 私密模式等 */ }
}
