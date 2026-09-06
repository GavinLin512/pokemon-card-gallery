<script>
  // 展示區（PLAN §6、§11）：標題、博士對話框、卡牌格；卡牌格以 IntersectionObserver 延遲掛載，
  // 進入視窗前 200px 掛載，離開 800px 以上卸載，卸載時保留量測高度避免捲動跳動。
  import Card from '../lib/components/CardProxy.svelte'
  import CardGrid from './CardGrid.svelte'
  import ProfessorDialog from './ProfessorDialog.svelte'

  let { section, cards } = $props()

  let root = $state()
  let gridWrap = $state()
  let mounted = $state(false)
  // 未量測前的估計高度：依欄寬推算，掛載後以實際高度取代
  // svelte-ignore state_referenced_locally
  let minHeight = $state(estimateHeight(cards.length, typeof window === 'undefined' ? 1200 : Math.min(window.innerWidth, 1200)))

  function estimateHeight(count, width) {
    const desktop = width >= 900
    const cols = desktop ? 3 : 1
    const gap = 50
    const cardW = desktop ? (width - 100 - 2 * width * 0.02) / 3 : Math.min(width, 900) - 100
    // 實測卡牌高約為寬的 1.3 倍（含卡牌 CSS 的內距）
    const rowH = cardW * 1.3 + gap
    // 手機為三張扇形疊一列
    const rows = Math.ceil(count / 3) || 1
    return Math.round(rows * rowH + 100 - gap)
  }

  $effect(() => {
    if (!root) return
    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) mounted = true
      },
      { rootMargin: '200px 0px' }
    )
    const far = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && mounted) {
          if (gridWrap?.offsetHeight) minHeight = gridWrap.offsetHeight
          mounted = false
        }
      },
      { rootMargin: '800px 0px' }
    )
    near.observe(root)
    far.observe(root)
    return () => {
      near.disconnect()
      far.disconnect()
    }
  })
</script>

<section class="section" id={section.id} bind:this={root} aria-labelledby="{section.id}-title">
  <h2 class="title" id="{section.id}-title">{section.name}</h2>
  <ProfessorDialog text={section.blurb} />

  <div class="grid-wrap" bind:this={gridWrap} style:min-height="{mounted ? 0 : minHeight}px">
    {#if mounted}
      <CardGrid>
        {#each cards as card (card.id)}
          {#if section.passSet}
            <Card
              id={card.id}
              name={card.name}
              number={card.number}
              set={card.set}
              types={card.types}
              supertype={card.supertype}
              subtypes={card.subtypes}
              rarity={card.rarity}
              isReverse={section.isReverse}
            />
          {:else}
            <Card
              id={card.id}
              name={card.name}
              img={card.images.large}
              number={card.number}
              types={card.types}
              supertype={card.supertype}
              subtypes={card.subtypes}
            />
          {/if}
        {/each}
      </CardGrid>
    {/if}
  </div>
</section>

<style>
  .section {
    scroll-margin-top: calc(var(--topbar-h) + var(--signpost-h) + 12px);
    padding-top: 24px;
  }

  .title {
    font-size: 28px;
    color: #fff;
    text-shadow:
      0 2px 0 var(--title-shadow),
      0 4px 14px rgba(0, 0, 0, 0.25);
    padding-left: 4px;
  }

  @media (min-width: 900px) {
    .section {
      padding-top: 40px;
    }
    .title {
      font-size: 36px;
    }
  }
</style>
