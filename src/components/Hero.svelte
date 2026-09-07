<script>
  // 頁首（PLAN §6）：站名、副標、操作提示、展示卡（cards[0]，showcase 自動展示）。
  import Card from '../lib/components/CardProxy.svelte'

  let { card } = $props()
</script>

<header class="hero">
  <div class="intro">
    <h1 class="name">寶可夢卡牌展示館</h1>
    <a
      class="sub"
      href="https://github.com/simeydotme/pokemon-cards-css"
      target="_blank"
      rel="noopener noreferrer"
    >
      卡牌效果 by simeydotme
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    </a>
    <p class="hint">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 11.24V7.5a2.5 2.5 0 0 1 5 0v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z" />
      </svg>
      點擊卡牌可放大細看
    </p>
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

  /* 副標位置改放閃卡效果的原作者連結（PLAN §6） */
  .sub {
    margin-top: 8px;
    font-family: var(--font-display);
    font-size: 18px;
    color: var(--wood-dark);
    background: var(--paper);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 2px 14px;
    border-radius: 999px;
    box-shadow: var(--ui-shadow);
    text-decoration: none;
  }
  .sub:hover {
    text-decoration: underline;
  }
  .sub svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }

  /* 操作提示用黃色標籤，白天亮藍天空與夜空下都要看得清楚 */
  .hint {
    margin: 18px auto 0;
    width: fit-content;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 999px;
    font-family: var(--font-display);
    font-size: 16px;
    color: var(--ink);
    background: var(--accent);
    border: 2px solid var(--accent-dark);
    box-shadow:
      0 3px 0 var(--accent-dark),
      0 6px 16px rgba(0, 0, 0, 0.25);
    animation: hint-bob 2.2s ease-in-out infinite;
  }
  .hint svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
    flex: none;
  }
  @keyframes hint-bob {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-4px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .hint {
      animation: none;
    }
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
    .sub svg {
      width: 20px;
      height: 20px;
    }
    .hint {
      margin-inline: 0;
      font-size: 18px;
      padding: 10px 20px;
    }
    .showcase {
      max-width: 360px;
      width: 100%;
    }
  }
</style>
