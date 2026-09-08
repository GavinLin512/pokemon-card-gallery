<script>
  // 搜尋框（PLAN §6.2、§6.3、§6.4）：輸入名稱，或展開面板點選閃卡類型。狀態與查詢在 stores/search.svelte.js。
  import { activeCard } from '../lib/stores/activeCard.js'
  import { search } from '../stores/search.svelte.js'
  import { FOIL_TYPES } from '../config/tcgdex.js'

  let open = $state(false)
  let root = $state()

  // 面板開合不用 blur 判斷（iOS 點按鈕不會取得焦點，blur 會搶在 click 之前關掉面板），改監聽外部點擊與 Escape。
  $effect(() => {
    if (!open) return
    const onPointer = (e) => {
      if (!root.contains(e.target)) open = false
    }
    const onKey = (e) => {
      if (e.key === 'Escape' && !$activeCard && open) { open = false; e.stopImmediatePropagation() }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey, true)
    }
  })

  function pick(id) {
    search.foil = id
    open = false
  }
</script>

<form class="search" role="search" onsubmit={(e) => e.preventDefault()} bind:this={root}>
  <label class="sr-only" for="card-search">搜尋卡牌</label>
  <input
    id="card-search"
    type="search"
    autocomplete="off"
    enterkeyhint="search"
    placeholder={search.foil ? `${search.foilName}：可再輸入名稱` : '輸入寶可夢名稱，例如：皮卡丘 或 Pikachu'}
    bind:value={search.query}
    onfocus={() => (open = true)}
  />
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2" />
    <path d="M21 21l-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  </svg>
  <div class="tools">
    {#if search.query || search.foil}
      <button type="button" class="tool clear" aria-label="清除搜尋" onclick={() => search.clear()}>×</button>
    {/if}
    <button
      type="button"
      class="tool types"
      class:on={!!search.foil}
      aria-label="選擇閃卡類型"
      aria-expanded={open}
      aria-controls="foil-panel"
      onclick={() => (open = !open)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2l2.2 6.3L21 10l-6.8 1.7L12 18l-2.2-6.3L3 10l6.8-1.7z" fill="currentColor" />
        <path d="M19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z" fill="currentColor" />
        <path d="M5 15l.9 2.6 2.6.9-2.6.9L5 22l-.9-2.6-2.6-.9 2.6-.9z" fill="currentColor" />
      </svg>
    </button>
  </div>

  {#if open}
    <div id="foil-panel" class="panel-pop" role="group" aria-label="閃卡類型">
      <p class="panel-title">點選閃卡類型，或輸入名稱一起找</p>
      <div class="chips">
        {#each FOIL_TYPES as t (t.id)}
          <button type="button" class="type-chip" class:active={search.foil === t.id} aria-pressed={search.foil === t.id} onclick={() => pick(t.id)}>
            {t.name}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</form>

<style>
  .search {
    position: relative;
    display: grid;
    align-items: center;
  }

  input {
    width: 100%;
    height: 48px;
    margin: 0;
    padding: 0 88px 0 40px;
    font: inherit;
    font-size: 16px;
    color: var(--ink);
    background: #fff;
    border: 2px solid var(--ui-border);
    border-radius: 999px;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    -webkit-appearance: none;
    appearance: none;
  }
  input::placeholder {
    color: var(--ink-soft);
  }
  input:focus {
    border-color: var(--accent-dark);
    box-shadow: 0 0 0 3px rgba(255, 204, 0, 0.35);
  }
  input::-webkit-search-cancel-button {
    -webkit-appearance: none;
    appearance: none;
  }

  .icon {
    position: absolute;
    left: 12px;
    width: 20px;
    height: 20px;
    color: var(--ink-soft);
    pointer-events: none;
  }

  .tools {
    position: absolute;
    right: 2px;
    display: flex;
    align-items: center;
  }
  .tool {
    width: 44px;
    height: 44px;
    min-width: 0;
    min-height: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--ink-soft);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .tool:hover {
    background: rgba(0, 0, 0, 0.06);
  }
  .tool:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: -2px;
  }
  .clear {
    font-size: 24px;
    line-height: 1;
  }
  .types svg {
    width: 22px;
    height: 22px;
  }
  .types.on {
    color: var(--accent-dark);
  }

  /* 閃卡類型面板：貼在搜尋框下方，手機時撐滿 TopBar 寬度 */
  .panel-pop {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    z-index: 60;
    padding: 12px 12px 14px;
    background: var(--paper);
    border-radius: 16px;
    box-shadow: var(--ui-shadow);
    color: var(--ink);
  }
  .panel-title {
    margin: 0 4px 10px;
    font-family: var(--font-display);
    font-size: 14px;
    color: var(--ink-soft);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .type-chip {
    min-height: 44px;
    padding: 0 14px;
    font-family: var(--font-display);
    font-size: 15px;
    color: var(--wood-dark);
    background: #fff;
    border: 2px solid var(--ui-border);
    border-radius: 999px;
    transition: border-color 0.2s ease, background 0.2s ease;
  }
  .type-chip:hover {
    border-color: var(--accent-dark);
  }
  .type-chip:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .type-chip.active {
    color: var(--ink);
    background: var(--accent);
    border-color: var(--accent-dark);
  }

  /* 手機：搜尋框寬度不夠排按鈕，面板改固定在 TopBar 下方撐滿螢幕 */
  @media (max-width: 899px) {
    .panel-pop {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      right: 0;
      max-height: calc(100vh - var(--topbar-h) - 24px);
      overflow-y: auto;
    }
  }

  @media (min-width: 900px) {
    input {
      font-size: 16px;
    }
    .panel-pop {
      min-width: 0;
      left: auto;
    }
  }
</style>
