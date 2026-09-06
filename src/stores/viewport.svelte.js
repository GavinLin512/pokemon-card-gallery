// 視窗與裝置旗標（PLAN §8.4、§10）：是否手機、reduced-motion、低效能、WebGL 可用。

const mobileQuery = matchMedia('(max-width: 899px)')
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)')

let isMobile = $state(mobileQuery.matches)
let reducedMotion = $state(motionQuery.matches)

mobileQuery.addEventListener('change', (e) => (isMobile = e.matches))
motionQuery.addEventListener('change', (e) => (reducedMotion = e.matches))

let webgl
function detectWebGL() {
  if (webgl !== undefined) return webgl
  try {
    const c = document.createElement('canvas')
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    webgl = false
  }
  return webgl
}

export const viewport = {
  get isMobile() {
    return isMobile
  },
  get reducedMotion() {
    return reducedMotion
  },
  /** 手機或記憶體少於 4GB：貼圖上限 1024、雲與粒子減半 */
  get lowPower() {
    return isMobile || (navigator.deviceMemory ?? 8) < 4
  },
  get webgl() {
    return detectWebGL()
  }
}
