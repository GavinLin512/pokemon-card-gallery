<script>
  import Card from '../lib/components/CardProxy.svelte'
  let { card, section = null } = $props()
  let failed = $state(false)
  let version = $state(0)
  function observe(node) {
    const onError = event => {
      if (event.target.matches('.card__front img')) failed = true
    }
    node.addEventListener('error', onError, true)
    return { destroy() { node.removeEventListener('error', onError, true) } }
  }
</script>
<div class="journey-card" use:observe>
  {#key `${card.id}-${version}`}
    {#if section && !section.passSet}
      <Card id={card.id} name={card.name} img={card.images.large} number={card.number} types={card.types} supertype={card.supertype} subtypes={card.subtypes} />
    {:else}
      <Card id={card.id} name={card.name} img={section ? undefined : card.images.large} set={card.set} number={card.number} types={card.types} supertype={card.supertype} subtypes={card.subtypes} rarity={card.rarity} isReverse={section?.isReverse ?? card.isReverse} />
    {/if}
  {/key}
  {#if failed}
    <div class="image-error" role="status"><p>{card.name}<br />這張卡牌的圖片載入失敗</p><button onclick={() => { failed = false; version++ }}>重新載入圖片</button></div>
  {/if}
</div>
<style>
  .journey-card { position: relative; width: 100%; }
  .image-error { position: absolute; inset: 0; display: grid; align-content: center; gap: 16px; text-align: center; background: var(--paper); border: 2px solid var(--ink); border-radius: 16px; padding: 20px; color: var(--ink); }
</style>
