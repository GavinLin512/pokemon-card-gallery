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

  const card = $derived(cards.fromElement($activeCard))
  const captured = $derived(!!card && pokedex.has(card.id))
  const visible = $derived(!!$activeCard && !!card)

  $effect(() => {
    preloadPokeballAsset()
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
      // 收合時按鈕淡出，動畫照常播完
      await throwPokeball({ x: b.left + b.width / 2, y: b.top + b.height / 2 }, cardCenter(el), size)
      pokedex.add(snapshot, sectionId)
      justCaptured = true
      setTimeout(() => (justCaptured = false), 1200)
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
    disabled={!visible || busy}
    tabindex={visible ? 0 : -1}
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
    {:else if captured}
      已捕捉，再點一次放生
    {:else if busy}
      捕捉中…
    {:else}
      捕捉這張卡牌
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
