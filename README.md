# 寶可夢卡牌展示館

以動畫版真新鎮為背景的寶可夢卡牌閃卡展示館。全繁體中文，不講技術，只讓你欣賞卡牌。

## 狀態

151 系列已併入（2026-09-09）：開場畫面與旅程地圖可切換「劍盾系列」（18 站）與「151 系列」（10 站／55 張），兩系列共用真新鎮到常磐市的路徑，切換後回到該系列第一站，網址 `?series=151` 與瀏覽器歷史可還原。151 閃卡效果來自原作者的 pokemon-cards-151，以第二凍結區與作用域化 CSS 併入（[ADR-0005](./docs/adr/0005-151-second-frozen-zone.md)、[PLAN §15](./docs/PLAN.md)）。建置、Svelte 檢查與 28 項測試通過；headless Chrome 已確認 151 的 ex、大師球反閃與劍盾閃卡站點正常渲染、無 console error。151 的放大層疊與手機效能仍待實機驗收。

搜尋跟隨系列（2026-09-10）：搜尋只在目前系列內找，閃卡類型面板依系列切換（劍盾 18 種、151 十種與站點對應），面板標題、彈窗與結果統計顯示目前系列，切換系列時清空搜尋。29 項測試通過，已對 TCGdex 實際跑過 151 全部 10 種卡種與名稱查詢（PLAN §15.7）。移除 `jsconfig.json` 未使用的 `baseUrl`，Svelte 檢查改為 0 錯誤 0 警告。

滿版 UI 重製已實作（2026-09-08）：18 站／87 張卡牌的自然捲動旅程、中央卡牌與左右預覽、旅程地圖、搜尋／圖鑑遊戲面板、載入後下降開場、重訪選卡記憶與瀏覽器歷史恢復。依實作回饋，捲動使用共用平滑進度，到站改為約 0.28 秒輕快浮現，取消壓暗與光圈。

建置、Svelte 檢查（0 錯誤、1 個既有警告）與 26 項測試通過。瀏覽器已驗證全部展示卡牌、捕捉／放生、圖鑑跳卡、中文搜尋、面板返回、鍵盤與拖曳、390×844／844×390 排版、減少動態、WebGL／資料／圖片失敗降級。手機實機、iOS 感應授權與長時間效能仍待驗收；詳見 [驗證記錄](./docs/UI-REMAKE-QA.md) 與 [重製計畫](./docs/UI-REMAKE-PLAN.md)。以下保留歷次實作紀錄。

手機閃卡測試路徑（2026-09-09）：網址加上 `?cardtest=all`（或逗號組合 `flat`、`scale`、`iso`、`nogl`、`noz`）可在手機 Chrome 驗證放大閃爍破圖的原因，畫面左下會顯示目前旗標；未帶參數時不影響任何樣式。旗標說明見 `src/stores/viewport.svelte.js`。實測 iOS Safari 與 Android Firefox 正常、Android Chrome 閃爍，`noz` 即針對 Blink 壓平 3D 圖層的修法。

PLAN §12 五個里程碑已全部完成並 commit（2026-09-06）：介面骨架、中英文搜尋、真新鎮佔位場景、視差、日夜循環、捕捉與我的圖鑑、屬性天氣、傾斜授權。
生產版本以 headless Chrome 走完載入、捲動、放大、捕捉、圖鑑、搜尋、日夜切換，桌機與手機皆無 console error。真新鎮已依參考圖改為程式生成的 3D 微縮模型，包含兩棟民宅、研究所、樹列、花圃、柵欄與池塘，不需另外安裝套件或提供背景圖層。博士頭像已提供；部署目標待定。

3D 場景已延伸為「真新鎮 → 一號道路 → 常磐市」的連續地景。往下捲動會帶動低空透視鏡頭向北飛行，往上捲動則沿原路返回；放大卡牌時鏡頭暫停，減少動態模式固定於真新鎮。沿用現有 three.js，無新增套件。雲層已改用與地景共用透視鏡頭的立體雲團，帶緩慢風向飄移，移除舊版貼在螢幕上的循環雲圖。
建置、Svelte 檢查與 `node --test tests/journey.test.mjs` 通過（既有 baseUrl 棄用警告仍在）。桌機瀏覽器已確認三段場景的實際捲動畫面；手機相機與減少動態設定已完成程式測試，尚未做手機實機驗收。
3D 屬性天氣已實作（2026-09-07）：11 種屬性融入地景、保留日夜時段，卡牌收合後持續生效，約 2 秒平滑切換。水系雨量已依回饋降低；雷系每隔約 1–3 秒從可見雲團隨機打下閃電，無音效。9 項天氣／旅程測試通過，Aside 已確認降雨與閃電渲染；完整三地 × 四時段人工視覺驗收及手機實機驗收尚未完成。無新增套件。
地景已依 `preferences-photo/background/` 三張參考圖細化（2026-09-07）：真新鎮庭院與紅頂雙屋、一號道路的土路／長草配置、常磐市彩色地標與分層岩壁，並補上葉簇樹冠、石砌池岸與地面細紋。保留低空往返飛行及屬性天氣，無新增套件；建置與 19 項測試通過，Svelte 檢查 0 error、既有 1 warning。Aside 已檢視三地桌機及手機尺寸場景與常磐市夜晚／黃昏窗光；手機實機驗收仍待進行。
11 種屬性天氣已依逐項定案全面加強：新增火舌、暴雨水花與積水、念力／妖精波紋、鬥氣沙石、黑色碎影、銀霜與金色照射等。保留日夜、收合持續與約 2 秒過渡，手機減量、減少動態模式停用動畫。建置與 21 項測試通過；Aside 桌機／手機尺寸共 286 種渲染狀態無執行或著色器錯誤，已檢視各屬性的代表畫面。手機實機及長時間效能驗收仍待進行。
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

151 系列（ADR-0005）另有第二凍結區，來自 [simeydotme/pokemon-cards-151](https://github.com/simeydotme/pokemon-cards-151)：

- `src/lib151/**`（僅三行 import 改指向共用的 `src/lib`）、`public/data/cards-151.json`、`public/img151/**`
- `public/css151/cards-151.css` 由 `scripts/scope-151-css.mjs` 產生，請勿手改

## 授權與致謝

- 本專案沿用 GPL-3.0，見 [`LICENSE`](./LICENSE)。
- 卡牌閃光效果：[Simon Goellner (simeydotme)](https://github.com/simeydotme/pokemon-cards-css)；151 系列效果：[simeydotme/pokemon-cards-151](https://github.com/simeydotme/pokemon-cards-151)。
- Galaxy Holo：[aschefield101](https://www.deviantart.com/aschefield101/art/HoloSheet-2012-313543843)。部分背景：[Vecteezy](https://www.vecteezy.com/free-photos)。
- 卡牌圖像與資料：展示區沿用原作資料（含 151 系列），來自 [pokemontcg.io](https://pokemontcg.io)；搜尋改用 [TCGdex](https://tcgdex.dev)，畫廊集與部分促銷卡圖片仍取自 pokemontcg.io。
- 寶可夢中英譯名對照：[神奇寶貝百科「寶可夢列表（在其他語言中）」](https://wiki.52poke.com/zh-hant/寶可夢列表（在其他語言中）)，依 [CC BY-NC-SA 3.0](http://creativecommons.org/licenses/by-nc-sa/3.0/deed.zh-hant) 使用，本專案為非商業用途。Pokémon 相關商標屬任天堂、Creatures、GAME FREAK 所有。
