import { journeyStops } from '../config/journeyStops.js'
import { createTimeline, resolvePosition } from '../journey/timeline.js'

export const timeline = createTimeline(journeyStops)
let current = $state.raw(resolvePosition(timeline, 0))
let panel = $state(null)
let expanded = $state(false)
let opening = $state(true)
let sceneReady = $state(false)
let jumping = $state(false)
let visited = $state({})
let selections = $state({})

export const journey = {
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
    current = resolvePosition(timeline, position, direct ? null : current.stop?.id)
  }
}
