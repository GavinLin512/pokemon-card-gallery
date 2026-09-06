<script>
  // TopBar（PLAN §6、§10）：站名／圖示、搜尋框；日夜切換、圖鑑計數、傾斜授權由後續里程碑以 actions snippet 加入。
  import Search from './Search.svelte'
  import { dayCycle } from '../stores/dayCycle.svelte.js'
  import { pokedex } from '../stores/pokedex.svelte.js'
  import { resetBaseOrientation } from '../lib/stores/orientation.js'

  // 傾斜感應授權（PLAN §9.7）：只有 iOS 需要；狀態不持久化。部分桌機瀏覽器也暴露 requestPermission，另以觸控點數過濾。
  const needsTiltPermission =
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function' &&
    (navigator.maxTouchPoints ?? 0) > 0
  let tiltState = $state('ask') // ask | granted | denied
  async function requestTilt() {
    try {
      const result = await DeviceOrientationEvent.requestPermission()
      tiltState = result === 'granted' ? 'granted' : 'denied'
      if (tiltState === 'granted') resetBaseOrientation()
    } catch {
      tiltState = 'denied'
    }
  }

  // 圖鑑計數彈跳
  let bouncing = $state(false)
  let lastBump = pokedex.bump
  $effect(() => {
    if (pokedex.bump !== lastBump) {
      lastBump = pokedex.bump
      bouncing = true
      setTimeout(() => (bouncing = false), 600)
    }
  })

  let { actions } = $props()
  let bar = $state()

  $effect(() => {
    if (!bar) return
    const ro = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty('--topbar-h', `${Math.round(entry.contentRect.height)}px`)
    })
    ro.observe(bar)
    return () => ro.disconnect()
  })

  function toTop(event) {
    event.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    history.replaceState(null, '', ' ')
  }
</script>

<header class="topbar" bind:this={bar}>
  <a class="brand tap-target" href="#top" onclick={toTop} aria-label="回到頁首">
    <svg class="ball" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="#fff" stroke="#2b2f36" stroke-width="2" />
      <path d="M2 16a14 14 0 0 1 28 0z" fill="#e63946" />
      <path d="M2 16h28" stroke="#2b2f36" stroke-width="2.5" />
      <circle cx="16" cy="16" r="4.5" fill="#fff" stroke="#2b2f36" stroke-width="2.5" />
    </svg>
    <span class="brand-name">寶可夢卡牌展示館</span>
  </a>

  <div class="search-slot">
    <Search />
  </div>

  <div class="actions">
    {#if needsTiltPermission && tiltState !== 'granted'}
      <button type="button" class="chip tilt" onclick={requestTilt} disabled={tiltState === 'denied'}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2" fill="none" stroke="currentColor" stroke-width="2" /><path d="M3 9l-1 3 1 3M21 9l1 3-1 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        <span class="chip-label">{tiltState === 'denied' ? '已停用' : '開啟傾斜感應'}</span>
      </button>
    {/if}
    <button
      type="button"
      class="chip pokedex"
      class:bouncing
      onclick={() => pokedex.toggle()}
      aria-label="我的圖鑑，已捕捉 {pokedex.count} 張"
      aria-expanded={pokedex.open}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="#e63946" stroke="#2b2f36" stroke-width="1.5" /><circle cx="8" cy="8" r="2.2" fill="#7fd3ff" stroke="#2b2f36" stroke-width="1" /><rect x="6" y="13" width="12" height="5" rx="1" fill="#f5f5f5" stroke="#2b2f36" stroke-width="1" /></svg>
      <span class="count">{pokedex.count}</span>
    </button>
    <button
      type="button"
      class="chip daycycle"
      class:auto={dayCycle.isAuto}
      onclick={() => dayCycle.cycle()}
      aria-label="切換時段，目前{dayCycle.label}{dayCycle.isAuto ? '（自動）' : ''}"
      title="目前{dayCycle.label}{dayCycle.isAuto ? '（自動）' : ''}，點擊切換"
    >
      {#if dayCycle.key === 'night'}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor" /></svg>
      {:else if dayCycle.key === 'dusk'}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16h16M6 19h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><path d="M7 14a5 5 0 0 1 10 0z" fill="currentColor" /></svg>
      {:else if dayCycle.key === 'dawn'}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><path d="M7 14a5 5 0 0 1 10 0z" fill="currentColor" /><path d="M12 3v3M5.6 6.6l2.1 2.1M18.4 6.6l-2.1 2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      {/if}
      <span class="daycycle-label">{dayCycle.isAuto ? '自動' : dayCycle.label}</span>
    </button>
    {@render actions?.()}
  </div>
</header>

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--ui-bg);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--ui-border);
    box-shadow: 0 2px 12px rgba(30, 60, 90, 0.08);
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: var(--ui-fg);
    font-family: var(--font-display);
    font-size: 18px;
    flex: 0 0 auto;
  }
  .ball {
    width: 30px;
    height: 30px;
    flex: 0 0 auto;
  }
  .brand-name {
    display: none;
  }

  .search-slot {
    flex: 1 1 auto;
    min-width: 0;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 0 0 auto;
  }
  .actions:empty {
    display: none;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 44px;
    padding: 0 10px;
    border: 2px solid var(--ui-border);
    border-radius: 999px;
    background: var(--ui-chip);
    color: var(--ui-fg);
    transition: background 0.3s ease, color 0.3s ease, border-color 0.3s ease;
  }
  .chip:hover:not(:disabled) {
    border-color: var(--accent-dark);
  }
  .chip:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .chip:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .chip svg {
    width: 22px;
    height: 22px;
    flex: 0 0 auto;
  }
  .chip-label {
    display: none;
    font-family: var(--font-display);
    font-size: 14px;
    white-space: nowrap;
  }
  .count {
    min-width: 1.2em;
    text-align: center;
    font-family: var(--font-display);
    font-size: 15px;
    font-variant-numeric: tabular-nums;
  }
  .pokedex.bouncing .count {
    animation: bounce 0.6s cubic-bezier(0.3, 1.6, 0.4, 1);
  }
  @keyframes bounce {
    0% { transform: scale(1); }
    35% { transform: scale(1.6) translateY(-3px); }
    100% { transform: scale(1); }
  }
  .daycycle-label {
    display: none;
    font-family: var(--font-display);
    font-size: 14px;
  }
  .daycycle.auto .daycycle-label {
    opacity: 0.7;
  }

  /* 手機：搜尋框聚焦時展開全寬，暫時收起站名與右側按鈕（§10） */
  @media (max-width: 899px) {
    .topbar:has(.search-slot:focus-within) .brand,
    .topbar:has(.search-slot:focus-within) .actions {
      display: none;
    }
  }

  @media (min-width: 900px) {
    .topbar {
      gap: 20px;
      padding: 8px 24px;
    }
    .brand-name {
      display: inline;
    }
    .search-slot {
      flex: 0 1 460px;
      margin-left: auto;
    }
    .daycycle-label,
    .chip-label {
      display: inline;
    }
  }
</style>
