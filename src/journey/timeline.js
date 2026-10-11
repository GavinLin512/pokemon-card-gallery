const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

/** 距離單位為可用視窗高度，與卡圖、對話或面板的 DOM 高度無關。 */
export function createTimeline(stops) {
  let cursor = 0
  const segments = stops.map(stop => {
    const start = cursor
    const arrival = start + stop.travel
    cursor = arrival + stop.dwell
    return { ...stop, start, arrival, end: cursor, landing: arrival + stop.dwell / 2 }
  })
  return { segments, length: cursor }
}

/**
 * 鏡頭進度隨捲動距離連續變化：相鄰兩站落點之間以 smoothstep 銜接，落點處恰為該站進度且斜率為零。
 * 一離開落點就緩緩起步、移動區間最快、接近下一站落點時減速停住；停留區不再鎖住鏡頭，與進度條同步。
 */
function progressAt(segments, position) {
  const next = segments.find(s => position < s.landing)
  if (!next) return segments.at(-1).progress
  const previous = segments[next.index - 1]
  const from = previous?.landing ?? 0
  const base = previous?.progress ?? 0
  const t = clamp((position - from) / (next.landing - from), 0, 1)
  return base + (next.progress - base) * t * t * (3 - 2 * t)
}

export function resolvePosition(timeline, distance, previousStop = null) {
  const { segments, length } = timeline
  const position = clamp(Number.isFinite(distance) ? distance : 0, 0, length)
  if (!segments.length) return { position, progress: 0, stop: null, nearby: null, phase: 'travel', local: 0 }
  const progress = progressAt(segments, position)
  // 離站保留 0.025 視窗的死區；輕微回彈不重播遭遇。
  const previous = segments.find(s => s.id === previousStop)
  if (previous && position >= previous.arrival - .025 && position <= previous.end + .025) {
    return { position, progress, stop: previous, nearby: previous, phase: 'dwell', local: clamp((position - previous.arrival) / previous.dwell, 0, 1) }
  }
  const current = segments.find(s => position < s.end) ?? segments.at(-1)
  const local = (position - current.arrival) / current.dwell
  if (position >= current.arrival) {
    return { position, progress, stop: current, nearby: current, phase: local < .1 ? 'arrival' : local > .9 && current !== segments.at(-1) ? 'departure' : 'dwell', local }
  }
  return { position, progress, stop: null, nearby: current, phase: 'travel', local: clamp((position - current.start) / current.travel, 0, 1) }
}

export function landingFor(timeline, id) {
  return timeline.segments.find(s => s.id === id)?.landing ?? null
}

export function restorePosition(timeline, state) {
  return clamp(Number.isFinite(state?.journeyPosition) ? state.journeyPosition : 0, 0, timeline.length)
}

/** 約 90ms 時常的平滑跟隨；大於一站的跳動直接抵達，不排隊經過中途站。 */
export function advancePosition(current, target, dt, immediate = false) {
  const delta = target - current
  if (immediate || Math.abs(delta) > 1.8 || Math.abs(delta) < .0005) return target
  return current + delta * (1 - Math.exp(-Math.max(0, Math.min(dt, .05)) / .09))
}
