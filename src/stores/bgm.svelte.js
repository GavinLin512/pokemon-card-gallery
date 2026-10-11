// 背景音樂（PLAN §9.8）：預設關閉；開啟後跟隨目前時段播放對應曲子，切換時段時交叉淡化。
// 每首用 A/B 兩個 <audio> 輪流播放，曲末前交叉淡化到另一個從頭播放，蓋掉 MP3 的循環接縫；
// 音量由 Web Audio GainNode 控制（iOS 的 HTMLMediaElement.volume 唯讀）。
// 開關寫入 localStorage['bgm.enabled']；瀏覽器禁止無手勢自動播放，重新載入後等第一次點擊或按鍵才續播。

import { dayCycle } from './dayCycle.svelte.js'
import { CROSSFADE_MS, LOOP_FADE_MS, STOP_FADE_MS, VOLUME, trackFor } from '../config/bgm.js'

const STORAGE_KEY = 'bgm.enabled'

function readEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeEnabled(on) {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* 私密模式等情況忽略 */
  }
}

const persisted = readEnabled()
let enabled = $state(persisted)
/** 真的在播（開啟且已有手勢），跑馬燈依此顯示。 */
let playing = $state(false)
let failed = $state(false)

/** @type {AudioContext | null} 第一次開啟時才建立 */
let ctx = null
/** key → { key, voices: [{ el, gain }], active, timer, gen } */
const players = new Map()
/** 正在播放的 player */
let current = null

function ramp(gain, target, ms) {
  const now = ctx.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(gain.gain.value, now)
  gain.gain.linearRampToValueAtTime(target, now + ms / 1000)
}

function fail() {
  failed = true
  enabled = false
  writeEnabled(false)
  stop(0)
}

function voiceFor(src) {
  const el = new Audio(src)
  el.preload = 'auto'
  const gain = ctx.createGain()
  gain.gain.value = 0
  ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination)
  el.addEventListener('error', fail)
  return { el, gain }
}

function playerFor(key) {
  let p = players.get(key)
  if (!p) {
    const { src } = trackFor(key)
    p = { key, voices: [voiceFor(src), voiceFor(src)], active: 0, timer: 0, gen: 0 }
    // 計時器被背景分頁節流而遲到時，以 ended 事件補位。
    for (const v of p.voices) {
      v.el.addEventListener('ended', () => {
        if (current === p && p.voices[p.active] === v) handoff(p)
      })
    }
    players.set(key, p)
  }
  return p
}

function play(voice) {
  voice.el.play().catch((e) => {
    // NotAllowedError 是無手勢的自動播放限制，等第一次點擊再試；其他才算失敗。
    if (e?.name !== 'NotAllowedError') fail()
  })
}

/**
 * 在曲末前排定交叉淡化。每次 timeupdate（約每 250 毫秒）依實際播放位置重新校正計時器，
 * 計時器到期時再確認一次剩餘時間：播放起步慢或緩衝停頓都不會提前接縫。gen 讓過期的排程失效。
 */
function schedule(p) {
  clearTimeout(p.timer)
  const gen = ++p.gen
  const { el } = p.voices[p.active]
  const arm = () => {
    if (p.gen !== gen || current !== p) {
      el.ontimeupdate = null
      return
    }
    const left = (el.duration - el.currentTime) * 1000 - LOOP_FADE_MS
    if (!Number.isFinite(left)) return
    clearTimeout(p.timer)
    if (left <= 0) {
      el.ontimeupdate = null
      handoff(p)
    } else {
      p.timer = setTimeout(arm, left)
    }
  }
  el.ontimeupdate = arm
  arm()
}

/** 曲末前交叉淡化到另一個 <audio>，從頭再播。 */
function handoff(p) {
  const from = p.voices[p.active]
  p.active ^= 1
  const to = p.voices[p.active]
  to.el.currentTime = 0
  ramp(to.gain, VOLUME, LOOP_FADE_MS)
  ramp(from.gain, 0, LOOP_FADE_MS)
  play(to)
  setTimeout(() => {
    if (p.voices[p.active] !== from) from.el.pause()
  }, LOOP_FADE_MS + 50)
  schedule(p)
}

function silence(p, ms) {
  clearTimeout(p.timer)
  p.gen++
  for (const v of p.voices) ramp(v.gain, 0, ms)
  setTimeout(() => {
    if (current !== p) for (const v of p.voices) v.el.pause()
  }, ms + 50)
}

function switchTo(key) {
  if (current?.key === key) return
  const prev = current
  const p = playerFor(key)
  current = p
  playing = true
  if (prev) silence(prev, CROSSFADE_MS)
  const v = p.voices[p.active]
  v.el.currentTime = 0
  ramp(v.gain, VOLUME, CROSSFADE_MS)
  play(v)
  schedule(p)
}

function stop(ms = STOP_FADE_MS) {
  const p = current
  current = null
  playing = false
  if (p) silence(p, ms)
}

function ensureContext() {
  if (!ctx) {
    const AC = window.AudioContext ?? window.webkitAudioContext
    if (!AC) {
      fail()
      return false
    }
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return true
}

function start() {
  if (ensureContext()) switchTo(dayCycle.key)
}

// 分頁隱藏時暫停，回到前景續播並重新排定接縫。
document.addEventListener('visibilitychange', () => {
  const p = current
  if (!p) return
  if (document.hidden) {
    clearTimeout(p.timer)
    p.gen++
    for (const v of p.voices) v.el.pause()
  } else {
    play(p.voices[p.active])
    schedule(p)
  }
})

// 上次開著：等第一次點擊或按鍵（有手勢）再開始。點「音樂」關閉時按鈕先處理，這裡看到 enabled 已是 false。
if (persisted) {
  const resume = () => {
    if (enabled && !current) start()
  }
  document.addEventListener('click', resume, { once: true })
  document.addEventListener('keydown', resume, { once: true })
}

$effect.root(() => {
  $effect(() => {
    const key = dayCycle.key
    if (enabled && current) switchTo(key)
  })
})

export const bgm = {
  get enabled() {
    return enabled
  },
  get playing() {
    return playing
  },
  get failed() {
    return failed
  },
  /** 目前時段的曲名，供無障礙標籤用。 */
  get title() {
    return trackFor(dayCycle.key).title
  },
  toggle() {
    if (failed) return
    enabled = !enabled
    writeEnabled(enabled)
    if (enabled) start()
    else stop()
  }
}
