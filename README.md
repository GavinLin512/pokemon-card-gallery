# 寶可夢卡牌展示館

以動畫版真新鎮為背景的寶可夢卡牌閃卡展示館。全繁體中文，不講技術，只讓你欣賞卡牌。

## 狀態

PLAN §12 五個里程碑已全部完成並 commit（2026-09-06）：介面骨架、中英文搜尋、真新鎮佔位場景、視差、日夜循環、捕捉與我的圖鑑、屬性天氣、傾斜授權。
生產版本以 headless Chrome 走完載入、捲動、放大、捕捉、圖鑑、搜尋、日夜切換，桌機與手機皆無 console error。真新鎮已依參考圖改為程式生成的 3D 微縮模型，包含兩棟民宅、研究所、樹列、花圃、柵欄與池塘，不需另外安裝套件或提供背景圖層。博士頭像已提供；部署目標待定。

3D 場景已延伸為「真新鎮 → 一號道路 → 常磐市」的連續地景。往下捲動會帶動低空透視鏡頭向北飛行，往上捲動則沿原路返回；放大卡牌時鏡頭暫停，減少動態模式固定於真新鎮。沿用現有 three.js，無新增套件。雲層已改用與地景共用透視鏡頭的立體雲團，帶緩慢風向飄移，移除舊版貼在螢幕上的循環雲圖。
建置、Svelte 檢查與 `node --test tests/journey.test.mjs` 通過（既有 baseUrl 棄用警告仍在）。桌機瀏覽器已確認三段場景的實際捲動畫面；手機相機與減少動態設定已完成程式測試，尚未做手機實機驗收。
3D 屬性天氣已實作（2026-09-07）：11 種屬性融入地景、保留日夜時段，卡牌收合後持續生效，約 2 秒平滑切換。水系雨量已依回饋降低；雷系每隔約 1–3 秒從可見雲團隨機打下閃電，無音效。9 項天氣／旅程測試通過，Aside 已確認降雨與閃電渲染；完整三地 × 四時段人工視覺驗收及手機實機驗收尚未完成。無新增套件。
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
- 卡牌圖像與資料：展示區沿用原作資料，來自 [pokemontcg.io](https://pokemontcg.io)；搜尋改用 [TCGdex](https://tcgdex.dev)，畫廊集與部分促銷卡圖片仍取自 pokemontcg.io。
- 寶可夢中英譯名對照：[神奇寶貝百科「寶可夢列表（在其他語言中）」](https://wiki.52poke.com/zh-hant/寶可夢列表（在其他語言中）)，依 [CC BY-NC-SA 3.0](http://creativecommons.org/licenses/by-nc-sa/3.0/deed.zh-hant) 使用，本專案為非商業用途。Pokémon 相關商標屬任天堂、Creatures、GAME FREAK 所有。
