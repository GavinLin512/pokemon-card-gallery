import { sections } from './sections.js'

// 座標沿既有低空路徑單調遞增；地名分界與三地場景一致。
export function locationAt(progress) {
  return progress < .27 ? '真新鎮' : progress < .8 ? '一號道路' : '常磐市'
}
/** 任一系列的展示區清單 → 停靠點；進度沿同一條路徑平均分配。 */
export function stopsFor(list) {
  return list.map((section, index) => {
    const progress = .04 + .92 * index / (list.length - 1)
    return { ...section, index, progress, location: locationAt(progress), travel: .6, dwell: 1.2 }
  })
}
/** 劍盾系列的停靠點（測試與相容用；執行期由 stores/journey 依系列取得） */
export const journeyStops = stopsFor(sections)
