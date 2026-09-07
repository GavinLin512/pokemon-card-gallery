<script>
  // 搜尋結果（PLAN §6.2、§6.3）。搜尋中時取代展示區顯示。
  import Card from '../lib/components/CardProxy.svelte'
  import CardGrid from './CardGrid.svelte'
  import { search } from '../stores/search.svelte.js'
</script>

<section class="results" aria-live="polite">
  {#if search.status === 'loading'}
    <p class="msg">正在尋找卡牌…</p>
  {:else if search.status === 'no-name'}
    <p class="msg">譯名對照裡找不到「{search.query.trim()}」，請確認名稱或改用英文</p>
  {:else if search.status === 'done'}
    {#if search.foil}
      <p class="msg">
        閃卡類型：{search.foilName}
        <button type="button" class="unset" onclick={() => (search.foil = null)}>取消</button>
      </p>
    {/if}
    {#if search.matched.length}
      <p class="msg">找到：{search.matched.map((m) => m.zh).join('、')}</p>
    {/if}
    <CardGrid>
      {#each search.results as card (card.id)}
        <div class="result">
          <Card
            id={card.id}
            name={card.name}
            set={card.set}
            number={card.number}
            img={card.images.large}
            types={card.types}
            supertype={card.supertype}
            subtypes={card.subtypes}
            rarity={card.rarity}
            isReverse={card.isReverse}
          />
          <p class="caption">
            <span class="en">{card.name}</span>
            {#if card.zh}<span class="zh">{card.zh}</span>{/if}
          </p>
        </div>
      {/each}
    </CardGrid>
  {:else if search.status === 'empty' || search.status === 'error'}
    <p class="msg">{search.foil ? `「${search.foilName}」裡找不到這張卡牌` : '找不到這張卡牌，請試試英文名稱'}</p>
    <CardGrid>
      <Card
        id="basep-16"
        name="Computer Error"
        set="basep"
        number="16"
        img="https://images.pokemontcg.io/basep/16_hires.png"
        supertype="Trainer"
        subtypes="Rocket's Secret Machine"
        rarity="Promo"
        isReverse={false}
      />
    </CardGrid>
  {/if}
</section>

<style>
  .results {
    padding-top: 24px;
  }

  .msg {
    margin: 8px auto 0;
    max-width: 720px;
    padding: 10px 16px;
    text-align: center;
    font-family: var(--font-display);
    font-size: 17px;
    color: var(--ink);
    background: var(--paper);
    border-radius: 12px;
    box-shadow: var(--ui-shadow);
  }

  .unset {
    margin-left: 8px;
    min-height: 32px;
    padding: 0 12px;
    font: inherit;
    font-size: 14px;
    color: var(--wood-dark);
    background: #fff;
    border: 2px solid var(--ui-border);
    border-radius: 999px;
  }
  .unset:hover {
    border-color: var(--accent-dark);
  }

  .result {
    display: grid;
    gap: 10px;
    transform-style: preserve-3d;
  }

  .caption {
    text-align: center;
    line-height: 1.3;
  }
  .en {
    display: block;
    font-size: 14px;
    color: #fff;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }
  .zh {
    display: inline-block;
    margin-top: 4px;
    padding: 1px 10px;
    font-size: 13px;
    color: var(--wood-dark);
    background: var(--paper);
    border-radius: 999px;
  }

  /* 結果卡牌有外層容器（含中文名標注），手機輪播時限制寬度並置中 */
  @media (max-width: 900px) {
    .result {
      max-width: 340px;
      margin: 0 auto;
    }
  }
</style>
