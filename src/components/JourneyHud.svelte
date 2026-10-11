<script>
  import { dayCycle } from '../stores/dayCycle.svelte.js'
  import { bgm } from '../stores/bgm.svelte.js'
  import { CREDIT, TITLE_FADE_MS } from '../config/bgm.js'
  import { pokedex } from '../stores/pokedex.svelte.js'
  import { journey } from '../stores/journey.svelte.js'
  import Icon from './Icon.svelte'
  import { locationAt } from '../config/journeyStops.js'
  import { resetBaseOrientation } from '../lib/stores/orientation.js'
  let { openPanel, navigate } = $props()
  const needsTilt = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function' && navigator.maxTouchPoints > 0
  let tilt = $state('ask')
  // 換曲時跑馬燈文字先淡出，換成新曲名再淡入；連續換曲時只保留最後一首。
  let shownTitle = $state(bgm.title)
  let titleHidden = $state(false)
  $effect(() => {
    const next = bgm.title
    if (next === shownTitle) return
    titleHidden = true
    const timer = setTimeout(() => { shownTitle = next; titleHidden = false }, TITLE_FADE_MS)
    return () => clearTimeout(timer)
  })
  async function requestTilt() {
    try {
      tilt = await DeviceOrientationEvent.requestPermission()
      if (tilt === 'granted') resetBaseOrientation()
    } catch { tilt = 'denied' }
  }
</script>
{#if bgm.playing}
  <!-- 曲名跑馬燈：8 份相同內容並排，整條向左位移一份的寬度後無縫接續；曲名已在音樂按鈕的標籤裡，讀屏不重複唸。 -->
  <div class="now-playing" class:concealed={journey.expanded || !journey.entered} aria-hidden="true">
    <div class="ticker" class:hidden={titleHidden}>{#each Array(8) as _, i (i)}<span>♪ 正在播放：{shownTitle}　{CREDIT}</span>{/each}</div>
  </div>
{/if}
<header class="journey-hud" class:with-ticker={bgm.playing} inert={!!journey.panel || journey.expanded} class:concealed={journey.expanded || !journey.entered}>
  <button class="location-badge" onclick={() => navigate(null)} aria-label="回到旅程起點">
    <span class="pokeball-symbol" aria-hidden="true"></span>
    <!-- 停靠中顯示該站所在地；鏡頭在停留區內會緩緩移動，靠近三地分界的站不因此提早換地名。 -->
    <span><small>寶可夢卡牌展示館 · {journey.seriesInfo.full}</small><strong>{journey.current.stop?.location ?? locationAt(journey.current.progress)}</strong></span>
  </button>
  <nav class="hud-tools" aria-label="旅程工具">
    <button onclick={e => openPanel('search', e.currentTarget)} aria-label="搜尋卡牌" aria-expanded={journey.panel === 'search'}><Icon name="search" /><b>搜尋</b></button>
    <button onclick={e => openPanel('pokedex', e.currentTarget)} aria-label={`我的圖鑑，已捕捉 ${pokedex.count} 張`} aria-expanded={journey.panel === 'pokedex'}><span aria-hidden="true">▣</span><b>圖鑑</b><em>{pokedex.count}</em></button>
    <button onclick={() => dayCycle.cycle()} aria-label={`切換時段，目前${dayCycle.label}${dayCycle.isAuto ? '（自動）' : ''}`}>
      <svg class="day-cycle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        {#if dayCycle.isAuto}
          <path d="M20 7a9 9 0 0 0-15-1L3 9m0-5v5h5M4 17a9 9 0 0 0 15 1l2-3m0 5v-5h-5M12 7v5l3 2" />
        {:else if dayCycle.key === 'dawn'}
          <path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 9V2m-3 3 3-3 3 3M3 11l2 2m14 0 2-2M5 22h14" />
        {:else if dayCycle.key === 'day'}
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
        {:else if dayCycle.key === 'dusk'}
          <path d="M3 18h18M6 18a6 6 0 0 1 12 0M12 2v7m-3-3 3 3 3-3M3 11l2 2m14 0 2-2M5 22h14" />
        {:else if dayCycle.key === 'night'}
          <path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14ZM18 2v4m-2-2h4" />
        {/if}
      </svg>
      <b>{dayCycle.isAuto ? '自動' : dayCycle.label}</b>
    </button>
    <button onclick={() => bgm.toggle()} aria-pressed={bgm.enabled} disabled={bgm.failed} aria-label={bgm.failed ? '背景音樂無法播放' : bgm.enabled ? `關閉背景音樂，正在播放${bgm.title}` : '開啟背景音樂'}>
      <svg class="hud-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        {#if bgm.enabled}
          <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
        {:else}
          <path d="m16 9 6 6m0-6-6 6" />
        {/if}
      </svg>
      <b>{bgm.failed ? '無法播放' : bgm.enabled ? '音樂' : '靜音'}</b>
    </button>
    {#if needsTilt && tilt !== 'granted'}<button aria-label="開啟傾斜感應" disabled={tilt === 'denied'} onclick={requestTilt}><span aria-hidden="true">↔</span><b>{tilt === 'denied' ? '已停用' : '傾斜'}</b></button>{/if}
  </nav>
</header>
<footer class="journey-bar" inert={!!journey.panel || journey.expanded} class:concealed={journey.expanded || !journey.entered}>
  <div class="stop-indicator"><span class="stop-number">{String((journey.current.nearby?.index ?? 0) + 1).padStart(2, '0')}<small> / {journey.stops.length}</small></span><span><small>{journey.current.stop ? '目前停靠' : '下一個停靠點'}</small><strong>{journey.current.nearby?.name}</strong></span></div>
  <p class="scroll-hint">{journey.current.position >= journey.timeline.length - .1 ? '旅程終點 · 還有更多卡牌等你探索' : '繼續向下捲動，探索下一站'} <span aria-hidden="true">↓</span></p>
  <button class="map-button" onclick={e => openPanel('map', e.currentTarget)} aria-expanded={journey.panel === 'map'}><span aria-hidden="true">⚑</span> 旅程地圖</button>
  <div class="route-progress" style:width={`${journey.current.position / journey.timeline.length * 100}%`}></div>
</footer>
<style>
  .journey-hud { position: fixed; z-index: 35; top: calc(max(24px, env(safe-area-inset-top)) + var(--ticker-h, 0px)); left: 28px; right: 28px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; pointer-events: none; transition: top .3s ease-out; }
  .with-ticker { --ticker-h: 26px; }
  /* 底色與文字色由 app.css 的 --band-* 依時段提供，隨場景光照 1.2 秒漸變。 */
  .now-playing { position: fixed; z-index: 36; top: env(safe-area-inset-top, 0px); left: 0; right: 0; height: 22px; overflow: hidden; background: linear-gradient(90deg, var(--band-a), var(--band-b)); color: var(--band-ink); font: var(--text-min)/22px var(--font-display); letter-spacing: .08em; pointer-events: none; animation: drop-in .3s ease-out; transition: --band-a 1.2s, --band-b 1.2s, color 1.2s; }
  .ticker { display: flex; width: max-content; animation: ticker 14s linear infinite; transition: opacity .6s; }
  .ticker.hidden { opacity: 0; }
  .ticker span { padding: 0 2.5em; white-space: nowrap; }
  @keyframes ticker { to { transform: translateX(-12.5%); } }
  @keyframes drop-in { from { transform: translateY(-100%); } }
  button { pointer-events: auto; border: 2px solid var(--ink); border-radius: 12px; background: var(--paper); color: var(--ink); box-shadow: 0 4px 0 #263d3bd9; }
  .location-badge { display: flex; gap: 13px; align-items: center; padding: 10px 18px; text-align: left; }
  .location-badge small { display: block; font-size: var(--text-min); letter-spacing: .1em; color: var(--ink-soft); }
  strong { display: block; font: 1.5rem var(--font-display); }
  .hud-tools { display: flex; gap: 8px; }
  .hud-tools button { display: flex; align-items: center; gap: 8px; height: 48px; padding: 0 13px; }
  .hud-tools span { font-size: 1.5625rem; line-height: 1; } b { font: max(14px, .9375rem) var(--font-display); }
  .day-cycle-icon, .hud-icon { width: 24px; height: 24px; flex-shrink: 0; }
  em { font-size: var(--text-min); background: var(--red); color: white; border-radius: 5px; padding: 0 6px; font-style: normal; }
  .journey-bar { position: fixed; z-index: 35; left: 28px; right: 28px; bottom: max(20px, env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 20px; padding: 13px 16px; background: var(--paper); border: 2px solid var(--ink); border-radius: 14px; color: var(--ink); box-shadow: 0 4px 0 #263d3b; overflow: hidden; }
  .stop-indicator { display: flex; gap: 15px; align-items: center; flex: 1; }
  .stop-number { font: 1.875rem var(--font-display); color: var(--red); border-right: 1px solid #263d3b33; padding-right: 15px; white-space: nowrap; }
  .stop-number small { font-size: var(--text-min); color: var(--ink-soft); }
  .stop-indicator > span > small { font-size: var(--text-min); color: var(--ink-soft); letter-spacing: .1em; }
  .stop-indicator strong { font-size: 1.125rem; }
  .scroll-hint { font-size: var(--text-min); color: var(--ink-soft); }
  .scroll-hint span { margin-left: 16px; }
  .map-button { box-shadow: none; background: var(--red); color: #fffaf0; border-color: var(--ink); padding: 0 18px; font-family: var(--font-display); }
  .route-progress { position: absolute; height: 3px; background: var(--red); bottom: 0; left: 0; }
  .concealed { visibility: hidden; }
  @media(max-width:899px) {
    .journey-hud { top: calc(max(12px, env(safe-area-inset-top)) + var(--ticker-h, 0px)); left: 12px; right: 12px; gap: 6px; }
    .with-ticker { --ticker-h: 18px; }
    .location-badge { padding: 6px 9px; gap: 8px; }
    .location-badge small { display: none; } .location-badge strong { font-size: 1.125rem; } .location-badge :global(.pokeball-symbol) { width: 24px; height: 24px; }
    .hud-tools { gap: 5px; } .hud-tools button { height: 44px; padding: 0 9px; gap: 5px; } .hud-tools b { display: none; }
    .journey-bar { left: 12px; right: 12px; bottom: max(12px, env(safe-area-inset-bottom)); gap: 8px; padding: 10px; }
    .stop-indicator { gap: 8px; } .stop-number { font-size: 1.5rem; padding-right: 8px; } .stop-number small { display: none; }
    .stop-indicator strong { font-size: var(--text-min); } .map-button { font-size: var(--text-min); padding: 0 10px; flex-shrink: 0; }
    .scroll-hint { display: none; }
  }
  @media(max-height:600px) { .journey-hud { top: calc(10px + var(--ticker-h, 0px)); } .journey-bar { bottom: 8px; padding: 6px 12px; } .scroll-hint { display: none; } }
  @media(prefers-reduced-motion:reduce) {
    .journey-hud { transition: none; }
    .now-playing { animation: none; }
    .ticker { animation: none; width: 100%; justify-content: center; }
    .ticker span + span { display: none; }
  }
</style>
