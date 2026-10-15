<script>
  // 捲動方向提示（PLAN §9.10）：放在 .card-stage 裡、貼著卡牌左側垂直置中，不攔截觸控與點擊。
  // 瀏覽器讀不到系統的自然／傳統捲動設定，滑鼠版只說「向下捲動」，交給各自的系統對應手勢；觸控一律是上滑前進。
  // 上半格固定放「手勢往上」的那一項：觸控是前進，滾輪是後退。
  import { fade } from 'svelte/transition'
  import { directionHint } from '../stores/directionHint.svelte.js'
  import { viewport } from '../stores/viewport.svelte.js'

  const steps = $derived.by(() => {
    const forward = { key: 'forward', gesture: viewport.touch ? '上滑' : '向下捲動', label: '前進' }
    const back = { key: 'back', gesture: viewport.touch ? '下滑' : '向上捲動', label: '後退' }
    const [up, down] = viewport.touch ? [forward, back] : [back, forward]
    return [{ ...up, arrow: '↑' }, { ...down, arrow: '↓' }].filter(step => !(directionHint.atEnd && step.key === 'forward'))
  })
</script>

{#if directionHint.visible}
  <div class="direction-hint" class:touch={viewport.touch} aria-hidden="true" transition:fade={{ duration: viewport.reducedMotion ? 0 : 240 }}>
    {#each steps as step, i (step.key)}
      {#if i > 0}<hr />{/if}
      <p class={step.key}>
        {#if step.arrow === '↑'}<span class="arrow up">↑</span>{/if}
        <b>{step.gesture}</b><em>{step.label}</em>
        {#if step.arrow === '↓'}<span class="arrow down">↓</span>{/if}
      </p>
    {/each}
    {#if !viewport.touch}<small>或按 ↑ ↓</small>{/if}
  </div>
{/if}

<style>
  .direction-hint { position: absolute; z-index: 20; top: 50%; right: calc(100% + 40px); translate: 0 -50%; width: max-content; padding: 10px 14px; display: grid; justify-items: center; gap: 6px; text-align: center; background: var(--paper); color: var(--ink); border: 2px solid var(--ink); border-radius: 12px; box-shadow: 0 4px 0 #263d3bd9; font-family: var(--font-display); pointer-events: none; }
  p { margin: 0; display: grid; justify-items: center; gap: 2px; }
  b { font-weight: 400; font-size: max(14px, .9375rem); }
  em { font-style: normal; font-size: var(--text-min); color: var(--red); }
  .arrow { font-size: 1.125rem; line-height: 1; color: var(--ink-soft); }
  .forward .arrow { color: var(--red); }
  .forward .up { animation: nudge-up 1.4s ease-in-out infinite; }
  .forward .down { animation: nudge-down 1.4s ease-in-out infinite; }
  hr { width: 100%; margin: 2px 0; border: 0; border-top: 1px solid #263d3b33; }
  small { font-size: var(--text-min); color: var(--ink-soft); white-space: nowrap; }
  @keyframes nudge-up { 50% { translate: 0 -4px; } }
  @keyframes nudge-down { 50% { translate: 0 4px; } }
  /* 手機卡牌左側只剩約 22vw，觸控版兩字一行、窄邊距，寬度約 48px */
  @media(max-width:899px) {
    .direction-hint { right: calc(100% + 12px); padding: 8px 6px; }
  }
  /* 矮螢幕（與輪播同一個斷點）卡牌只剩約 150px 高：拿掉箭頭、縮小間距，避免超出卡牌碰到下方的換卡按鈕；手勢文字本身已說明方向 */
  @media(max-height:600px) {
    .direction-hint { padding-block: 6px; gap: 3px; }
    .arrow { display: none; }
  }
  @media(prefers-reduced-motion:reduce) {
    .forward .arrow { animation: none; }
  }
</style>
