<script>
  // 搜尋框（PLAN §6.2、§6.3）：只負責輸入，狀態與查詢在 stores/search.svelte.js。
  import { search } from '../stores/search.svelte.js'
</script>

<form class="search" role="search" onsubmit={(e) => e.preventDefault()}>
  <label class="sr-only" for="card-search">搜尋卡牌</label>
  <input
    id="card-search"
    type="search"
    autocomplete="off"
    enterkeyhint="search"
    placeholder="輸入寶可夢名稱，例如：皮卡丘 或 Pikachu"
    bind:value={search.query}
  />
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2" />
    <path d="M21 21l-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  </svg>
  {#if search.query}
    <button type="button" class="clear" aria-label="清除搜尋" onclick={() => search.clear()}>×</button>
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
    height: 44px;
    margin: 0;
    padding: 0 44px 0 40px;
    font: inherit;
    font-size: 15px;
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

  .clear {
    position: absolute;
    right: 2px;
    width: 40px;
    height: 40px;
    min-width: 0;
    min-height: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--ink-soft);
    font-size: 24px;
    line-height: 1;
  }
  .clear:hover {
    background: rgba(0, 0, 0, 0.06);
  }

  @media (min-width: 900px) {
    input {
      font-size: 16px;
    }
  }
</style>
