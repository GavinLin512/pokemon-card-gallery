<script>
  import { SERIES } from '../config/series.js'
  let { value, onchange, label = '選擇卡牌系列' } = $props()
</script>
<div class="series-switch" role="group" aria-label={label}>
  {#each SERIES as series (series.id)}
    <button class:chosen={series.id === value} aria-pressed={series.id === value} onclick={() => onchange(series.id)}>{series.full}</button>
  {/each}
</div>
<style>
  .series-switch { display: inline-flex; gap: 4px; padding: 4px; border: 2px solid var(--ink); border-radius: 12px; background: var(--paper); box-shadow: 0 4px 0 var(--ink); }
  button { min-height: 36px; padding: 0 16px; border: 0; border-radius: 8px; background: transparent; color: var(--ink); font: 14px var(--font-display); }
  button:hover { background: #e7ebdc; }
  .chosen, .chosen:hover { background: var(--red); color: #fffaf0; }
</style>
