<script>
  // 真新鎮場景（PLAN §8）：掛載 canvas、串接日夜 store、卡牌放大時暫停視差、手機讀陀螺儀。
  import { onMount } from 'svelte'
  import { activeCard } from '../lib/stores/activeCard.js'
  import { orientation } from '../lib/stores/orientation.js'
  import { dayCycle } from '../stores/dayCycle.svelte.js'
  import { viewport } from '../stores/viewport.svelte.js'
  import { cards } from '../stores/cards.svelte.js'
  import { weatherKeyFor } from '../config/weather.js'
  import { createTown } from './town.js'

  let canvas = $state()
  let town = $state(null)

  onMount(() => {
    if (!viewport.webgl || !canvas) return
    const instance = createTown(canvas, {
      lowPower: viewport.lowPower,
      reducedMotion: viewport.reducedMotion,
      isMobile: viewport.isMobile,
      period: dayCycle.period
    })
    town = instance
    if (import.meta.env.DEV) window.__town = instance
    return () => {
      instance.destroy()
      town = null
    }
  })

  $effect(() => {
    town?.setPeriod(dayCycle.period)
  })
  $effect(() => {
    town?.setParallaxFrozen(!!$activeCard)
  })
  $effect(() => {
    if (!town) return
    const card = cards.fromElement($activeCard)
    town.setWeather($activeCard ? weatherKeyFor(card) : null)
  })
  $effect(() => {
    town?.setReducedMotion(viewport.reducedMotion)
  })
  $effect(() => {
    town?.setMobile(viewport.isMobile)
  })
  $effect(() => {
    if (!town || !viewport.isMobile) return
    const { gamma, beta } = $orientation.relative
    town.setTilt(gamma, beta)
  })
</script>

{#if viewport.webgl}
  <canvas class="town" bind:this={canvas} aria-hidden="true"></canvas>
{/if}

<style>
  .town {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    pointer-events: none;
    display: block;
  }
</style>
