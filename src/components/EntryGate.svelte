<script>
  // 進站畫面（PLAN §9.9）：載入時顯示真實階段，載入完成後以壓暗的即時小鎮當背景，等訪客按下「進入真新鎮」。
  // 瀏覽器禁止無手勢自動播放，所以音樂與開場下降都從這一下點擊開始。
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { journey } from '../stores/journey.svelte.js'
  import { bgm } from '../stores/bgm.svelte.js'
  import { viewport } from '../stores/viewport.svelte.js'

  let { cardsReady = false } = $props()
  let enterButton = $state()
  const ready = $derived(journey.sceneReady && cardsReady)
  const stage = $derived(journey.sceneReady ? '整理卡牌…' : '建構真新鎮…')

  onMount(() => {
    // index.html 的靜態載入畫面在此交棒；兩者外觀相同，換手時不閃。
    document.getElementById('boot-screen')?.remove()
    bgm.preload()
  })
  $effect(() => { if (ready) enterButton?.focus({ preventScroll: true }) })

  /** 必須在點擊手勢內同步呼叫 bgm.enter，iOS 與 Chrome 才放行播放。 */
  function enter(music) {
    bgm.enter(music)
    journey.entered = true
  }
  function onKeydown(event) {
    if (!ready || journey.entered || event.key !== 'Enter' || event.target.closest?.('button, a')) return
    event.preventDefault()
    enter(bgm.enabled)
  }
</script>

<svelte:window onkeydown={onKeydown} />
{#if !journey.entered}
  <div class="entry-gate" class:ready out:fade={{ duration: viewport.reducedMotion ? 0 : 700 }} role="dialog" aria-modal="true" aria-labelledby="entry-title">
    <div class="sky"></div>
    <div class="scrim"></div>
    <div class="content">
      <span class="pokeball-symbol" aria-hidden="true"></span>
      <p class="eyebrow">真新鎮 · {journey.seriesInfo.full}</p>
      <h1 id="entry-title">寶可夢<br />卡牌展示館</h1>
      {#if ready}
        <div class="actions">
          <button class="primary enter" bind:this={enterButton} onclick={() => enter(bgm.enabled)}>進入真新鎮 <span aria-hidden="true">→</span></button>
          {#if !bgm.failed}<button class="quiet" onclick={() => enter(!bgm.enabled)}>{bgm.enabled ? '靜音進入' : '開啟音樂進入'}</button>{/if}
        </div>
        {#if !bgm.failed}<p class="note">{bgm.enabled ? '含背景音樂，可隨時按右上角的音樂按鈕關閉' : '目前為靜音，可隨時按右上角的音樂按鈕開啟'}</p>{/if}
        <a href="https://github.com/simeydotme/pokemon-cards-css" target="_blank" rel="noreferrer">卡牌效果 by simeydotme ↗</a>
      {:else}
        <p class="stage" role="status">{stage}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .entry-gate { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; text-align: center; color: var(--ink); text-shadow: none; transition: color .8s; }
  .entry-gate.ready { color: #fffaf0; text-shadow: 0 2px 18px #17382f88; }
  /* 與 index.html 的 #boot-screen 同色的天空底；載入完成後淡出，露出下方即時渲染的小鎮。 */
  .sky, .scrim { position: absolute; inset: 0; transition: opacity .8s; }
  .sky { background: linear-gradient(#9bd3ef, #e2f0e5); }
  .ready .sky { opacity: 0; }
  .scrim { opacity: 0; background: radial-gradient(ellipse at 50% 42%, #10241f66, #0a161aaa); }
  .ready .scrim { opacity: 1; }
  .content { position: relative; display: grid; justify-items: center; padding: max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom)); }
  .content .pokeball-symbol { width: 40px; height: 40px; margin-bottom: 20px; transition: transform .6s; filter: drop-shadow(0 2px 8px #0003); }
  .entry-gate:not(.ready) .pokeball-symbol { animation: wobble 1.1s ease-in-out infinite; }
  .ready .pokeball-symbol { transform: scale(1.3); }
  .eyebrow { height: 0; opacity: 0; overflow: hidden; transition: opacity .6s .2s; }
  .ready .eyebrow { height: auto; opacity: 1; margin-bottom: 4px; }
  h1 { font-size: 1.625rem; line-height: 1.22; letter-spacing: .015em; transition: font-size .8s ease; }
  .ready h1 { font-size: clamp(2.375rem, 6.4vw, 4.75rem); }
  .stage { margin-top: 8px; }
  .actions { display: grid; justify-items: center; gap: 4px; margin-top: 12px; animation: gate-in .5s .15s ease-out both; }
  .enter { margin-top: 16px; padding: 12px 40px; font-size: 1.375rem; animation: pulse 1.6s ease-in-out infinite; }
  .quiet { background: none; border: 0; padding: 0 16px; color: inherit; font: inherit; font-size: var(--text-min); text-decoration: underline; text-underline-offset: 4px; text-shadow: inherit; cursor: pointer; }
  .note { margin-top: 4px; font-size: var(--text-min); opacity: .85; animation: gate-in .5s .3s ease-out both; }
  a { display: inline-flex; align-items: center; min-height: 44px; margin-top: 12px; font-size: var(--text-min); text-underline-offset: 4px; animation: gate-in .5s .4s ease-out both; }
  @keyframes wobble { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-16deg) translateY(-3px); } 75% { transform: rotate(16deg) translateY(-3px); } }
  @keyframes pulse { 50% { transform: translateY(-3px); box-shadow: 0 7px 0 var(--ink); } }
  @keyframes gate-in { from { opacity: 0; translate: 0 8px; } }
  @media (max-height: 600px) {
    .content .pokeball-symbol { margin-bottom: 8px; }
    .ready h1 { font-size: 2.125rem; }
    .enter { margin-top: 8px; }
  }
</style>
