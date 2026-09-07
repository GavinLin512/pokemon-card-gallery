<script>
  // 頁面骨架與狀態組裝（PLAN §6）。
  import { onMount, tick } from 'svelte'
  import { sections, sliceCards, buildCardSectionMap } from './config/sections.js'
  import { search } from './stores/search.svelte.js'
  import { cards as cardRegistry } from './stores/cards.svelte.js'
  import CaptureButton from './components/CaptureButton.svelte'
  import PokedexDrawer from './components/PokedexDrawer.svelte'
  import TopBar from './components/TopBar.svelte'
  import Hero from './components/Hero.svelte'
  import Signpost from './components/Signpost.svelte'
  import Section from './components/Section.svelte'
  import SearchResults from './components/SearchResults.svelte'

  // 場景與 three.js 延後載入，不阻擋介面首屏
  const townScene = import('./scene/TownScene.svelte')

  let cards = $state([])
  let loadError = $state(false)

  const showcase = $derived(cards[0])
  const grouped = $derived(sections.map((section) => ({ section, cards: sliceCards(cards, section) })))

  onMount(async () => {
    try {
      const res = await fetch('/data/cards.json')
      if (!res.ok) throw new Error(res.statusText)
      cards = await res.json()
      cardRegistry.register(cards)
      cardRegistry.setSectionMap(buildCardSectionMap(cards))
      // 帶 #錨點 進站時，等展示區掛載後再捲動過去
      const hash = decodeURIComponent(location.hash.slice(1))
      if (hash && sections.some((s) => s.id === hash)) {
        await tick()
        document.getElementById(hash)?.scrollIntoView({ block: 'start' })
      }
    } catch {
      loadError = true
    }
  })
</script>

<span id="top" class="sr-only" aria-hidden="true"></span>
{#await townScene then { default: TownScene }}
  <TownScene />
{/await}
<TopBar />

<main class="page">
  {#if search.active}
    <SearchResults />
  {:else}
    <Hero card={showcase} />
    {#if cards.length}
      <Signpost {sections} />
      {#each grouped as g (g.section.id)}
        <Section section={g.section} cards={g.cards} />
      {/each}
    {:else if loadError}
      <p class="status">卡牌資料載入失敗，請重新整理頁面。</p>
    {:else}
      <p class="status">正在整理卡牌…</p>
    {/if}
  {/if}
</main>

<CaptureButton />
<PokedexDrawer />

<style>
  .status {
    margin: 40px auto;
    max-width: 480px;
    padding: 12px 20px;
    text-align: center;
    font-family: var(--font-display);
    font-size: 18px;
    color: var(--ink);
    background: var(--paper);
    border-radius: 12px;
    box-shadow: var(--ui-shadow);
  }
</style>
