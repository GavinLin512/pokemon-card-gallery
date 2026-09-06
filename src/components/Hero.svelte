<script>
  // 頁首（PLAN §6）：站名、副標、操作提示、展示卡（cards[0]，showcase 自動展示）。
  import Card from '../lib/components/CardProxy.svelte'

  let { card } = $props()
</script>

<header class="hero">
  <div class="intro">
    <h1 class="name">寶可夢卡牌展示館</h1>
    <p class="sub">純白的開始之色</p>
    <p class="hint">點擊卡牌可放大細看</p>
  </div>
  <div class="showcase">
    {#if card}
      <Card
        id={card.id}
        name={card.name}
        set={card.set}
        number={card.number}
        types={card.types}
        supertype={card.supertype}
        subtypes={card.subtypes}
        rarity={card.rarity}
        isReverse={card.isReverse}
        showcase={true}
      />
    {/if}
  </div>
</header>

<style>
  .hero {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
    align-items: center;
    padding: 32px 0 8px;
  }

  .intro {
    text-align: center;
  }

  .name {
    font-size: clamp(32px, 8vw, 56px);
    color: #fff;
    text-shadow:
      0 3px 0 var(--title-shadow),
      0 6px 18px rgba(0, 0, 0, 0.3);
    letter-spacing: 0.04em;
  }

  .sub {
    margin-top: 8px;
    font-family: var(--font-display);
    font-size: 18px;
    color: var(--wood-dark);
    background: var(--paper);
    display: inline-block;
    padding: 2px 14px;
    border-radius: 999px;
    box-shadow: var(--ui-shadow);
  }

  .hint {
    margin-top: 18px;
    font-size: 15px;
    color: #fff;
    opacity: 0.9;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  }

  .showcase {
    max-width: 320px;
    width: 70vw;
    margin: 0 auto;
    transform-style: preserve-3d;
    position: relative;
    z-index: 2;
  }

  @media (min-width: 900px) {
    .hero {
      grid-template-columns: 1.4fr 1fr;
      gap: 40px;
      padding: 56px 24px 16px;
      min-height: 60vh;
    }
    .intro {
      text-align: left;
    }
    .sub {
      font-size: 20px;
    }
    .hint {
      font-size: 17px;
    }
    .showcase {
      max-width: 360px;
      width: 100%;
    }
  }
</style>
