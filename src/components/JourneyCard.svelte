<script>
  import Card from '../lib/components/CardProxy.svelte'
  import Card151 from '../lib151/components/Card.svelte'
  import { is151, resolve151 } from '../config/foils151.js'
  let { card, section = null } = $props()
  const era151 = $derived(is151(card))
  const foil151 = $derived(era151 ? resolve151(card, section?.isReverse ?? card.isReverse ?? false) : null)
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
<div class="journey-card" class:era-151={era151} use:observe>
  {#key `${card.id}-${version}`}
    {#if era151}
      <Card151 id={card.id} name={card.name} img={card.images.large} set={card.set} number={card.number} types={card.types} supertype={card.supertype} subtypes={card.subtypes} rarity={foil151.rarity} foil={foil151.foil} mask={foil151.mask} />
    {:else if section && !section.passSet}
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
