---
status: accepted
date: 2026-09-09
---

# 151 系列以第二凍結區併入，CSS 以 `.era-151` 作用域化

原作者的 [pokemon-cards-151](https://github.com/simeydotme/pokemon-cards-151)（GPL-3.0）用另一套 CSS 與 `Card.svelte`
實作朱紫「151」系列的閃卡效果，素材放在同一個 CDN 的 `foils/151` 子目錄。本專案以它作為旅程第 19 站，規格見 PLAN §15。

## 為什麼不能直接沿用凍結區

- 凍結區 `Card.svelte` 沒有 151 需要的 `card__glitter`、`card__glare2` 兩層與 `--birthdaybg`、`--rotate-delta` 變數；
  凍結區 `CardProxy` 的路徑規則是劍盾格式（`foils/{集號}/{foils|masks}/upscaled/...`），151 是 `foils/sv3-5_en_{卡號}_{ph|std}.foil.webp`。
- 兩套 CSS 都以 `.card` 與 `data-rarity="rare holo"` 為選擇器，`cards.css`、`base.css`、`regular-holo.css` 內容差異大，
  全域同時載入會互相覆蓋（實測 `.card__shine` 的 filter、`.card__translater` 的 transform 都不同）。

## 決定

- 新增第二凍結區 `src/lib151/components/Card.svelte`：逐位元組複製 151 版，只改三行 import 指向 `src/lib` 共用的
  `helpers/Math.js`、`stores/activeCard.js`、`stores/orientation.js`（三者兩邊逐位元組相同）。共用 `activeCard` 是刻意的，
  這樣同一時間仍只有一張卡放大。和 ADR-0001 一樣以 legacy mode 執行，不得改寫成 runes。
- 不引入 151 版 `CardProxy`，其路徑與稀有度規則移植到 `src/config/foils151.js`，由 `JourneyCard` 直接餵給 `Card` 的
  `foil`、`mask`、`rarity` props。理由：CDN 基底需要可設定，原版反閃卡 20% 隨機升大師球在展示館應固定，
  且 `CardProxy` 內建的 IntersectionObserver 與旅程的掛載策略重複。
- CSS 不逐檔複製，改由 `scripts/scope-151-css.mjs` 從上游 `public/css` 產生單一 `public/css151/cards-151.css`：
  每條規則前綴 `.era-151`，`:root` 改為 `.era-151`，`@keyframes` 內不動；`[data-rarity="rare holo"]` 改為
  `[data-rarity="rare holo 151"]`，配合 `foils151.js` 把 151 的 `Rare` 對應到 `Rare Holo 151`，讓劍盾的
  `regular-holo.css` 完全不命中 151 卡牌。其餘重疊的 `reverse-holo.css` 兩邊相同，不需處理。
- 產生檔不得手改；上游更新時重新執行腳本。

## 後果

- 劍盾全域 CSS 仍會套到 151 卡牌的 `.card` 結構上，151 有定義的屬性因作用域類別而勝出，只有 151 沒定義的屬性會沿用劍盾值。
  已知差異：151 的 `base.css` 沒有劍盾版本放大時的 `--translate-z`，放大層疊需在手機實測。
- 151 效果多兩層合成，手機負擔較重，第 19 站固定 10 張。
- 搜尋仍只涵蓋劍盾；加入 151 需另做 TCGdex `sv03.5` 對照與朱紫稀有度字彙。
