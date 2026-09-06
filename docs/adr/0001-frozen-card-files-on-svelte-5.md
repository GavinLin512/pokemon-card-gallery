---
status: accepted
date: 2026-09-06
---

# 卡牌效果檔案原封不動沿用，並以 Svelte 5 legacy mode 執行

本專案的卡牌閃光效果全部來自 simeydotme/pokemon-cards-css（GPL-3.0）。為了保證效果與原作完全一致，
`public/css/**`、`public/data/cards.json`、`public/img/**`、`public/foils.txt` 與 `src/lib/**`
是逐位元組複製的凍結區，任何需求都不得修改這些檔案；要改行為只能在外層包裝或覆蓋樣式。

框架選擇 Svelte 5 + Vite 7 而非與原作相同的 Svelte 3，是因為新寫的場景與互動元件能受益於
runes 的細粒度更新與更小的 bundle。代價是 `src/lib` 內的卡牌元件保持 Svelte 3 語法
（`export let`、`$:`、`svelte/motion` 的 `spring`），由 Svelte 5 以 legacy mode 執行，
因此 repo 內會長期同時存在兩種語法。這是刻意的，不要「順手」把卡牌元件改寫成 runes。

## Considered Options

- Svelte 4 + Vite 5：相容風險最低，但沒有 runes，且 Vite 5 生命週期較短。
- React / Vue / Solid：必須重寫卡牌元件，直接違反凍結區約束，不予考慮。

## Consequences

- `public/css` 內的圖片路徑是絕對路徑（`/img/...`），因此部署必須在網域根目錄，Vite `base` 固定為 `/`。
- 效能瓶頸在卡牌本身的 CSS 合成（blend mode、filter、mask），框架無法改善；
  效能手段集中在延遲掛載展示區與場景降級。
