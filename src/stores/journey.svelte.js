import { SERIES, findSeries, readSeriesPreference, writeSeriesPreference } from '../config/series.js'
import { stopsFor } from '../config/journeyStops.js'
import { createTimeline, resolvePosition } from '../journey/timeline.js'

/** 每個系列各一條時間軸（PLAN §15），切換系列時整條旅程換掉，場景路徑共用。 */
export const timelines = new Map(SERIES.map(s => [s.id, createTimeline(stopsFor(s.sections))]))
let series = $state(readSeriesPreference())
let current = $state.raw(resolvePosition(timelines.get(series), 0))
let panel = $state(null)
let expanded = $state(false)
let opening = $state(true)
let sceneReady = $state(false)
let jumping = $state(false)
let visited = $state({})
let selections = $state({})

export const journey = {
  get series() { return series },
  get seriesInfo() { return findSeries(series) },
  get timeline() { return timelines.get(series) },
  get stops() { return timelines.get(series).segments },
  get sections() { return findSeries(series).sections },
  /** 切換系列並回到起點；未知或相同的系列回傳 false。 */
  setSeries(id) {
    if (!findSeries(id) || id === series) return false
    series = id
    writeSeriesPreference(id)
    current = resolvePosition(timelines.get(id), 0)
    return true
  },
  get current() { return current },
  get panel() { return panel },
  set panel(value) { panel = value },
  get expanded() { return expanded },
  set expanded(value) { expanded = value },
  get opening() { return opening },
  set opening(value) { opening = value },
  get sceneReady() { return sceneReady },
  set sceneReady(value) { sceneReady = value },
  get jumping() { return jumping },
  set jumping(value) { jumping = value },
  get paused() { return !!panel || expanded || jumping },
  get visited() { return visited },
  visit(id) { visited = { ...visited, [id]: true } },
  selection(id) { return selections[id] ?? 0 },
  select(id, index) { selections = { ...selections, [id]: index } },
  move(position, direct = false) {
    current = resolvePosition(timelines.get(series), position, direct ? null : current.stop?.id)
  }
}
