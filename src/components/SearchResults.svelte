<script>
  import { search } from '../stores/search.svelte.js'
  import { journey } from '../stores/journey.svelte.js'
  let { selectCard } = $props()
  /** TCGdex 部分卡牌只有 high.webp 沒有 low.webp，縮圖 404 或連線中斷時改載大圖（僅切換一次，避免無限重試） */
  function fallback(event) {
    const img = event.currentTarget
    const large = img.dataset.large
    if (!large || img.src === large) return
    img.src = large
  }
</script>
<section class="search-results" aria-label="搜尋結果" aria-live="polite">
  {#if search.status === 'idle'}
    <div class="search-empty"><span aria-hidden="true">⌕</span><h3>下一張心動的卡牌</h3><p>輸入中英文名稱，或選擇卡種，<br />尋找你的下一次相遇。</p></div>
  {:else if search.status === 'loading'}<p class="result-message">正在尋找卡牌…</p>
  {:else if search.status === 'no-name'}<p class="result-message">譯名對照裡找不到「{search.query.trim()}」，請確認名稱或改用英文。</p>
  {:else if search.status === 'error'}<p class="result-message" role="alert">搜尋服務暫時無法連線，請稍後重試。</p><button onclick={() => search.retry()}>重新搜尋</button>
  {:else if search.status === 'empty'}<p class="result-message">在{journey.seriesInfo.full}找不到這張卡牌，請試試其他名稱或卡種，或先切換系列。</p>
  {:else}
    <p class="result-message">{journey.seriesInfo.full} · {search.matched.length ? search.matched.map(m => m.zh).join('、') + ' · ' : ''}{search.foilName ? search.foilName + ' · ' : ''}找到 {search.results.length} 張卡牌</p>
    <div class="result-grid">
      {#each search.results as card (card.id)}
        <button class="result" onclick={e => selectCard(card, e.currentTarget)} aria-label={`放大 ${card.zh || card.name}`}><img src={card.images.small ?? card.images.large} alt={card.name} loading="lazy" data-large={card.images.large} onerror={fallback} /><strong>{card.zh || card.name}</strong><small>{card.zh ? card.name : card.set}</small></button>
      {/each}
    </div>
  {/if}
</section>
<style>
  .result-message { margin: 24px 0 20px; font-size: 14px; color: var(--ink-soft); }
  .result-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px 12px; }
  .result { min-width: 0; border: 0; padding: 0; background: none; display: grid; align-content: start; justify-items: center; gap: 5px; }
  .result img { width: 100%; aspect-ratio: 660 / 921; object-fit: contain; border-radius: 7px; transition: translate .2s; } .result:hover img { translate: 0 -5px; }
  strong { font: 14px var(--font-display); } small { color: var(--ink-soft); font-size: 11px; }
  .search-empty { text-align: center; padding: 70px 0; color: var(--ink-soft); } .search-empty > span { display: block; font-size: 72px; color: #93a58e; } h3 { color: var(--ink); font-size: 24px; margin-bottom: 12px; } .search-empty p { font-size: 14px; }
  @media(max-width:450px) { .result-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
