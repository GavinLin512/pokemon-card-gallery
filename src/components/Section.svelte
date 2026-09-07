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
    const gap = 50
    // 實測卡牌高約為寬的 1.3 倍（含卡牌 CSS 的內距）
    if (!desktop) {
      // 手機為輪播，一次一張，寬 78% 最寬 360px，上下各留輪播內距與分頁列
      return Math.round(Math.min(width * 0.78, 360) * 1.3 + 34 + 56)
    }
    const cardW = (width - 100 - 2 * width * 0.02) / 3
    const rowH = cardW * 1.3 + gap
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
    scroll-margin-top: calc(var(--topbar-h) + 12px);
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
