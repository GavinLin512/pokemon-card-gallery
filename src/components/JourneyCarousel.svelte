<script>
  import { tick } from 'svelte'
  import { cubicOut } from 'svelte/easing'
  import { fade } from 'svelte/transition'
  import { activeCard } from '../lib/stores/activeCard.js'
  import { journey } from '../stores/journey.svelte.js'
  import { loadNames, zhCardName } from '../stores/names.svelte.js'
  import { viewport } from '../stores/viewport.svelte.js'
  import JourneyCard from './JourneyCard.svelte'
  import DirectionHint from './DirectionHint.svelte'
  let { cards, section } = $props()
  // 下方卡名與搜尋結果一樣顯示中文名，並保留地區型態與 VMAX、ex 等英文後綴；對照表載入前或查無對照（例如訓練家卡）時顯示英文名
  loadNames().catch(() => {})
  let root = $state()
  const index = $derived(Math.min(journey.selection(section.id), cards.length - 1))
  let pointer = null
  let suppressUntil = 0

  // 景深陳列（HD-2D 畫風，預設；?look=classic 時用一般陳列）：卡牌以底邊中央站在路面上。slot 是與目前卡牌的距離，
  // 正值沿道路往右上方遠處排列、越遠越小越模糊；-1 是剛看過的卡，換卡時往左下淡出，不留在畫面上（也因此點不到）。
  // 每格為 [x%, y%, 縮放, 模糊 px, 不透明度]，位移以卡牌本身寬高為單位。-2 與 5 是畫面外的進出位置。
  const depth = viewport.look === 'hd2d'
  const DEPTH = {
    wide: { '-2': [-170, 40, 1.15, 8, 0], '-1': [-122, 18, 1, 6, 0], 0: [0, 0, 1, 0, 1], 1: [66, -9, .64, 1.2, .96], 2: [108, -20, .47, 2, .9], 3: [138, -29, .36, 2.8, .82], 4: [162, -36, .28, 3.4, .72], 5: [182, -42, .22, 4, 0] },
    // 窄螢幕：不放前景卡，預覽疊在主卡右上後方。
    narrow: { '-2': [-60, 20, 1.1, 6, 0], '-1': [-40, 12, 1.05, 5, 0], 0: [0, 0, 1, 0, 1], 1: [24, -6, .88, .8, .95], 2: [42, -11, .76, 1.5, .85], 3: [56, -15, .66, 2.2, .7], 4: [66, -18, .58, 2.8, 0], 5: [74, -21, .5, 3, 0] }
  }
  const shortQuery = matchMedia('(max-height: 600px)')
  let short = $state(shortQuery.matches)
  $effect(() => {
    const update = event => (short = event.matches)
    shortQuery.addEventListener('change', update)
    return () => shortQuery.removeEventListener('change', update)
  })
  const narrow = $derived(viewport.isMobile || short)
  /** 最近一次換卡的距離；新主卡從原本那一格放大進場。 */
  let shift = $state(0)
  /** 離站時整個輪播淡出；一般陳列換卡時新舊主卡交叉淡化（剛掛載時 shift 為 0，不與 stop-rise 重疊）。 */
  const leave = () => ({ duration: viewport.reducedMotion ? 0 : 220 })
  const swap = () => ({ duration: viewport.reducedMotion || !shift ? 0 : 200 })

  function depthOf(slot) {
    const [x, y, scale, blur, opacity] = DEPTH[narrow ? 'narrow' : 'wide'][Math.max(-2, Math.min(5, slot))]
    return { x, y, scale, blur, opacity }
  }
  function depthStyle(g, filter = true) {
    return `transform: translate(${g.x}%, ${g.y}%) scale(${g.scale}); opacity: ${g.opacity};${filter ? ` filter: blur(${g.blur}px) saturate(${1 - g.blur * .04});` : ''}`
  }
  /** 主卡進場：從原本的預覽位置移到中央。預覽卡本身常駐，換卡時只靠 CSS transition 換位置。 */
  function travel(node, { from, to, filter = true }) {
    if (!depth || viewport.reducedMotion || from === to) return { duration: 0 }
    const a = depthOf(from), b = depthOf(to)
    const mix = key => t => a[key] + (b[key] - a[key]) * t
    const [x, y, scale, blur, opacity] = ['x', 'y', 'scale', 'blur', 'opacity'].map(mix)
    return { duration: 420, easing: cubicOut, css: t => depthStyle({ x: x(t), y: y(t), scale: scale(t), blur: blur(t), opacity: opacity(t) }, filter) }
  }
  $effect(() => {
    if (!depth) return
    // 預先載入前後兩張大圖，遞補成主卡時不會空白。
    for (const card of [cards[index + 1], cards[index - 1]]) if (card) new Image().src = card.images.large
  })

  async function go(next) {
    if ($activeCard) return
    const target = Math.max(0, Math.min(cards.length - 1, next))
    shift = target - index
    journey.select(section.id, target)
    await tick()
    // 交叉淡化期間舊卡仍在 DOM（inert），新主卡是最後一個。
    const rotators = root?.querySelectorAll('.main-card .card__rotator') ?? []
    rotators[rotators.length - 1]?.focus({ preventScroll: true })
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
<section class="focus-carousel" class:expanded={!!$activeCard} class:depth aria-label={`${section.name}卡牌`} aria-roledescription="輪播" bind:this={root} out:fade|global={leave()}>
  <div class="card-stage" role="group" ondragstart={event => event.preventDefault()} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={() => pointer = null} onclickcapture={e => { if (performance.now() < suppressUntil) { e.preventDefault(); e.stopPropagation() } }}>
    {#if depth}
      <!-- 每張卡常駐一個預覽，不掛載也不卸載；目前這張的預覽疊在主卡正下方，換卡時直接接手退場。 -->
      {#each cards as card, i (card.id)}
        {@const slot = i - index}
        {@const place = depthOf(slot)}
        {@const shown = slot !== 0 && place.opacity > 0}
        <button class="preview" class:hidden={!shown} class:current={slot === 0} style={`${depthStyle(place)} z-index: ${10 - Math.abs(slot)};`}
          aria-label={`選擇第 ${i + 1} 張 ${card.name}`} aria-hidden={!shown}
          tabindex={shown && Math.abs(slot) === 1 ? 0 : -1} onclick={() => go(i)} disabled={!!$activeCard}><img src={card.images.small ?? card.images.large} alt="" /></button>
      {/each}
      {#key cards[index].id}
        <div class="main-card" in:travel={{ from: shift, to: 0, filter: false }}><JourneyCard card={cards[index]} {section} /></div>
      {/key}
    {:else}
      {#if index > 0}
        <button class="preview previous" aria-label={`選擇上一張 ${cards[index - 1].name}`} onclick={() => go(index - 1)} disabled={!!$activeCard}><img src={cards[index - 1].images.small ?? cards[index - 1].images.large} alt="" /></button>
      {/if}
      <div class="main-card">
        {#key cards[index].id}<div class="card-slot" in:fade={swap()} out:fade={swap()}><JourneyCard card={cards[index]} {section} /></div>{/key}
      </div>
      {#if index < cards.length - 1}
        <button class="preview next" aria-label={`選擇下一張 ${cards[index + 1].name}`} onclick={() => go(index + 1)} disabled={!!$activeCard}><img src={cards[index + 1].images.small ?? cards[index + 1].images.large} alt="" /></button>
      {/if}
    {/if}
    <DirectionHint />
  </div>
  <nav class="carousel-pager" aria-label="切換卡牌" inert={!!$activeCard}>
    <button aria-label="上一張" disabled={index === 0} onclick={() => go(index - 1)}>←</button>
    <div aria-live="polite"><strong>{zhCardName(cards[index].name) || cards[index].name}</strong><span>第 {index + 1} 張 / 共 {cards.length} 張 <i>・</i> 點擊卡牌放大</span></div>
    <button aria-label="下一張" disabled={index === cards.length - 1} onclick={() => go(index + 1)}>→</button>
  </nav>
</section>
<style>
  .focus-carousel { --card-w: min(30vw, 330px, calc((100svh - 475px) * .716)); position: absolute; inset: 180px 0 215px; display: grid; align-content: center; justify-items: center; pointer-events: none; }
  /* 到站浮現只播一次，播完不保留 opacity 與 translate（backwards 而非 both），放大時不必再關掉動畫；
     若隨 .expanded 切換 animation，收合時會從透明重播，正在縮回的大卡被包進透明群組，低階手機明顯卡頓。 */
  .card-stage { animation: stop-rise .28s cubic-bezier(.2,.7,.3,1) backwards; position: relative; width: var(--card-w); aspect-ratio: 660 / 921; touch-action: pan-y; pointer-events: auto; }
  /* 新舊主卡疊在同一格交叉淡化；舊卡淡出期間由 Svelte 設為 inert，不會接到點擊。 */
  .main-card { position: relative; width: 100%; z-index: 2; display: grid; }
  .card-slot { grid-area: 1 / 1; width: 100%; }
  .preview { position: absolute; width: 77%; top: 12%; border: 0; padding: 0; background: transparent; opacity: .72; transition: opacity .2s; }
  .preview img { width: 100%; border-radius: 4.5%; box-shadow: 0 12px 28px #142a2955; }
  .preview:hover { opacity: 1; }
  .previous { right: 79%; transform: rotate(-9deg); }
  .next { left: 79%; transform: rotate(9deg); }
  .carousel-pager { display: flex; align-items: center; gap: 18px; margin-top: 22px; pointer-events: auto; color: var(--ink); }
  .carousel-pager button { border: 2px solid var(--ink); border-radius: 50%; width: 44px; height: 44px; background: var(--paper); box-shadow: 0 3px 0 #253c3c; font-size: 1.375rem; }
  .carousel-pager div { display: grid; text-align: center; background: var(--paper); border: 2px solid var(--ink); border-radius: 12px; padding: 5px 15px; min-width: 180px; }
  strong { font-family: var(--font-display); font-weight: 400; font-size: 1.125rem; }
  span { font-size: var(--text-min); color: var(--ink-soft); }
  i { font-style: normal; }
  .expanded .preview, .expanded .carousel-pager { visibility: hidden; }
  /* 景深陳列：主卡腳下有地面陰影、背後一圈微光；預覽與主卡同尺寸，以底邊中央為軸縮放。 */
  .depth .card-stage::before { content: ''; position: absolute; inset: -16% -32% -4%; background: radial-gradient(closest-side, #fff4d0b0, #fff4d000); pointer-events: none; animation: depth-glow 3.2s ease-in-out infinite alternate; }
  .depth .card-stage::after { content: ''; position: absolute; left: 4%; right: 4%; bottom: -4%; height: 8%; background: radial-gradient(closest-side, #0d1d1775, #0d1d1700); pointer-events: none; }
  .depth .main-card { z-index: 20; transform-origin: 50% 100%; }
  .depth .preview { inset: 0; top: 0; width: 100%; transform-origin: 50% 100%; transition: transform .42s cubic-bezier(.2,.7,.3,1), filter .42s, opacity .42s; }
  .depth .preview::after { content: ''; position: absolute; left: 6%; right: 6%; bottom: -4%; height: 7%; background: radial-gradient(closest-side, #0d1d1760, #0d1d1700); }
  .depth .preview img { display: block; box-shadow: none; }
  .depth .preview.hidden { pointer-events: none; }
  /* 目前這張的預覽在主卡正下方待命；主卡 hover 傾斜時會從邊緣露出一張不動的小圖，所以平時隱藏。
     只切 visibility、不動 opacity 與 transform，換卡成為 slot -1 的瞬間仍從原位接手滑出。 */
  .depth .preview.current { visibility: hidden; }
  @keyframes depth-glow { from { opacity: .5; } to { opacity: .9; } }
  @media (prefers-reduced-motion: reduce) {
    .depth .preview { transition: none; }
    .depth .card-stage::before { animation: none; }
  }
  @media(max-width:899px) {
    .focus-carousel { --card-w: min(56vw, 300px, calc((100svh - 420px) * .716)); inset: 135px 0 200px; }
    .carousel-pager { gap: 10px; margin-top: 17px; }
    .carousel-pager div { min-width: 170px; padding: 4px 8px; }
    strong { font-size: max(14px, 1rem); }
    .previous { right: 72%; } .next { left: 72%; }
  }
  @media(max-height:600px) {
    .focus-carousel { --card-w: min(34vw, calc((100svh - 210px) * .716)); inset: 80px 32% 72px 0; }
    .carousel-pager { margin-top: 8px; } .carousel-pager span { display: none; }
  }
</style>
