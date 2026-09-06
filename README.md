# 寶可夢卡牌展示館

以動畫版真新鎮為背景的寶可夢卡牌閃卡展示館。全繁體中文，不講技術，只讓你欣賞卡牌。

## 狀態

PLAN §12 五個里程碑已全部完成並 commit（2026-09-06）：介面骨架、中英文搜尋、真新鎮佔位場景、視差、日夜循環、捕捉與我的圖鑑、屬性天氣、傾斜授權。
生產版本以 headless Chrome 走完載入、捲動、放大、捕捉、圖鑑、搜尋、日夜切換，桌機與手機皆無 console error。待補：真新鎮素材與博士頭像（見 `docs/PLAN.md` §13）、部署目標。
完整規格見 [`docs/PLAN.md`](./docs/PLAN.md)，詞彙見 [`CONTEXT.md`](./CONTEXT.md)，決策見 [`docs/adr/`](./docs/adr/)。

## 開發

```
npm install
cp .env.local.example .env.local   # 若尚未存在，內容見 docs/PLAN.md §4
npm run dev
```

## 凍結區

以下檔案逐位元組來自 [simeydotme/pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css)，
請勿修改（理由見 [ADR-0001](./docs/adr/0001-frozen-card-files-on-svelte-5.md)）：

- `public/css/**`、`public/data/cards.json`、`public/img/**`、`public/foils.txt`、`public/favicon.png`
- `src/lib/**`

## 授權與致謝

- 本專案沿用 GPL-3.0，見 [`LICENSE`](./LICENSE)。
- 卡牌閃光效果：[Simon Goellner (simeydotme)](https://github.com/simeydotme/pokemon-cards-css)。
- Galaxy Holo：[aschefield101](https://www.deviantart.com/aschefield101/art/HoloSheet-2012-313543843)。部分背景：[Vecteezy](https://www.vecteezy.com/free-photos)。
- 卡牌圖像與資料：[pokemontcg.io](https://pokemontcg.io)。
- 寶可夢中英譯名對照：[神奇寶貝百科「寶可夢列表（在其他語言中）」](https://wiki.52poke.com/zh-hant/寶可夢列表（在其他語言中）)，依 [CC BY-NC-SA 3.0](http://creativecommons.org/licenses/by-nc-sa/3.0/deed.zh-hant) 使用，本專案為非商業用途。Pokémon 相關商標屬任天堂、Creatures、GAME FREAK 所有。
