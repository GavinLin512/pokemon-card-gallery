# 寶可夢卡牌展示館

以動畫版真新鎮為背景的 PTCG 閃卡展示介面。Svelte 5 + Vite 7 + three.js，介面全繁體中文，統一用「卡牌」不用「卡片」。
閃卡效果沿用 simeydotme/pokemon-cards-css（GPL-3.0）。

## 文件

- `docs/PLAN.md`：需求定稿與實作規格，實作一律以此為準。
- `CONTEXT.md`：領域詞彙表，介面文案與命名依此。
- `docs/adr/`：關鍵決策（凍結區與 Svelte 5 legacy mode、搜尋改用 fetch）。
- `public/town/README.md`：真新鎮場景素材清單。
- `README.md`：對外說明、授權與致謝；「狀態」段落記錄實作進度，完成階段後更新。

## 約束

- 凍結區不得修改：`public/css/**`、`public/data/cards.json`、`public/img/**`、`public/foils.txt`、`public/favicon.png`、`src/lib/**`。
- 第二凍結區（151 系列，ADR-0005）：`src/lib151/**`、`public/data/cards-151.json`、`public/img151/**` 不得修改；`public/css151/cards-151.css` 為 `scripts/scope-151-css.mjs` 產生檔，不得手改。
- Vite `base` 固定 `/`。新元件用 runes，凍結區以 legacy mode 執行。
- 環境變數見 `.env.local.example`，不提交 `.env.local`。

## 指令

```
npm run dev      # 開發伺服器
npm run build    # 建置
npm run check    # svelte-check
```
