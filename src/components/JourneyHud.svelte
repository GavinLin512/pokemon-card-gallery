<script>
  import { dayCycle } from '../stores/dayCycle.svelte.js'
  import { pokedex } from '../stores/pokedex.svelte.js'
  import { journey, timeline } from '../stores/journey.svelte.js'
  import { locationAt } from '../config/journeyStops.js'
  import { resetBaseOrientation } from '../lib/stores/orientation.js'
  let { openPanel, navigate } = $props()
  const needsTilt = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function' && navigator.maxTouchPoints > 0
  let tilt = $state('ask')
  async function requestTilt() {
    try {
      tilt = await DeviceOrientationEvent.requestPermission()
      if (tilt === 'granted') resetBaseOrientation()
    } catch { tilt = 'denied' }
  }
</script>
<header class="journey-hud" inert={!!journey.panel || journey.expanded} class:concealed={journey.expanded}>
  <button class="location-badge" onclick={() => navigate(null)} aria-label="回到旅程起點">
    <span class="pokeball-symbol" aria-hidden="true"></span>
    <span><small>寶可夢卡牌展示館</small><strong>{locationAt(journey.current.progress)}</strong></span>
  </button>
  <nav class="hud-tools" aria-label="旅程工具">
    <button onclick={e => openPanel('search', e.currentTarget)} aria-label="搜尋卡牌" aria-expanded={journey.panel === 'search'}><span aria-hidden="true">⌕</span><b>搜尋</b></button>
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
    {#if needsTilt && tilt !== 'granted'}<button aria-label="開啟傾斜感應" disabled={tilt === 'denied'} onclick={requestTilt}><span aria-hidden="true">↔</span><b>{tilt === 'denied' ? '已停用' : '傾斜'}</b></button>{/if}
  </nav>
</header>
<footer class="journey-bar" inert={!!journey.panel || journey.expanded} class:concealed={journey.expanded}>
  <div class="stop-indicator"><span class="stop-number">{String((journey.current.nearby?.index ?? 0) + 1).padStart(2, '0')}<small> / 18</small></span><span><small>{journey.current.stop ? '目前停靠' : '下一個停靠點'}</small><strong>{journey.current.nearby?.name}</strong></span></div>
  <p class="scroll-hint">{journey.current.position >= timeline.length - .1 ? '旅程終點 · 還有更多卡牌等你探索' : '繼續向下捲動，探索下一站'} <span aria-hidden="true">↓</span></p>
  <button class="map-button" onclick={e => openPanel('map', e.currentTarget)} aria-expanded={journey.panel === 'map'}><span aria-hidden="true">⚑</span> 旅程地圖</button>
  <div class="route-progress" style:width={`${journey.current.position / timeline.length * 100}%`}></div>
</footer>
<style>
  .journey-hud { position: fixed; z-index: 35; inset: max(24px, env(safe-area-inset-top)) 28px auto; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; pointer-events: none; }
  button { pointer-events: auto; border: 2px solid var(--ink); border-radius: 12px; background: var(--paper); color: var(--ink); box-shadow: 0 4px 0 #263d3bd9; }
  .location-badge { display: flex; gap: 13px; align-items: center; padding: 10px 18px; text-align: left; }
  .location-badge small { display: block; font-size: 11px; letter-spacing: .1em; color: var(--ink-soft); }
  strong { display: block; font: 24px var(--font-display); }
  .hud-tools { display: flex; gap: 8px; }
  .hud-tools button { display: flex; align-items: center; gap: 8px; height: 48px; padding: 0 13px; }
  .hud-tools span { font-size: 25px; line-height: 1; } b { font: 15px var(--font-display); }
  .day-cycle-icon { width: 24px; height: 24px; flex-shrink: 0; }
  em { font-size: 12px; background: var(--red); color: white; border-radius: 5px; padding: 0 6px; font-style: normal; }
  .journey-bar { position: fixed; z-index: 35; left: 28px; right: 28px; bottom: max(20px, env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 20px; padding: 13px 16px; background: var(--paper); border: 2px solid var(--ink); border-radius: 14px; color: var(--ink); box-shadow: 0 4px 0 #263d3b; overflow: hidden; }
  .stop-indicator { display: flex; gap: 15px; align-items: center; flex: 1; }
  .stop-number { font: 30px var(--font-display); color: var(--red); border-right: 1px solid #263d3b33; padding-right: 15px; white-space: nowrap; }
  .stop-number small { font-size: 13px; color: var(--ink-soft); }
  .stop-indicator > span > small { font-size: 10px; color: var(--ink-soft); letter-spacing: .1em; }
  .stop-indicator strong { font-size: 18px; }
  .scroll-hint { font-size: 12px; color: var(--ink-soft); }
  .scroll-hint span { margin-left: 16px; }
  .map-button { box-shadow: none; background: var(--red); color: #fffaf0; border-color: var(--ink); padding: 0 18px; font-family: var(--font-display); }
  .route-progress { position: absolute; height: 3px; background: var(--red); bottom: 0; left: 0; }
  .concealed { visibility: hidden; }
  @media(max-width:899px) {
    .journey-hud { inset: max(12px, env(safe-area-inset-top)) 12px auto; gap: 6px; }
    .location-badge { padding: 6px 9px; gap: 8px; }
    .location-badge small { display: none; } .location-badge strong { font-size: 18px; } .location-badge :global(.pokeball-symbol) { width: 24px; height: 24px; }
    .hud-tools { gap: 5px; } .hud-tools button { height: 44px; padding: 0 9px; gap: 5px; } .hud-tools b { display: none; }
    .journey-bar { left: 12px; right: 12px; bottom: max(12px, env(safe-area-inset-bottom)); gap: 8px; padding: 10px; }
    .stop-indicator { gap: 8px; } .stop-number { font-size: 24px; padding-right: 8px; } .stop-number small { display: none; }
    .stop-indicator strong { font-size: 14px; } .map-button { font-size: 13px; padding: 0 10px; flex-shrink: 0; }
    .scroll-hint { display: none; }
  }
  @media(max-height:600px) { .journey-hud { top: 10px; } .journey-bar { bottom: 8px; padding: 6px 12px; } .scroll-hint { display: none; } }
</style>
