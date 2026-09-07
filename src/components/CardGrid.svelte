<script>
  // 卡牌格（PLAN §10）：桌機三欄格沿用原作；手機改為一次一張、左右滑動切換的輪播。
  // 輪播用 transform 位移而非原生橫向捲動：放大檢視的卡牌由凍結區 Card 以 transform 移到畫面中央，
  // 捲動容器會把它裁掉。外框平時 overflow: hidden 裁掉相鄰卡牌，有卡牌放大時改為不裁切。
  import { activeCard } from '../lib/stores/activeCard.js'
  import { viewport } from '../stores/viewport.svelte.js'

  let { children } = $props()
  let grid = $state()
  let track = $state()
  const active = $derived(!!(grid && $activeCard && grid.contains($activeCard)))

  let count = $state(0)
  let index = $state(0)
  /** 拖曳中的位移（px） */
  let drag = $state(0)
  let dragging = $state(false)

  // 子元素數量（展示區固定、搜尋結果會變），數量改變時回到第一張
  $effect(() => {
    if (!track) return
    const update = () => {
      const n = track.children.length
      if (n !== count) {
        count = n
        index = 0
      }
    }
    update()
    const mo = new MutationObserver(update)
    mo.observe(track, { childList: true })
    return () => mo.disconnect()
  })

  function go(i) {
    index = Math.max(0, Math.min(count - 1, i))
  }

  // 目前這張以 data-current 標記（凍結區 Card 會重設 class，不能用 classList）
  $effect(() => {
    if (!track) return
    const n = count
    const i = index
    for (let k = 0; k < n; k++) {
      const el = track.children[k]
      if (!el) continue
      if (k === i) el.setAttribute('data-current', '')
      else el.removeAttribute('data-current')
    }
  })

  // 手勢：pointer 事件搭配 touch-action: pan-y，垂直捲動交給瀏覽器，水平拖曳由這裡處理。
  const DRAG_START = 8
  const SWIPE_MIN = 40
  let startX = 0
  let startY = 0
  let startTime = 0
  let pointerId = null
  let axis = null // null | 'x' | 'y'
  let justDragged = false

  function onPointerDown(e) {
    if (active || !viewport.isMobile || count < 2) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    pointerId = e.pointerId
    startX = e.clientX
    startY = e.clientY
    startTime = e.timeStamp
    axis = null
    drag = 0
  }

  function onPointerMove(e) {
    if (e.pointerId !== pointerId) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    if (!axis) {
      if (Math.abs(dx) < DRAG_START && Math.abs(dy) < DRAG_START) return
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (axis === 'x') {
        dragging = true
        track.setPointerCapture?.(pointerId)
      }
    }
    if (axis !== 'x') return
    // 第一張往右、最後一張往左時加阻力
    const atEdge = (index === 0 && dx > 0) || (index === count - 1 && dx < 0)
    drag = atEdge ? dx * 0.3 : dx
  }

  function onPointerEnd(e) {
    if (e.pointerId !== pointerId) return
    pointerId = null
    if (axis === 'x') {
      const dx = e.clientX - startX
      const fast = Math.abs(dx) > 20 && e.timeStamp - startTime < 250
      if (dx <= -SWIPE_MIN || (fast && dx < 0)) go(index + 1)
      else if (dx >= SWIPE_MIN || (fast && dx > 0)) go(index - 1)
      // 拖曳後放開會再觸發 click，避免誤把卡牌放大
      justDragged = true
      setTimeout(() => (justDragged = false), 0)
    }
    axis = null
    dragging = false
    drag = 0
  }

  function onClickCapture(e) {
    if (!justDragged) return
    e.stopPropagation()
    e.preventDefault()
  }

  // 方向鍵：焦點在這個卡牌格內（卡牌或分頁按鈕）時才作用
  function onKeydown(e) {
    if (!viewport.isMobile || active || !grid?.contains(document.activeElement)) return
    if (e.key === 'ArrowRight') {
      go(index + 1)
      e.preventDefault()
    } else if (e.key === 'ArrowLeft') {
      go(index - 1)
      e.preventDefault()
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<section
  class="card-grid"
  class:active
  class:carousel={viewport.isMobile}
  aria-roledescription={viewport.isMobile ? '輪播' : undefined}
  aria-label="卡牌"
  bind:this={grid}
>
  <div
    class="track"
    class:dragging
    role="group"
    style:--i={index}
    style:--drag="{drag}px"
    bind:this={track}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerEnd}
    onpointercancel={onPointerEnd}
    onclickcapture={onClickCapture}
  >
    {@render children?.()}
  </div>

  {#if viewport.isMobile && count > 1}
    <nav class="pager" aria-label="切換卡牌">
      <button type="button" class="arrow" aria-label="上一張" disabled={index === 0} onclick={() => go(index - 1)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
      <span class="counter" aria-live="polite">第 {index + 1} 張 / 共 {count} 張</span>
      <button type="button" class="arrow" aria-label="下一張" disabled={index === count - 1} onclick={() => go(index + 1)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
    </nav>
  {/if}
</section>

<style>
  .card-grid {
    position: relative;
    max-width: 1200px;
    margin: auto;
  }
  .card-grid.active {
    z-index: 99;
  }

  /* 桌機：三欄格，沿用原作間距 */
  .track {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-gap: 50px 2vw;
    transform-style: preserve-3d;
    padding: 50px;
  }

  :global(.card-grid > .track > .card.active) {
    transform: translate3d(0, 0, 0.1px) !important;
  }

  /* 手機：輪播。每張佔 78% 寬、最寬 360px（原作在 600 到 899px 也把卡牌限制在約 320px），左右露出相鄰卡牌一角提示可滑動 */
  .card-grid.carousel {
    --slide: min(78%, 360px);
    --gap: 12px;
    overflow: hidden;
    padding: 30px 0 4px;
    touch-action: pan-y;
  }
  .card-grid.carousel.active {
    overflow: visible;
  }
  .card-grid.carousel .track {
    display: flex;
    align-items: flex-start;
    gap: var(--gap);
    padding: 0;
    transform: translate3d(calc((100% - var(--slide)) / 2 - var(--i) * (var(--slide) + var(--gap)) + var(--drag)), 0, 0);
    transition: transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1);
  }
  .card-grid.carousel .track.dragging {
    transition: none;
  }
  :global(.card-grid.carousel > .track > *) {
    flex: 0 0 var(--slide);
    min-width: 0;
  }
  /* 相鄰卡牌略淡，聚焦目前這張 */
  :global(.card-grid.carousel > .track > :not([data-current])) {
    opacity: 0.55;
    transition: opacity 0.35s ease;
  }

  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 12px;
  }
  .arrow {
    width: 44px;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--ui-border);
    border-radius: 50%;
    background: var(--ui-chip);
    color: var(--ui-fg);
  }
  .arrow:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .arrow:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .arrow svg {
    width: 22px;
    height: 22px;
  }
  .counter {
    min-width: 8em;
    text-align: center;
    font-family: var(--font-display);
    font-size: 15px;
    color: #fff;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: reduce) {
    .card-grid.carousel .track,
    :global(.card-grid.carousel > .track > *) {
      transition: none;
    }
  }
</style>
