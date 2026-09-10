// 視窗與裝置旗標（PLAN §8.4、§10）：是否手機、reduced-motion、低效能、WebGL 可用。

const mobileQuery = matchMedia('(max-width: 899px)')
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)')

let isMobile = $state(mobileQuery.matches)
let reducedMotion = $state(motionQuery.matches)

mobileQuery.addEventListener('change', (e) => (isMobile = e.matches))
motionQuery.addEventListener('change', (e) => (reducedMotion = e.matches))

/**
 * 手機閃卡測試旗標，由網址 ?cardtest= 讀入（逗號分隔）：
 *   flat  關閉閃卡各層 will-change，減少合成層
 *   scale 放大倍率上限 1.25
 *   iso   card__rotator 加 isolation 與 overflow:hidden（會犧牲翻面背面）
 *   nogl  卡牌放大時暫停三維場景
 *   noz   拿掉正面各閃卡層的 translateZ 與 preserve-3d，只保留翻面（針對 Blink 壓平 3D 圖層的閃爍）
 *   all   同時開啟 flat、scale、nogl
 * 例：/?cardtest=all 或 /?cardtest=flat,nogl#kanto-starters
 */
function parseCardTest() {
  try {
    const raw = new URLSearchParams(location.search).get('cardtest')
    if (!raw) return new Set()
    const flags = new Set(raw.split(',').map(f => f.trim().toLowerCase()).filter(Boolean))
    if (flags.has('all') || flags.has('1') || flags.has('on')) ['flat', 'scale', 'nogl'].forEach(f => flags.add(f))
    return flags
  } catch {
    return new Set()
  }
}
const cardTest = parseCardTest()

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
  },
  /** ?cardtest= 旗標集合，空集合代表未啟用 */
  get cardTest() {
    return cardTest
  }
}
