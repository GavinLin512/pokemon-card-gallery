<script>
  import { pokedex } from '../stores/pokedex.svelte.js'
  import { cards } from '../stores/cards.svelte.js'
  let { selectEntry } = $props()
  function thumb(entry) {
    return cards.get(entry.id)?.images?.small ?? `https://images.pokemontcg.io/${entry.set}/${entry.number}.png`
  }
</script>
<p class="dex-count">已捕捉 {pokedex.count} 張 <span>・儲存在這個瀏覽器</span></p>
{#if !pokedex.count}
  <div class="dex-empty"><span class="pokeball-symbol" aria-hidden="true"></span><h3>旅程的第一個夥伴</h3><p>放大一張喜歡的卡牌，<br />投出精靈球，開始你的圖鑑！</p></div>
{:else}
  <ul class="dex-grid">
    {#each pokedex.entries as entry (entry.id)}
      <li><button onclick={() => selectEntry(entry)} aria-label={`前往 ${entry.name}`}><img src={thumb(entry)} alt="" loading="lazy" /><span>{entry.name}</span></button></li>
    {/each}
  </ul>
{/if}
<style>
  .dex-count { font-size: 14px; margin-bottom: 24px; } .dex-count > span { font-size: 11px; color: var(--ink-soft); }
  .dex-empty { display: grid; justify-items: center; gap: 20px; text-align: center; padding: 80px 0; } .dex-empty :global(.pokeball-symbol) { width: 60px; height: 60px; opacity: .6; } h3 { font-size: 24px; } .dex-empty p { font-size: 14px; color: var(--ink-soft); }
  .dex-grid { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px 12px; }
  button { display: grid; gap: 8px; justify-items: center; padding: 0; border: 0; background: transparent; width: 100%; } img { width: 100%; aspect-ratio: 660 / 921; object-fit: contain; border-radius: 7px; } button:hover img { opacity: .8; } button span { font: 13px var(--font-display); }
  @media(max-width:450px) { .dex-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
