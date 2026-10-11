<script>
  // 專案共用線條圖示：24 格、描邊 1.8、圓端點，與 JourneyHud 的時段、音樂圖示同一套；顏色跟隨 currentColor。
  let { name, size = 24 } = $props()
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'search'}
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  {:else if name === 'close'}
    <path d="M6 6l12 12M18 6 6 18" />
  {/if}
</svg>

<style>
  svg { display: block; flex-shrink: 0; }
</style>
