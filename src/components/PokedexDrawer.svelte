<script>
  // 我的圖鑑抽屜（PLAN §9.1）：桌機右側滑入 360px，手機底部滑出 70vh。
  import { tick } from 'svelte'
  import { pokedex } from '../stores/pokedex.svelte.js'
  import { search } from '../stores/search.svelte.js'
  import { cards } from '../stores/cards.svelte.js'

  let closeButton = $state()

  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  function thumb(entry) {
    const known = cards.get(entry.id)
    return known?.images?.small ?? `https://images.pokemontcg.io/${entry.set}/${entry.number}.png`
  }

  async function go(entry) {
    pokedex.open = false
    if (entry.sectionId) {
      if (search.active) {
        search.clear()
        await tick()
      }
      document.getElementById(entry.sectionId)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    } else {
      search.query = entry.name
      document.getElementById('card-search')?.focus()
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') pokedex.open = false
  }

  $effect(() => {
    if (pokedex.open) {
      tick().then(() => closeButton?.focus())
    }
  })
</script>

<svelte:window onkeydown={onKeydown} />

<button type="button" class="backdrop" class:open={pokedex.open} onclick={() => (pokedex.open = false)} aria-label="關閉圖鑑" tabindex="-1"></button>

<aside class="drawer" class:open={pokedex.open} aria-label="我的圖鑑" aria-hidden={!pokedex.open}>
  <header class="head">
    <h2 class="title">我的圖鑑</h2>
    <p class="count">已捕捉 {pokedex.count} 張</p>
    <button bind:this={closeButton} type="button" class="close" onclick={() => (pokedex.open = false)} aria-label="關閉圖鑑" tabindex={pokedex.open ? 0 : -1}>×</button>
  </header>

  {#if pokedex.count === 0}
    <p class="empty">還沒有捕捉到任何卡牌，放大一張卡牌試試看！</p>
  {:else}
    <ul class="list">
      {#each pokedex.entries as entry (entry.id)}
        <li>
          <button type="button" class="item" onclick={() => go(entry)} tabindex={pokedex.open ? 0 : -1} title={entry.sectionId ? '前往展示區' : '搜尋這張卡牌'}>
            <img class="thumb" src={thumb(entry)} alt="" loading="lazy" />
            <span class="name">{entry.name}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</aside>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    border: 0;
    padding: 0;
    min-width: 0;
    min-height: 0;
    background: rgba(10, 20, 40, 0.35);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
  }
  .backdrop.open {
    opacity: 1;
    pointer-events: auto;
  }

  .drawer {
    position: fixed;
    z-index: 210;
    left: 0;
    right: 0;
    bottom: 0;
    height: 70vh;
    display: flex;
    flex-direction: column;
    background: var(--paper);
    color: var(--ink);
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.25);
    transform: translateY(105%);
    transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.3, 1);
    visibility: hidden;
  }
  .drawer.open {
    transform: translateY(0);
    visibility: visible;
  }

  .head {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 2px 12px;
    padding: 16px 16px 8px 20px;
    border-bottom: 1px solid rgba(43, 47, 54, 0.1);
  }
  .title {
    font-size: 22px;
    color: var(--wood-dark);
  }
  .count {
    grid-column: 1;
    font-size: 14px;
    color: var(--ink-soft);
  }
  .close {
    grid-column: 2;
    grid-row: 1 / span 2;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    font-size: 28px;
    line-height: 1;
    color: var(--ink-soft);
  }
  .close:hover {
    background: rgba(0, 0, 0, 0.06);
  }

  .empty {
    padding: 32px 24px;
    text-align: center;
    color: var(--ink-soft);
    line-height: 1.7;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 12px;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 10px;
    -webkit-overflow-scrolling: touch;
  }
  .item {
    width: 100%;
    padding: 6px 4px 8px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    display: grid;
    justify-items: center;
    gap: 4px;
  }
  .item:hover {
    background: rgba(0, 0, 0, 0.05);
  }
  .item:focus-visible {
    outline: 3px solid var(--accent);
  }
  .thumb {
    width: 100%;
    aspect-ratio: 5 / 7;
    object-fit: contain;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.04);
  }
  .name {
    font-size: 12px;
    line-height: 1.3;
    text-align: center;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (min-width: 900px) {
    .drawer {
      left: auto;
      top: 0;
      bottom: 0;
      width: 360px;
      height: auto;
      border-radius: 20px 0 0 20px;
      transform: translateX(105%);
      box-shadow: -8px 0 32px rgba(0, 0, 0, 0.25);
    }
    .drawer.open {
      transform: translateX(0);
    }
    .list {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
