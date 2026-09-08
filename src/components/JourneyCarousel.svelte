<script>
  import { tick } from 'svelte'
  import { activeCard } from '../lib/stores/activeCard.js'
  import { journey } from '../stores/journey.svelte.js'
  import JourneyCard from './JourneyCard.svelte'
  let { cards, section } = $props()
  let root = $state()
  const index = $derived(Math.min(journey.selection(section.id), cards.length - 1))
  let pointer = null
  let suppressUntil = 0
  async function go(next) {
    if ($activeCard) return
    journey.select(section.id, Math.max(0, Math.min(cards.length - 1, next)))
    await tick()
    root?.querySelector('.main-card .card__rotator')?.focus({ preventScroll: true })
  }
  function key(event) {
    if (!root?.contains(document.activeElement) || $activeCard) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      go(index + (event.key === 'ArrowRight' ? 1 : -1))
    }
  }
  function down(event) {
    if ($activeCard || (event.pointerType === 'mouse' && event.button !== 0)) return
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }
  function move(event) {
    if (!pointer || event.pointerId !== pointer.id) return
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) event.currentTarget.setPointerCapture(event.pointerId)
  }
  function up(event) {
    if (!pointer || event.pointerId !== pointer.id) return
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      go(index + (dx < 0 ? 1 : -1))
      suppressUntil = performance.now() + 350
    }
    pointer = null
  }
</script>
<svelte:window onkeydown={key} />
<section class="focus-carousel" class:expanded={!!$activeCard} aria-label={`${section.name}卡牌`} aria-roledescription="輪播" bind:this={root}>
  <div class="card-stage" role="group" ondragstart={event => event.preventDefault()} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={() => pointer = null} onclickcapture={e => { if (performance.now() < suppressUntil) { e.preventDefault(); e.stopPropagation() } }}>
    {#if index > 0}
      <button class="preview previous" aria-label={`選擇上一張 ${cards[index - 1].name}`} onclick={() => go(index - 1)} disabled={!!$activeCard}><img src={cards[index - 1].images.small ?? cards[index - 1].images.large} alt="" /></button>
    {/if}
    <div class="main-card">
      {#key cards[index].id}<JourneyCard card={cards[index]} {section} />{/key}
    </div>
    {#if index < cards.length - 1}
      <button class="preview next" aria-label={`選擇下一張 ${cards[index + 1].name}`} onclick={() => go(index + 1)} disabled={!!$activeCard}><img src={cards[index + 1].images.small ?? cards[index + 1].images.large} alt="" /></button>
    {/if}
  </div>
  <nav class="carousel-pager" aria-label="切換卡牌" inert={!!$activeCard}>
    <button aria-label="上一張" disabled={index === 0} onclick={() => go(index - 1)}>←</button>
    <div aria-live="polite"><strong>{cards[index].name}</strong><span>第 {index + 1} 張 / 共 {cards.length} 張 <i>・</i> 點擊卡牌放大</span></div>
    <button aria-label="下一張" disabled={index === cards.length - 1} onclick={() => go(index + 1)}>→</button>
  </nav>
</section>
<style>
  .focus-carousel { --card-w: min(30vw, 330px, calc((100svh - 475px) * .716)); position: absolute; inset: 180px 0 215px; display: grid; align-content: center; justify-items: center; pointer-events: none; }
  .card-stage { animation: stop-rise .28s cubic-bezier(.2,.7,.3,1) both; position: relative; width: var(--card-w); aspect-ratio: 660 / 921; touch-action: pan-y; pointer-events: auto; }
  .main-card { position: relative; width: 100%; z-index: 2; }
  .preview { position: absolute; width: 77%; top: 12%; border: 0; padding: 0; background: transparent; opacity: .72; transition: opacity .2s; }
  .preview img { width: 100%; border-radius: 4.5%; box-shadow: 0 12px 28px #142a2955; }
  .preview:hover { opacity: 1; }
  .previous { right: 79%; transform: rotate(-9deg); }
  .next { left: 79%; transform: rotate(9deg); }
  .carousel-pager { display: flex; align-items: center; gap: 18px; margin-top: 22px; pointer-events: auto; color: var(--ink); }
  .carousel-pager button { border: 2px solid var(--ink); border-radius: 50%; width: 44px; height: 44px; background: var(--paper); box-shadow: 0 3px 0 #253c3c; font-size: 22px; }
  .carousel-pager div { display: grid; text-align: center; background: var(--paper); border: 2px solid var(--ink); border-radius: 12px; padding: 5px 15px; min-width: 180px; }
  strong { font-family: var(--font-display); font-weight: 400; font-size: 18px; }
  span { font-size: 11px; color: var(--ink-soft); }
  i { font-style: normal; }
  .expanded .card-stage { animation: none; }
  .expanded .preview, .expanded .carousel-pager { visibility: hidden; }
  @media(max-width:899px) {
    .focus-carousel { --card-w: min(56vw, 300px, calc((100svh - 420px) * .716)); inset: 135px 0 200px; }
    .carousel-pager { gap: 10px; margin-top: 17px; }
    .carousel-pager div { min-width: 170px; padding: 4px 8px; }
    strong { font-size: 16px; }
    .previous { right: 72%; } .next { left: 72%; }
  }
  @media(max-height:600px) {
    .focus-carousel { --card-w: min(34vw, calc((100svh - 210px) * .716)); inset: 80px 32% 72px 0; }
    .carousel-pager { margin-top: 8px; } .carousel-pager span { display: none; }
  }
</style>
