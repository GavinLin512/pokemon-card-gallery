// 目前時段（PLAN §9.3）：自動依本地時間每分鐘更新；手動覆寫寫入 localStorage['dayCycle.override']。

import { periodByKey, periodForHour, periodKeys } from '../config/dayCycle.js'

const STORAGE_KEY = 'dayCycle.override'

function readOverride() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return periodKeys.includes(v) ? v : null
  } catch {
    return null
  }
}

function nowKey() {
  const d = new Date()
  return periodForHour(d.getHours() + d.getMinutes() / 60).key
}

let autoKey = $state(nowKey())
let override = $state(readOverride())
const currentKey = $derived(override ?? autoKey)

function tick() {
  autoKey = nowKey()
}
setInterval(tick, 60_000)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) tick()
})

function apply() {
  document.documentElement.dataset.daycycle = currentKey
}
$effect.root(() => {
  $effect(apply)
})

export const dayCycle = {
  get key() {
    return currentKey
  },
  get period() {
    return periodByKey(currentKey)
  },
  get isAuto() {
    return override === null
  },
  get label() {
    return periodByKey(currentKey).label
  },
  /** 自動 → 清晨 → 白天 → 黃昏 → 夜晚 → 自動，各模式皆可獨立選取。 */
  cycle() {
    const idx = periodKeys.indexOf(override)
    override = periodKeys[idx + 1] ?? null
    try {
      if (override) localStorage.setItem(STORAGE_KEY, override)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* 私密模式等情況忽略 */
    }
  },
  set(key) {
    override = periodKeys.includes(key) ? key : null
  }
}
