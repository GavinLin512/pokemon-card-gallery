<script>
  import { journeyStops } from '../config/journeyStops.js'
  import { journey } from '../stores/journey.svelte.js'
  let { navigate } = $props()
</script>
<p class="map-intro">從真新鎮出發，沿著一號道路前往常磐市。<br />選一個停靠點，繼續你的卡牌旅程。</p>
<div class="map-regions">
  {#each ['真新鎮', '一號道路', '常磐市'] as location, region}
    <section class="map-region">
      <h3><span aria-hidden="true">{['⌂', '♧', '⚑'][region]}</span>{location}</h3>
      <ol>
        {#each journeyStops.filter(s => s.location === location) as stop}
          <li><button class:here={journey.current.stop?.id === stop.id} aria-current={journey.current.stop?.id === stop.id ? 'step' : undefined} onclick={() => navigate(stop.id)}><span class="map-pin" class:visited={journey.visited[stop.id]}>{String(stop.index + 1).padStart(2, '0')}</span><span>{stop.name}<small>{journey.current.stop?.id === stop.id ? '你在這裡' : journey.visited[stop.id] ? '已到訪' : '等待探索'}</small></span><span class="map-arrow" aria-hidden="true">↗</span></button></li>
        {/each}
      </ol>
    </section>
  {/each}
</div>
<style>
  .map-intro { color: var(--ink-soft); font-size: 14px; margin: 4px 0 28px; }
  .map-regions { display: grid; grid-template-columns: 1fr 1.2fr 1fr; gap: 24px; }
  h3 { display: flex; gap: 9px; align-items: center; padding-bottom: 14px; border-bottom: 2px solid var(--ink); font-size: 22px; }
  h3 > span { font-size: 26px; color: #457d63; }
  ol { list-style: none; padding: 14px 0 0; margin: 0; }
  li { position: relative; } li:not(:last-child)::after { content: ''; position: absolute; top: 48px; left: 25px; bottom: -12px; border-left: 2px dashed #768d7755; }
  button { display: flex; align-items: center; gap: 10px; position: relative; width: 100%; text-align: left; background: transparent; border: 2px solid transparent; border-radius: 10px; padding: 8px 4px; font-family: var(--font-display); font-size: 14px; }
  button:hover { background: #e7ebdc; } button.here { background: #f9e0d5; border-color: var(--red); }
  .map-pin { flex: 0 0 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; border: 2px solid #789080; background: var(--paper); position: relative; z-index: 1; color: var(--ink-soft); }
  .map-pin.visited { background: #d7e8cf; color: #345847; border-color: #345847; } .here .map-pin { background: var(--red); color: white; border-color: var(--ink); }
  small { display: block; color: var(--ink-soft); font-size: 10px; margin-top: 3px; } .map-arrow { margin-left: auto; color: var(--red); }
  @media(max-width:899px) { .map-regions { grid-template-columns: 1fr; gap: 26px; } .map-intro { font-size: 12px; } button { font-size: 16px; padding: 10px 4px; } }
</style>
