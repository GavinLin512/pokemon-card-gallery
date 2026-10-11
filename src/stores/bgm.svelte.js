// 背景音樂（PLAN §9.8）：預設開啟；跟隨目前時段播放對應曲子，切換時段時交叉淡化。
// 每首用 A/B 兩個 <audio> 輪流播放，曲末前交叉淡化到另一個從頭播放，蓋掉 MP3 的循環接縫；
// 音量由 Web Audio GainNode 控制（iOS 的 HTMLMediaElement.volume 唯讀）。
// 開關寫入 localStorage['bgm.enabled']（1 開、0 關，沒設定視為開）。瀏覽器禁止無手勢自動播放，所以不在載入時硬播：
// 進站畫面（EntryGate）載入期間 preload() 先備好曲子，訪客按下「進入真新鎮」的點擊手勢裡再呼叫 enter() 開始播放。

import { dayCycle } from './dayCycle.svelte.js'
import { CROSSFADE_MS, LOOP_FADE_MS, STOP_FADE_MS, VOLUME, trackFor } from '../config/bgm.js'

const STORAGE_KEY = 'bgm.enabled'

/** 沒設定過（或 localStorage 不可用）視為開啟，只有訪客明確關過才是 0。 */
function readEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

function writeEnabled(on) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    /* 私密模式等情況忽略 */
  }
}

let enabled = $state(readEnabled())
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

/** 載入或播放失敗：這次瀏覽停用按鈕，但不覆寫偏好，下次載入仍依預設或訪客的設定再試。 */
function fail() {
  failed = true
  enabled = false
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

function play(voice, onBlocked) {
  voice.el.play().catch((e) => {
    // NotAllowedError 是無手勢的自動播放限制：回報呼叫端退回未播放狀態，等第一次手勢再試；其他才算失敗。
    if (e?.name === 'NotAllowedError') onBlocked?.()
    else fail()
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
  play(v, () => {
    // 被自動播放限制擋下：退回未播放（跑馬燈不出現），等第一次手勢再從頭開始。
    if (current !== p) return
    current = null
    playing = false
    silence(p, 0)
    armGesture()
  })
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
  return true
}

/** 在手勢內呼叫：沒有手勢時建立的 AudioContext 停在 suspended，這裡的 resume() 才會真的恢復。 */
function start() {
  if (!ensureContext()) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  switchTo(dayCycle.key)
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

let armed = false
/**
 * 備援：進站按鈕啟動後仍被自動播放限制擋下（play() 回報 NotAllowedError）時，等下一次點擊或按鍵再從頭開始；
 * 滾輪捲動不算手勢。點「音樂」關閉時按鈕先處理，這裡看到 enabled 已是 false。只監聽 click 與 keydown：
 * 觸控的 pointerdown 還沒取得播放許可，若在那時就試播會把 current 佔住，之後的 click 就不再重試。
 */
function armGesture() {
  if (armed) return
  armed = true
  const resume = () => {
    armed = false
    document.removeEventListener('click', resume)
    document.removeEventListener('keydown', resume)
    if (enabled && !current) start()
  }
  document.addEventListener('click', resume)
  document.addEventListener('keydown', resume)
}

/** 開關的共同路徑：寫入偏好並開始或停止播放；呼叫端須在手勢內（開始播放需要）。 */
function setEnabled(on) {
  enabled = on
  writeEnabled(on)
  if (on) start()
  else stop()
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
    setEnabled(!enabled)
  },
  /**
   * 進站畫面載入期間呼叫：先建立 AudioContext（維持 suspended）並開始下載目前時段的曲子，
   * 按下「進入真新鎮」後不必再等網路。靜音訪客不下載；沒有手勢時不會出聲。
   */
  preload() {
    if (!enabled || failed || !ensureContext()) return
    playerFor(dayCycle.key)
  },
  /**
   * 進站按鈕的點擊手勢內呼叫（須同步，iOS 才放行）：music 為 true 開啟並開始播放，false 靜音。
   * 與目前狀態相同就不動；兩種選擇都寫入偏好，與工具列的開關一致。
   */
  enter(music) {
    if (failed) return
    if (music === enabled && (!music || current)) return
    setEnabled(music)
  }
}
