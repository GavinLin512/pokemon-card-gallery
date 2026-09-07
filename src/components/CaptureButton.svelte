<script>
  // 精靈球按鈕與捕捉動畫觸發（PLAN §9.1）。任一卡牌放大時於畫面底部中央淡入。
  import { activeCard } from '../lib/stores/activeCard.js'
  import { cards } from '../stores/cards.svelte.js'
  import { pokedex } from '../stores/pokedex.svelte.js'
  import { viewport } from '../stores/viewport.svelte.js'
  import { throwPokeball, preloadPokeballAsset } from '../scene/pokeball.js'

  let button = $state()
  let busy = $state(false)
  let justCaptured = $state(false)
  let escaped = $state(false)
  let resultTimer

  const card = $derived(cards.fromElement($activeCard))
  const captured = $derived(!!card && pokedex.has(card.id))
  const visible = $derived(!!$activeCard && !!card)
  const rate = $derived(card ? captureRate(card) : 0)

  /** 捕捉率依稀有度分級（PLAN §9.1）；稀有度未知時視同閃卡 */
  function captureRate(c) {
    const r = (c.rarity ?? '').toLowerCase()
    if (!r) return 0.7
    if (/rainbow|secret|shiny/.test(r)) return 0.3
    if (/ultra|vmax/.test(r)) return 0.45
    if (/amazing|radiant|vstar|holo v\b/.test(r)) return 0.55
    if (/common/.test(r)) return 0.9
    return 0.7
  }

  function showResult(kind) {
    clearTimeout(resultTimer)
    justCaptured = kind === 'captured'
    escaped = kind === 'escaped'
    resultTimer = setTimeout(() => {
      justCaptured = false
      escaped = false
    }, 1500)
  }

  $effect(() => {
    preloadPokeballAsset()
  })

  // 凍結區 Card.svelte 以 on:blur 收合卡牌：按下精靈球會先讓卡牌失焦、收合、按鈕停用，click 進不來。
  // 指標操作：pointerdown/mousedown 取消預設行為，焦點留在卡牌上。
  // 鍵盤操作：Tab 到按鈕時 blur 已無法避免，改在 capture 階段攔下卡牌的 blur，不讓凍結區的收合處理器執行。
  function keepFocus(e) {
    e.preventDefault()
  }
  $effect(() => {
    const guard = (e) => {
      if (e.relatedTarget === button && $activeCard?.contains(e.target)) e.stopPropagation()
    }
    document.addEventListener('blur', guard, true)
    return () => document.removeEventListener('blur', guard, true)
  })

  function cardCenter(el) {
    // 放大後的卡牌位置由 CSS transform 決定，取內層 rotator 的實際矩形
    const target = el.querySelector('.card__rotator') ?? el
    const r = target.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }

  async function onClick() {
    if (!card || busy) return
    if (captured) {
      pokedex.remove(card.id)
      return
    }
    const el = $activeCard
    const snapshot = card
    const sectionId = cards.sectionOf(snapshot.id)
    busy = true
    try {
      const b = button.getBoundingClientRect()
      const size = viewport.isMobile ? 64 : 56
      // 先擲骰決定成敗，動畫只負責演出；失敗時晃 1 到 3 下後彈開
      const success = Math.random() < rate
      const shakes = 1 + Math.floor(Math.random() * 3)
      // 收合時按鈕淡出，動畫照常播完
      await throwPokeball({ x: b.left + b.width / 2, y: b.top + b.height / 2 }, cardCenter(el), size, { success, shakes })
      if (success) {
        pokedex.add(snapshot, sectionId)
        showResult('captured')
      } else {
        showResult('escaped')
      }
    } finally {
      busy = false
    }
  }
</script>

<div class="capture" class:visible aria-hidden={!visible}>
  <button
    bind:this={button}
    type="button"
    class="ball"
    class:captured
    class:busy
    class:escaped
    disabled={!visible || busy}
    tabindex={visible ? 0 : -1}
    onpointerdown={keepFocus}
    onmousedown={keepFocus}
    onclick={onClick}
    aria-label={captured ? `放生 ${card?.name ?? '這張卡牌'}` : `捕捉 ${card?.name ?? '這張卡牌'}`}
  >
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="#fff" stroke="#2b2f36" stroke-width="4" />
      <path d="M3 32a29 29 0 0 1 58 0z" fill={captured ? '#6fbf5a' : '#e63946'} />
      <path d="M3 32h58" stroke="#2b2f36" stroke-width="5" />
      <circle cx="32" cy="32" r="9" fill="#fff" stroke="#2b2f36" stroke-width="5" />
      <circle cx="32" cy="32" r="4" fill="#2b2f36" />
    </svg>
  </button>
  <span class="label" aria-live="polite">
    {#if justCaptured}
      捕捉成功！
    {:else if escaped}
      跑掉了！再試一次
    {:else if captured}
      已捕捉，再點一次放生
    {:else if busy}
      捕捉中…
    {:else}
      捕捉這張卡牌 · 成功率 {Math.round(rate * 100)}%
    {/if}
  </span>
</div>

<style>
  .capture {
    position: fixed;
    left: 50%;
    bottom: calc(24px + env(safe-area-inset-bottom, 0px));
    transform: translate(-50%, 16px);
    z-index: 120;
    display: grid;
    justify-items: center;
    gap: 6px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease, transform 0.25s ease;
  }
  .capture.visible {
    opacity: 1;
    transform: translate(-50%, 0);
    pointer-events: auto;
  }

  .ball {
    width: 64px;
    height: 64px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.35));
    transition: transform 0.15s ease;
  }
  .ball svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  .ball:hover:not(:disabled) {
    transform: scale(1.08);
  }
  .ball:active:not(:disabled) {
    transform: scale(0.94);
  }
  .ball:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 3px;
  }
  .ball.busy {
    opacity: 0.4;
  }
  .ball.escaped {
    animation: escaped-shake 0.4s ease;
  }
  @keyframes escaped-shake {
    20% { transform: translateX(-6px) rotate(-8deg); }
    40% { transform: translateX(6px) rotate(8deg); }
    60% { transform: translateX(-4px) rotate(-5deg); }
    80% { transform: translateX(4px) rotate(5deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .ball.escaped {
      animation: none;
    }
  }

  .label {
    font-family: var(--font-display);
    font-size: 13px;
    padding: 2px 10px;
    border-radius: 999px;
    color: var(--ink);
    background: var(--paper);
    box-shadow: var(--ui-shadow);
    white-space: nowrap;
  }

  @media (min-width: 900px) {
    .ball {
      width: 56px;
      height: 56px;
    }
  }
</style>
