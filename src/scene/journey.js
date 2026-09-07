import { CatmullRomCurve3, Vector3 } from 'three'

// 由南向北飛行：真新鎮北口、一號道路的彎道、常磐市南入口。
const flight = new CatmullRomCurve3([
  new Vector3(0, 7.5, 27),
  new Vector3(0, 7, 7),
  new Vector3(0, 6.5, -18),
  new Vector3(5, 6, -38),
  new Vector3(-5, 6.4, -60),
  new Vector3(4, 6.3, -83),
  new Vector3(0, 7, -109),
  new Vector3(0, 8, -126),
  new Vector3(1, 8, -143)
], false, 'centripetal')

/** 同一條路徑可往返；前視距離維持低空平視，沒有俯衝或鏡頭翻轉。 */
export function sampleFlight(progress, position = new Vector3(), target = new Vector3()) {
  const p = Math.max(0, Math.min(1, progress))
  flight.getPointAt(p, position)
  flight.getPointAt(Math.min(1, p + 0.12), target)
  target.z = position.z - 24
  target.y = position.y - 2.2
  return { position, target }
}

/** 用展示區內的相對位置決定進度，避免遠處卡牌延遲掛載改變整頁高度時鏡頭跳動。 */
export function progressFromSections(scrollY, viewportHeight, documentHeight, sections) {
  if (!sections.length) return null // 搜尋中保留旅程位置
  const maxScroll = Math.max(0, documentHeight - viewportHeight)
  if (scrollY <= 0 || maxScroll === 0) return 0
  if (scrollY >= maxScroll - 2) return 1
  const line = scrollY + viewportHeight * 0.25
  const first = sections[0].top
  if (line < first) return Math.max(0, scrollY / Math.max(1, first - viewportHeight * 0.25)) / (sections.length + 1)
  for (let i = sections.length - 1; i >= 0; i--) {
    if (line < sections[i].top) continue
    const end = sections[i + 1]?.top ?? Math.max(sections[i].top + 1, maxScroll + viewportHeight * 0.25)
    const local = Math.max(0, Math.min(1, (line - sections[i].top) / Math.max(1, end - sections[i].top)))
    return Math.min(1, (i + 1 + local) / (sections.length + 1))
  }
  return 0
}
