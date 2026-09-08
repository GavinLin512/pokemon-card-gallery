import { sections } from './sections.js'

// 座標沿既有低空路徑單調遞增；地名分界與三地場景一致。
export function locationAt(progress) {
  return progress < .27 ? '真新鎮' : progress < .8 ? '一號道路' : '常磐市'
}
export const journeyStops = sections.map((section, index) => {
  const progress = .04 + .92 * index / (sections.length - 1)
  return { ...section, index, progress, location: locationAt(progress), travel: .6, dwell: 1.2 }
})
