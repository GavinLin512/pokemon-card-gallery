// 目前時段（PLAN §9.3）：自動依本地時間每分鐘更新；手動覆寫寫入 localStorage['dayCycle.override']。

import { periods, periodByKey, periodForHour, periodKeys } from '../config/dayCycle.js'

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
  /** 依序切換四段，繞回自動時段時回到自動。 */
  cycle() {
    const order = periods.map((p) => p.key)
    const idx = order.indexOf(currentKey)
    const next = order[(idx + 1) % order.length]
    override = next === autoKey ? null : next
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
