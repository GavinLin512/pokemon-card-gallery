import { journey } from './journey.svelte.js'

// 捲動方向提示（PLAN §9.10）：停靠站上閒置 3 秒才顯示，任何操作立刻隱藏；
// 訪客這次瀏覽自己捲動前進過一次就算學會，之後不再顯示（不寫入 localStorage）。

const IDLE_MS = 3000
/** 捲動輸入之後這段時間內 scrollY 變大，才算訪客自己往前捲（排除跳站、視窗縮放造成的程式捲動）。 */
const INPUT_WINDOW_MS = 800
const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'End', 'Home'])
const ACTIVITY = ['pointerdown', 'pointermove', 'touchstart', 'touchmove', 'wheel', 'keydown', 'resize']

let idle = $state(false)
let learned = $state(false)
let timer = 0
let lastY = scrollY
let lastScrollInput = -Infinity

function restart() {
  idle = false
  clearTimeout(timer)
  timer = setTimeout(() => (idle = true), IDLE_MS)
}

function onActivity(event) {
  if (event.type === 'wheel' || event.type === 'touchmove' || (event.type === 'keydown' && SCROLL_KEYS.has(event.key))) {
    lastScrollInput = performance.now()
  }
  restart()
}

function onScroll() {
  if (scrollY > lastY + 1 && !journey.jumping && performance.now() - lastScrollInput < INPUT_WINDOW_MS) {
    learned = true
    stop()
  } else restart()
  lastY = scrollY
}

function stop() {
  clearTimeout(timer)
  idle = false
  for (const type of ACTIVITY) removeEventListener(type, onActivity, true)
  removeEventListener('scroll', onScroll)
}

for (const type of ACTIVITY) addEventListener(type, onActivity, { capture: true, passive: true })
addEventListener('scroll', onScroll, { passive: true })
restart()

export const directionHint = {
  /** 停靠站、卡牌未放大、沒有開面板或跳站、開場已結束，且閒置滿 3 秒 */
  get visible() {
    return idle && !learned && journey.entered && !journey.opening && !journey.paused && !!journey.current.stop
  },
  /** 最後一站的停留區一路延伸到旅程終點，往前捲不會再到新的站，只提示後退 */
  get atEnd() {
    return journey.current.stop?.id === journey.stops.at(-1)?.id
  }
}
