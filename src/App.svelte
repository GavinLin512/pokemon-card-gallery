<script>
  import { onMount } from 'svelte'
  import Card from './lib/components/CardProxy.svelte'
  let cards = $state([])
  onMount(async () => {
    const res = await fetch('/data/cards.json')
    cards = (await res.json()).slice(0, 4)
  })
</script>

<main style="padding:50px;display:grid;grid-template-columns:repeat(4,1fr);gap:40px">
  {#each cards as card (card.id)}
    <Card id={card.id} name={card.name} set={card.set} number={card.number}
      types={card.types} supertype={card.supertype} subtypes={card.subtypes}
      rarity={card.rarity} isReverse={card.isReverse} />
  {/each}
</main>
