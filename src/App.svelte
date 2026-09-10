<script>
  import { onMount, tick, untrack } from 'svelte'
  import { sections as swshSections, sliceCards, buildCardSectionMap } from './config/sections.js'
  import { DEFAULT_SERIES, allSections, seriesOfSection } from './config/series.js'
  import { cards as cardRegistry } from './stores/cards.svelte.js'
  import { search } from './stores/search.svelte.js'
  import { viewport } from './stores/viewport.svelte.js'
  import { journey } from './stores/journey.svelte.js'
  import { landingFor, restorePosition, advancePosition } from './journey/timeline.js'
  import { activeCard } from './lib/stores/activeCard.js'
  import JourneyHud from './components/JourneyHud.svelte'
  import JourneyCarousel from './components/JourneyCarousel.svelte'
  import JourneyMap from './components/JourneyMap.svelte'
  import JourneyCard from './components/JourneyCard.svelte'
  import ProfessorDialog from './components/ProfessorDialog.svelte'
  import Search from './components/Search.svelte'
  import SearchResults from './components/SearchResults.svelte'
  import PokedexDrawer from './components/PokedexDrawer.svelte'
  import CaptureButton from './components/CaptureButton.svelte'
  import SeriesSwitch from './components/SeriesSwitch.svelte'

  const townScene = import('./scene/TownScene.svelte').catch(() => null)
  let cards = $state([])
  let loadError = $state(false)
  let load151Error = $state(false)
  let sceneFailed = $state(false)
  let openingAmount = $state(1)
  let height = $state(window.innerHeight)
  let reveal = $state(false)
  let revisit = $state(false)
  let selectedSearchCard = $state(null)
  let searchView = $state()
  let panelRoot = $state()
  let modalCard = $state()
  let panelOpener = null
  let cardOpener = null
  let searchScroll = 0
  let openingFrame = 0
  let travelFrame = 0
  let travelTarget = 0
  let travelTime = 0
  let navigationToken = 0
  let hadActive = false
  let disposed = false
  const grouped = $derived(journey.sections.map(section => ({ section, cards: sliceCards(cards, section) })))
  const stop = $derived(journey.current.stop)
  const currentCards = $derived(stop ? grouped[stop.index]?.cards ?? [] : [])

  function hashStop() {
    try { const id = decodeURIComponent(location.hash.slice(1)); return allSections.some(s => s.id === id) ? id : null } catch { return null }
  }
  function savePosition() {
    history.replaceState({ ...history.state, journeyPosition: journey.current.position, series: journey.series }, '')
  }
  function setPosition(position, direct = false) {
    cancelAnimationFrame(travelFrame)
    travelFrame = 0
    travelTime = 0
    travelTarget = position
    if (direct || position !== journey.current.position) journey.move(position, direct)
    window.scrollTo({ top: journey.current.position * height, behavior: 'instant' })
  }
  // 鏡頭與舞台讀取同一份平滑距離；不在場景另加一層延遲。
  function followScroll(now) {
    travelFrame = 0
    if (journey.paused) return
    const dt = travelTime ? Math.min((now - travelTime) / 1000, .05) : 1 / 60
    travelTime = now
    const position = advancePosition(journey.current.position, travelTarget, dt)
    journey.move(position)
    if (position !== travelTarget) travelFrame = requestAnimationFrame(followScroll)
    else { travelTime = 0; savePosition() }
  }

  function finishOpening() {
    cancelAnimationFrame(openingFrame)
    openingAmount = 0
    journey.opening = false
  }
  function ready(failed = false) {
    if (journey.sceneReady) { if (failed) { sceneFailed = true; finishOpening() } return }
    sceneFailed = failed
    journey.sceneReady = true
    if (!journey.opening || viewport.reducedMotion || failed) { finishOpening(); return }
    const start = performance.now()
    function frame(now) {
      const t = Math.min(1, (now - start) / 1800)
      openingAmount = (1 - t) ** 3
      if (t < 1) openingFrame = requestAnimationFrame(frame)
      else finishOpening()
    }
    openingFrame = requestAnimationFrame(frame)
  }
  async function loadCards() {
    loadError = false
    try {
      const response = await fetch('/data/cards.json', { signal: AbortSignal.timeout(20000) })
      if (!response.ok) throw new Error('cards')
      const data = await response.json()
      if (!Array.isArray(data) || data.length < Math.max(...swshSections.flatMap(s => s.slices.map(([, end]) => end)))) throw new Error('cards')
      const extra = await load151()
      if (disposed) return
      cards = [...data, ...extra]
      cardRegistry.register(cards)
      cardRegistry.setSectionMap(buildCardSectionMap(cards, allSections))
      const image = new Image(); image.src = data[1].images.large
    } catch { if (!disposed) loadError = true }
  }
  /** 151 系列（PLAN §15）：set 攤平為字串；失敗只讓第 19 站顯示提示，不影響其餘展示區。 */
  async function load151() {
    load151Error = false
    try {
      const response = await fetch('/data/cards-151.json', { signal: AbortSignal.timeout(20000) })
      if (!response.ok) throw new Error('cards-151')
      const data = await response.json()
      if (!Array.isArray(data)) throw new Error('cards-151')
      return data.map(card => ({ ...card, set: typeof card.set === 'string' ? card.set : card.set?.id }))
    } catch { load151Error = true; return [] }
  }
  /** 切換系列（PLAN §15）：換時間軸、更新網址 ?series 與偏好，位置歸零；相同系列回傳 false。 */
  function applySeries(id) {
    if (!journey.setSeries(id)) return false
    search.clear() // 搜尋只在目前系列內找，切換後結果不再適用
    const url = new URL(location.href)
    if (id === DEFAULT_SERIES) url.searchParams.delete('series'); else url.searchParams.set('series', id)
    url.hash = ''
    history.replaceState({ ...history.state, series: id, journeyPosition: 0 }, '', url)
    return true
  }
  /** 使用者切換系列：開場畫面停在起點，旅途中則前往該系列第一站。 */
  function switchSeries(id) {
    if (!applySeries(id)) return
    closePanel(false)
    if (journey.opening) setPosition(0, true)
    else navigate(journey.stops[0].id)
  }
  async function navigate(id, cardId = null, record = true) {
    const targetSeries = id ? seriesOfSection(id) : null
    if (targetSeries && targetSeries !== journey.series) applySeries(targetSeries)
    const position = id ? landingFor(journey.timeline, id) : 0
    if (position === null) return
    const token = ++navigationToken
    finishOpening()
    closePanel(false)
    closeCard(false)
    savePosition()
    if (record) history.pushState({ journeyPosition: position, series: journey.series }, '', id ? `#${id}` : location.pathname + location.search)
    journey.jumping = !viewport.reducedMotion
    if (journey.jumping) await new Promise(resolve => setTimeout(resolve, 160))
    if (token !== navigationToken || disposed) return
    if (cardId && id) {
      const group = grouped.find(g => g.section.id === id)
      const index = group?.cards.findIndex(c => c.id === cardId) ?? -1
      if (index >= 0) journey.select(id, index)
    }
    setPosition(position, true)
    savePosition()
    if (journey.jumping) await new Promise(resolve => setTimeout(resolve, 100))
    if (token === navigationToken) {
      journey.jumping = false
      await tick()
      document.querySelector('.journey-stage')?.focus({ preventScroll: true })
    }
  }
  async function openPanel(name, opener) {
    finishOpening()
    if (journey.panel === 'search') searchScroll = searchView?.scrollTop ?? 0
    if (!journey.panel) panelOpener = opener ?? document.activeElement
    journey.panel = name
    await tick()
    if (searchView) searchView.scrollTop = name === 'search' ? searchScroll : 0
    panelRoot?.querySelector(name === 'search' ? 'input' : '.panel-close')?.focus({ preventScroll: true })
  }
  function closePanel(focus = true) {
    if (journey.panel === 'search') searchScroll = searchView?.scrollTop ?? 0
    journey.panel = null
    if (focus) tick().then(() => panelOpener?.focus({ preventScroll: true }))
  }
  async function selectSearchCard(card, opener) {
    cardOpener = opener
    selectedSearchCard = card
    await tick()
    const button = modalCard?.querySelector('.card__rotator')
    button?.focus({ preventScroll: true })
    button?.click()
  }
  function closeCard(focus = true) {
    activeCard.set(undefined)
    if (selectedSearchCard) {
      selectedSearchCard = null
      if (focus) tick().then(() => cardOpener?.focus({ preventScroll: true }))
    }
  }
  function selectEntry(entry) {
    const id = allSections.some(s => s.id === entry.sectionId) ? entry.sectionId : cardRegistry.sectionOf(entry.id)
    if (id) navigate(id, entry.id)
    else { search.query = entry.name; openPanel('search', null) }
  }

  $effect(() => {
    const active = !!$activeCard
    journey.expanded = active || !!selectedSearchCard
    if (hadActive && !active && selectedSearchCard) closeCard()
    hadActive = active
  })
  $effect(() => {
    if (journey.paused) untrack(() => setPosition(journey.current.position))
    document.documentElement.classList.toggle('journey-locked', journey.paused)
    return () => document.documentElement.classList.remove('journey-locked')
  })
  $effect(() => {
    const id = stop?.id
    const available = currentCards.length > 0
    const blocked = journey.opening || !journey.sceneReady || journey.jumping
    reveal = false
    if (!id || !available || blocked) return
    revisit = untrack(() => !!journey.visited[id])
    const show = () => { reveal = true }
    if (viewport.reducedMotion) show()
    else {
      const timer = setTimeout(show, revisit ? 60 : 100)
      return () => clearTimeout(timer)
    }
  })
  $effect(() => {
    if (!reveal || !stop || journey.panel) return
    const id = stop.id
    if (viewport.reducedMotion) { untrack(() => journey.visit(id)); return }
    const timer = setTimeout(() => journey.visit(id), 280)
    return () => clearTimeout(timer)
  })
  $effect(() => {
    const next = grouped[(stop?.index ?? -1) + 1]?.cards[0]
    if (next) { const image = new Image(); image.src = next.images.large }
  })
  $effect(() => { if (viewport.reducedMotion) finishOpening() })

  onMount(() => {
    document.getElementById('boot-screen')?.remove()
    if (viewport.cardTest.size) document.documentElement.dataset.cardtest = [...viewport.cardTest].join(' ')
    if (viewport.flatFoil) document.documentElement.setAttribute('data-flat-foil', '')
    const previousRestoration = history.scrollRestoration
    history.scrollRestoration = 'manual'
    const hash = hashStop()
    const hashSeries = hash ? seriesOfSection(hash) : null
    if (hashSeries && hashSeries !== journey.series) applySeries(hashSeries)
    else if (history.state?.series && history.state.series !== journey.series) applySeries(history.state.series)
    const restored = hash ? landingFor(journey.timeline, hash) : restorePosition(journey.timeline, history.state)
    if (hash || restored > 0 || window.scrollY > 0) {
      finishOpening()
      setPosition(restored || window.scrollY / height, true)
    }
    savePosition()
    loadCards()
    townScene.then(module => { if (!module && !disposed) ready(true) })
    const onScroll = () => {
      if (journey.paused) { window.scrollTo({ top: journey.current.position * height, behavior: 'instant' }); return }
      if (journey.opening) { finishOpening(); setPosition(0, true); return }
      travelTarget = window.scrollY / height
      if (viewport.reducedMotion) { journey.move(travelTarget); savePosition(); return }
      if (!travelFrame) travelFrame = requestAnimationFrame(followScroll)
    }
    const onResize = async () => {
      const position = journey.current.position
      height = window.innerHeight
      await tick()
      setPosition(position, true)
      if ($activeCard) window.dispatchEvent(new Event('scroll'))
    }
    const onHistory = () => {
      navigationToken++
      journey.jumping = false
      finishOpening(); closeCard(false); closePanel(false)
      const hash = hashStop()
      const hashSeries = hash ? seriesOfSection(hash) : null
      if (history.state?.series && history.state.series !== journey.series) journey.setSeries(history.state.series)
      else if (hashSeries && hashSeries !== journey.series) journey.setSeries(hashSeries)
      setPosition(Number.isFinite(history.state?.journeyPosition) ? restorePosition(journey.timeline, history.state) : hash ? landingFor(journey.timeline, hash) : 0, true)
    }
    const skipOnInput = event => {
      if (!journey.opening) return
      if (event.type === 'keydown' && !['ArrowDown', 'PageDown', ' ', 'End'].includes(event.key)) return
      event.preventDefault()
      finishOpening(); setPosition(0, true)
    }
    const onKey = event => {
      if (event.key === 'Escape') {
        if ($activeCard || selectedSearchCard) { event.preventDefault(); event.stopImmediatePropagation(); closeCard(); return }
        if (journey.panel) { event.preventDefault(); closePanel(); return }
      }
      if (event.key !== 'Tab') return
      let elements = []
      if ($activeCard) elements = [$activeCard.querySelector('button'), document.querySelector('.capture.visible button'), document.querySelector('.inspection-close')]
      else if (journey.panel && panelRoot) elements = [...panelRoot.querySelectorAll('button:not(:disabled), input, a[href], [tabindex="0"]')]
      elements = elements.filter(el => el && el.getClientRects().length && !el.closest('[inert]'))
      if (!elements.length) return
      const index = elements.indexOf(document.activeElement)
      const next = index < 0 ? (event.shiftKey ? elements.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + elements.length) % elements.length
      event.preventDefault()
      elements[next].focus({ preventScroll: true })
    }
    const guardBlur = event => {
      if ($activeCard?.contains(event.target) && event.relatedTarget?.closest('.capture, .inspection-close')) event.stopPropagation()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    window.addEventListener('popstate', onHistory)
    window.addEventListener('hashchange', onHistory)
    window.addEventListener('wheel', skipOnInput, { passive: false })
    window.addEventListener('touchmove', skipOnInput, { passive: false })
    window.addEventListener('keydown', skipOnInput)
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('blur', guardBlur, true)
    if (import.meta.env.DEV) window.__journey = journey
    return () => {
      disposed = true
      cancelAnimationFrame(openingFrame)
      cancelAnimationFrame(travelFrame)
      history.scrollRestoration = previousRestoration
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('popstate', onHistory)
      window.removeEventListener('hashchange', onHistory)
      window.removeEventListener('wheel', skipOnInput)
      window.removeEventListener('touchmove', skipOnInput)
      window.removeEventListener('keydown', skipOnInput)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('blur', guardBlur, true)
    }
  })
</script>

{#await townScene then module}
  {#if module}<module.default {openingAmount} onready={() => ready()} onerror={() => ready(true)} />{/if}
{/await}
<div class="journey-distance" style:height={`${(journey.timeline.length + 1) * height}px`} aria-hidden="true"></div>
<JourneyHud {openPanel} {navigate} />
<main class="journey-stage" class:concealed={journey.panel === 'search' || !!selectedSearchCard} tabindex="-1" aria-label="卡牌旅程" inert={!!journey.panel || !!selectedSearchCard} data-stop={stop?.id ?? 'travel'}>
  {#if !journey.sceneReady}
    <div class="opening-title loading" role="status"><span class="pokeball-symbol"></span><p class="eyebrow">一段閃閃發光的冒險</p><h1>寶可夢<br />卡牌展示館</h1><p>正在前往真新鎮…</p><a href="https://github.com/simeydotme/pokemon-cards-css" target="_blank" rel="noreferrer">卡牌效果 by simeydotme ↗</a></div>
  {:else if journey.opening || (!stop && journey.current.position < .6)}
    <div class="opening-title"><p class="eyebrow">從真新鎮，出發。</p><h1>每一張卡牌，<br />都是新的冒險。</h1><p>沿著熟悉的道路，遇見閃閃發光的寶可夢。</p><div class="series-pick"><SeriesSwitch value={journey.series} onchange={switchSeries} /></div><button class="primary" onclick={() => navigate(journey.stops[0].id)}>{journey.opening ? '略過開場' : '開始旅程'} <span aria-hidden="true">↓</span></button><small>向下捲動，開始旅程</small><a href="https://github.com/simeydotme/pokemon-cards-css" target="_blank" rel="noreferrer">卡牌效果 by simeydotme ↗</a></div>
  {:else if stop && cards.length}
    <div class="stop-heading" class:concealed={journey.expanded}><p class="eyebrow">{revisit ? '再次相遇' : '發現新的卡種'} <span> / {String(stop.index + 1).padStart(2, '0')}</span></p><h1>{stop.name}</h1></div>
    {#if !currentCards.length}
      <div class="data-status" role="alert">這一站的卡牌資料載入失敗。<button onclick={loadCards}>重新載入卡牌</button></div>
    {:else if reveal}
      {#key stop.id}
        <JourneyCarousel cards={currentCards} section={stop} />
        <div class="professor-slot" class:concealed={journey.expanded}><ProfessorDialog text={stop.blurb} instant={revisit} /></div>
      {/key}
    {/if}
  {:else if !stop}
    <div class="flying-note"><span aria-hidden="true">↟</span><p>沿路探索中</p><small>下一站 · {journey.current.nearby?.name}</small></div>
  {/if}
  {#if loadError}<div class="data-status" role="alert">卡牌資料載入失敗。<button onclick={loadCards}>重新載入卡牌</button></div>
  {:else if !cards.length && journey.sceneReady}<div class="data-status" role="status">正在整理卡牌…</div>{/if}
  {#if sceneFailed}<p class="scene-fallback">靜態地景 · 卡牌旅程仍可繼續</p>{/if}
</main>

{#if journey.panel}
  <div class="panel-backdrop" class:concealed={!!selectedSearchCard} aria-hidden="true"></div>
  <div tabindex="-1" class="game-panel" class:concealed={!!selectedSearchCard} class:map-panel={journey.panel === 'map'} role="dialog" aria-modal="true" aria-labelledby="tool-title" bind:this={panelRoot} inert={!!selectedSearchCard}>
    <header class="panel-header"><div><p class="eyebrow">冒險隨身工具{journey.panel === 'search' ? ` · 目前為${journey.seriesInfo.full}` : ''}</p><h2 id="tool-title">{journey.panel === 'map' ? '旅程地圖' : journey.panel === 'search' ? '搜尋卡牌' : '我的圖鑑'}</h2></div><button class="panel-close" aria-label="關閉面板" onclick={() => closePanel()}>×</button></header>
    <nav class="panel-tabs" aria-label="切換工具">{#each [['map','旅程地圖'], ['search','搜尋卡牌'], ['pokedex','我的圖鑑']] as [name,label]}<button class:chosen={journey.panel === name} aria-pressed={journey.panel === name} onclick={() => openPanel(name, null)}>{label}</button>{/each}</nav>
    <div class="panel-scroll" bind:this={searchView}>
      {#if journey.panel === 'map'}<JourneyMap {navigate} {switchSeries} />
      {:else if journey.panel === 'search'}<Search /><SearchResults selectCard={selectSearchCard} />
      {:else}<PokedexDrawer {selectEntry} />{/if}
    </div>
  </div>
{/if}
{#if selectedSearchCard}
  <div class="inspection-shade" aria-hidden="true"></div>
  <div class="search-inspection" bind:this={modalCard} role="dialog" aria-modal="true" aria-label={`檢視 ${selectedSearchCard.name}`}><JourneyCard card={selectedSearchCard} /></div>
{/if}
{#if journey.expanded}<button class="inspection-close" aria-label="收合卡牌" onpointerdown={e => e.preventDefault()} onclick={() => closeCard()}>× <span>收合卡牌</span></button>{/if}
<CaptureButton />
<div class="journey-fade" class:on={journey.jumping} aria-hidden="true"></div>
