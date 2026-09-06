# 寶可夢卡牌展示館 實作計畫

本文件是 2026-09-06 需求訪談的定稿，實作一律以此為準。詞彙定義見 [`CONTEXT.md`](../CONTEXT.md)，關鍵決策見 [`docs/adr/`](./adr/)。

## 1. 目標

把 simeydotme/pokemon-cards-css 的閃卡效果，包裝成一個以「動畫版真新鎮」為背景、全繁體中文、
不講任何技術細節的純展示介面，並加入寶可夢風格的互動。

## 2. 不可違反的約束

| 約束 | 內容 |
|---|---|
| 凍結區 | `public/css/**`、`public/data/cards.json`、`public/img/**`、`public/foils.txt`、`public/favicon.png`、`src/lib/**`。逐位元組與原作相同，任何需求都不得修改。 |
| 授權 | GPL-3.0，README 與頁尾註明原作者 simeydotme。 |
| 部署路徑 | Vite `base` 固定 `/`，因凍結的 CSS 內含 `/img/...` 絕對路徑。部署目標未定，先只做本地開發。 |
| 語言 | 介面文案全繁體中文，統一用「卡牌」不用「卡片」。`<html lang="zh-Hant">`。 |
| 技術說明 | 全部移除。每個展示區只保留一則博士口吻的卡種說明。 |

## 3. 技術棧

| 項目 | 選擇 | 版本 |
|---|---|---|
| 框架 | Svelte 5（新元件用 runes，凍結區以 legacy mode 執行） | ^5.57 |
| 建置 | Vite 7 + @sveltejs/vite-plugin-svelte 6 | ^7.3 / ^6.2 |
| 3D | three.js，只 import 用到的模組 | ^0.185 |
| 搜尋 | 原生 `fetch` 呼叫 pokemontcg.io v2（見 ADR-0002） | 無套件 |
| 字型 | Google Fonts：Huninn（標題、路標）、Noto Sans TC（內文、對話框） | `font-display: swap` |
| 套件管理 | npm，產生 `package-lock.json` | Node 26 |

### 3.1 相容性驗證結果（已完成）

2026-09-06 以 headless Chrome 對 Svelte 5.57 + Vite 7.3 的最小掛載做驗證：

- 4 張卡渲染正常，`data-rarity`、`--rotate-x/--rotate-y` 隨滑鼠變化，`interacting` class 正確切換。
- 點擊放大得到 `active` class 與 `--card-scale`，點擊外部後正常收合。
- 唯一問題：`Card.svelte` 第 180 行在放大時呼叫全域 `gtag()`，沒有 GA 時拋 `gtag is not defined`。
  解法：`src/main.js` 在掛載前定義 `window.gtag`，將呼叫轉發為 `window` 的 `gtag` 事件；
  `select_item` 事件同時提供放大卡牌的 id 與名稱，供捕捉與屬性天氣使用（DOM 只有 set 與 number）。不改凍結區。

結論：不需退回 Svelte 4。

## 4. 環境變數

`.env.local`（已被 `.gitignore` 排除）：

```
VITE_CDN=https://poke-holo.b-cdn.net   # 原作 foil/mask 圖層 CDN，2026-09-06 驗證可用
VITE_API_KEY=                          # pokemontcg.io，可留空
```

## 5. 檔案結構

```
pokemon-card-gallery/
├── CONTEXT.md                  詞彙表
├── docs/
│   ├── PLAN.md                 本文件
│   ├── adr/                    決策紀錄
│   ├── pokemon-language-list.md  神奇寶貝百科譯名頁面原始轉存（來源，不直接讀取）
│   └── pokemon-names.csv       譯名對照的可編輯版本（§6.3）
├── scripts/
│   └── build-names.mjs         docs/pokemon-names.csv → src/config/pokemonNames.json
├── public/
│   ├── css/  data/  img/  foils.txt  favicon.png    ← 凍結區
│   └── town/                   真新鎮素材（由使用者提供），含 README.md 素材清單
├── src/
│   ├── lib/                    ← 凍結區（Card、CardProxy、stores、helpers、json）
│   ├── main.js                 掛載 App、gtag shim、載入 app.css
│   ├── app.css                 全站樣式：真新鎮配色、字型、版型、reset
│   ├── App.svelte              頁面骨架與狀態組裝
│   ├── config/
│   │   ├── sections.js         18 個展示區設定（§7）
│   │   ├── pokemonNames.json   譯名對照（由 scripts/build-names.mjs 產生，勿手改）
│   │   ├── town.js             場景圖層設定（§8.1）
│   │   ├── weather.js          屬性天氣對應表（§9.4）
│   │   └── dayCycle.js         日夜時段與色票（§9.3）
│   ├── stores/
│   │   ├── search.svelte.js    搜尋狀態與查詢邏輯（中英文判斷、譯名查詢、fetch 重試）
│   │   ├── cards.svelte.js     卡牌登錄表、cardId → sectionId、目前放大卡牌（由 gtag select_item 事件取得）
│   │   ├── pokedex.svelte.js   我的圖鑑（localStorage）
│   │   ├── dayCycle.svelte.js  目前時段（自動 + 手動覆寫）
│   │   └── viewport.svelte.js  是否手機、reduced-motion、低效能旗標
│   ├── components/
│   │   ├── TopBar.svelte       站名、搜尋框、日夜切換、圖鑑計數、傾斜授權
│   │   ├── Hero.svelte         頁首：站名、副標、操作提示、展示卡
│   │   ├── Signpost.svelte     路標
│   │   ├── Section.svelte      展示區：標題、博士對話框、卡牌格；延遲掛載
│   │   ├── CardGrid.svelte     卡牌格（自原作 Cards.svelte 改寫，排版規則不變）
│   │   ├── ProfessorDialog.svelte
│   │   ├── Search.svelte       搜尋框（放在 TopBar；狀態在 stores/search.svelte.js）
│   │   ├── SearchResults.svelte 搜尋結果（取代展示區顯示；卡牌下方標注中文名）
│   │   ├── CaptureButton.svelte 精靈球按鈕與捕捉動畫觸發
│   │   ├── PokedexDrawer.svelte
│   │   └── Footer.svelte
│   └── scene/
│       ├── TownScene.svelte    掛載 canvas、串接日夜／activeCard／orientation store（App 以動態 import 延後載入）
│       ├── town.js             建立圖層、視差、雲朵、日夜光照過渡、render loop 與降級
│       ├── placeholders.js     Canvas 2D 佔位圖與素材載入（縮到貼圖上限）
│       ├── pokeball.js         精靈球飛行、吸入、晃動、閃星（DOM + Web Animations API，見 §9.1）
│       └── weather.js          屬性天氣粒子（單一 Points + shader，運動全在頂點著色器）
└── index.html                  凍結 CSS 連結清單、字型、meta
```

## 6. 頁面骨架

```
┌ TopBar（sticky）─────────────────────────────────────────┐
│ 站名/圖示   [搜尋框]   [傾斜感應] [日夜] [圖鑑 N]        │
├──────────────────────────────────────────────────────────┤
│ Hero：寶可夢卡牌展示館 / 純白的開始之色 / 點擊卡牌可放大細看 ┃ 展示卡 │
├──────────────────────────────────────────────────────────┤
│ Signpost（sticky，貼在 TopBar 下方）                      │
├──────────────────────────────────────────────────────────┤
│ Section × 18（搜尋中時整段隱藏，只顯示搜尋結果）          │
├──────────────────────────────────────────────────────────┤
│ Footer：卡牌效果 by simeydotme（GitHub 圖示）             │
└──────────────────────────────────────────────────────────┘
   底層：TownScene（position: fixed，全頁，z-index 最低）
```

### 6.1 原作者資訊的最小化

- 頁首不再出現作者。
- Footer 一行 12px 半透明小字，只保留 GitHub 圖示連結至原 repo。
- README 完整保留授權與致謝。

### 6.2 搜尋框

- 保留在 TopBar。placeholder：「輸入英文名稱，例如：Pikachu」。
- 查詢：`GET https://api.pokemontcg.io/v2/cards?q=(set.id:swsh* AND name:"*{q}*")&select=id,name,number,supertype,subtypes,rarity,images,types,set&orderBy=-set.releaseDate,-number&pageSize=36`，
  有 key 時帶 `X-Api-Key`。輸入至少 3 字元，666ms debounce（與原作相同）。
- 普通、非普通卡隨機標為反閃（與原作相同）。
- 查無結果：顯示「找不到這張卡牌，請試試英文名稱」，並保留原作的「Computer Error」卡。
- 搜尋結果的卡牌同樣可捕捉。

### 6.3 中文搜尋

訪客可直接輸入繁體中文寶可夢名稱。流程：

1. **判斷模式**：輸入含任何 CJK 字元即進入中文模式，否則走 §6.2 的英文流程。中文模式最少 2 字即可查詢（超夢、快龍等兩字名很常見）。
2. **查譯名對照**：在 `pokemonNames.json` 中比對 `zh` 與 `aliases`（含舊譯、簡體），排序為
   完全相符 > 前綴相符 > 子字串相符，最多取 **8** 隻。
3. **組查詢**：`(set.id:swsh* AND (name:"Pikachu" OR name:"Raichu" OR …))`。
   2026-09-06 實測：`name:"Pikachu"` 會同時命中 Pikachu V、VMAX、V-UNION 等衍生卡；
   含 `'`、`.`、空白的名稱（Farfetch'd、Mr. Mime）用雙引號包起來可正常查詢。
4. **顯示**：結果卡牌名稱下方以小字顯示對應中文名（由英文名反查對照表，去掉 V、VMAX 等後綴後比對）。
5. **查無對照**：顯示「譯名對照裡找不到「{輸入}」，請確認名稱或改用英文」，不呼叫 API。
6. **API 重試**：pokemontcg.io 偶發 500，實作時對 5xx 以 1 秒、2 秒、4 秒退避重試三次，之後才顯示錯誤卡。
   5xx 回應常缺 CORS 標頭，瀏覽器會以網路錯誤拋出，一併視為可重試；單次請求逾時 10 秒。

placeholder 改為：「輸入寶可夢名稱，例如：皮卡丘 或 Pikachu」。

#### 譯名對照資料

- **來源**：`docs/pokemon-language-list.md`，神奇寶貝百科「寶可夢列表（在其他語言中）」頁面轉存，
  CC BY-NC-SA 3.0，README 已致謝。頁面表格欄位數不固定（原表有 rowspan），解析規則：
  以「含假名字母（ぁ-ゖ、ァ-ヺ，不含間隔號「・」）的儲存格」定位日文欄，其右一格為英文名，
  其左側所有 CJK 字串為中文名，第一個為正式名，其餘為別名。
- **可編輯版本**：`docs/pokemon-names.csv`（UTF-8 with BOM，Excel 可直接開），欄位
  `no, zh_tw, en, aliases`（別名以 `|` 分隔）。**要修改譯名請改這個檔**，不要改 md 或 json。
- **建置**：`npm run build:names` 執行 `scripts/build-names.mjs`，讀 CSV 產生
  `src/config/pokemonNames.json`（精簡格式 `[{n,zh,en,a:[…]}]`，約 66KB，gzip 後約 25KB，
  以動態 `import()` 在第一次搜尋時才載入；英文搜尋也載入，以便結果標注中文名）。
- **驗證結果（2026-09-06）**：1025 隻全數解析，加上編號 0000「寶可夢」共 1026 筆，
  962 個別名，中文正式名無重複，別名不與其他寶可夢正式名衝突。
- **已知限制**：對照表只有寶可夢本體名稱，訓練家卡（例如「瑪俐」）、地區型態（「伽勒爾 大蔥鴨」）
  與招式名不在範圍內；地區型態輸入「大蔥鴨」仍會命中 Galarian Farfetch'd。

## 7. 展示區設定檔 `src/config/sections.js`

每筆結構：

```js
{
  id: 'common',                 // 錨點與路標 key
  name: '普通與非普通',          // 卡種名
  slices: [[1, 4]],             // cards.json 切片，允許多段
  isReverse: false,             // 是否以反閃渲染
  passSet: false,               // 是否傳 set/rarity（原作普通卡只傳 img）
  blurb: '這是……'               // 博士對話框文字，30 到 50 字，第一人稱
}
```

切片與旗標**完全沿用原作 App.svelte** 的 index，不得調整（cards.json 凍結）：

| # | id | 卡種名 | slices | isReverse |
|---|---|---|---|---|
| 1 | common | 普通與非普通 | [1,4] | 否（只傳 img） |
| 2 | reverse | 反閃卡 | [4,7] + [70,76] | 是 |
| 3 | holo | 閃卡 | [7,13] | |
| 4 | cosmos | 宇宙閃卡 | [13,16] | |
| 5 | amazing | 驚奇稀有 | [76,85] | |
| 6 | radiant | 光輝寶可夢 | [16,19] | |
| 7 | gallery-holo | 訓練家畫廊閃卡 | [19,22] | |
| 8 | v | 寶可夢 V | [22,25] | |
| 9 | v-full-art | 寶可夢 V 全圖 | [25,28] | |
| 10 | v-alt-art | 寶可夢 V 異圖 | [28,34] | |
| 11 | vmax | VMAX | [37,40] | |
| 12 | vmax-alt | VMAX 異圖 | [40,43] | |
| 13 | vstar | VSTAR | [43,46] | |
| 14 | trainer-full-art | 訓練家全圖 | [46,52] | |
| 15 | rainbow | 彩虹稀有 | [52,58] | |
| 16 | gold | 黃金秘密稀有 | [58,64] | |
| 17 | gallery-v | 訓練家畫廊 V 與 VMAX | [64,70] | |
| 18 | shiny-vault | 閃色寶藏 | [85,91] | |

展示卡（Hero）固定為 `cards[0]`，`showcase={true}`。

## 8. 真新鎮場景

### 8.1 圖層設定檔 `src/config/town.js`

單一 three.js `OrthographicCamera` 場景，每層一個 `PlaneGeometry` + `MeshBasicMaterial`（透明貼圖）。

```js
{
  key: 'houses',
  src: '/town/houses.png',   // 空字串或檔案不存在時，用佔位幾何體
  width: 2400, height: 800,  // 素材像素尺寸，用來算比例
  depth: 0.6,                // 0 最遠（天空）到 1 最近（前景草）
  parallax: 0.35,            // 滑鼠 / 陀螺儀位移係數
  scrollFactor: 0.2,         // 頁面捲動位移係數
  anchor: 'horizon',         // top 貼視窗頂、bottom 貼視窗底、horizon 下緣貼地平線、horizon-top 上緣貼地平線
  y: -0.09,                  // 相對視窗高度的偏移，正值向上
  widthFrac: 0.55,           // 顯示寬度相對視窗寬度；全寬圖層預設 1.15 留視差空間
  x: -0.26                   // 水平偏移，相對視窗寬度
}
```

地平線 `HORIZON = 0.42`（相對視窗高度、從底部起算）。天空 shader 同時畫出地平線以下的地面漸層，
因此任何長寬比都有地面，田野與前景草只是加在上面的裝飾層。星星只出現在地平線以上。

預設圖層（由遠到近）：sky（漸層，不需素材）、clouds-far、moon、treeline（遠景樹列）、haze、fields（草地點紋、沙路、花圃、柵欄）、lab（大木研究所）、houses、houses-night、pond（池塘與柵欄）、clouds-near、trees-near（左右框樹）、foreground-grass。
佔位圖造型與配色參考遊戲版真新鎮俯視圖（`town.jpeg`，僅作參考不入庫）：橘紅屋頂灰藍牆民宅、黃磚牆灰瓦頂研究所、圓頂樹。素材清單見 `public/town/README.md`。

### 8.2 佔位場景

素材未到時，每層以 Canvas 2D 幾何體代替：天空與地面漸層、雙色橢圓雲、圓頂樹列、草地點紋與沙路、
2.5D 盒狀民宅（橘紅屋頂、灰藍牆、藍窗、紅門、信箱）、黃磚牆灰瓦研究所（紅色通風塔、圓窗、風車）、池塘、柵欄、花圃、前景草叢。
介面與互動須在佔位狀態下完整可用。

### 8.3 視差

- 桌機：滑鼠位置相對視窗中心，乘以各層 `parallax`，lerp 0.05 平滑。頁面捲動乘以 `scrollFactor`。
- 手機：關閉滑鼠視差，改讀凍結區的 `orientation` store（`relative.gamma/beta`），幅度為桌機一半。
- 雲朵：持續以每秒 4 到 8px 向右飄，超出邊界從左側回來。

### 8.4 降級與暫停

| 條件 | 行為 |
|---|---|
| `document.hidden` | 暫停 render loop |
| `prefers-reduced-motion: reduce` | 靜態渲染一幀，不跑 loop，雲不動，粒子關閉 |
| `navigator.deviceMemory < 4` 或手機 | 貼圖上限 1024px，雲數量減半，粒子減半 |
| WebGL 不可用 | 不掛 canvas，body 以 CSS 漸層天空代替 |
| 使用者放大卡牌 | 持續 render，但暫停視差（避免與卡牌傾斜視覺打架） |

## 9. 互動規格

### 9.1 捕捉與我的圖鑑

- 觸發：任一卡牌進入 `active`（監聽凍結區 `activeCard` store），`CaptureButton` 於畫面底部中央淡入（手機 64px，桌機 56px）。
- 點擊精靈球：
  1. `pokeball.js` 生成精靈球，從按鈕位置沿拋物線飛到卡牌中心，約 600ms。
     實作採 DOM 元素 + Web Animations API，而非原設計的 three.js 場景：場景 canvas 在頁面底下，
     畫在場景裡會被放大的卡牌遮住。卡牌中心取 `.card__rotator` 的 `getBoundingClientRect()`（含 transform）。
  2. 到達後精靈球放大再縮小模擬吸入，卡牌 DOM 不動。
  3. 晃動三下，每下 350ms，最後閃星粒子約 800ms。
  4. `pokedex.add(card)`，TopBar 計數 +1 並彈跳一次。
- 已捕捉的卡牌放大時，按鈕顯示「已捕捉」，再點一次「放生」，直接移除，不播動畫。
- 卡牌收合（`activeCard` 變 undefined）時按鈕淡出，進行中的動畫照常播完。
- 圖鑑資料：`localStorage['pokedex.v1']`，陣列，每筆 `{ id, name, set, number, sectionId?, capturedAt }`。
- 圖鑑抽屜：桌機右側滑入 360px，手機底部滑出 70vh。縮圖用 `https://images.pokemontcg.io/{set}/{number}.png`（小圖），不重新渲染閃卡。點縮圖：有 `sectionId` 則捲到該展示區，否則填入搜尋框搜尋該名稱。
- 標題：「我的圖鑑」，計數文案：「已捕捉 N 張」。空狀態：「還沒有捕捉到任何卡牌，放大一張卡牌試試看！」

### 9.2 卡牌 id 對應展示區

實作時建立 `cardId → sectionId` 的 Map（由 sections.js 切片推得），供捕捉時寫入 `sectionId`。搜尋結果的卡牌無 sectionId。

### 9.3 日夜循環 `src/config/dayCycle.js`

| key | 時段 | 天空 | 光照色 | 額外 |
|---|---|---|---|---|
| dawn | 05:00–08:00 | 淡橘到淡藍漸層 | 暖白，強度 0.85 | 薄霧層透明度 0.3 |
| day | 08:00–17:00 | 天藍到淺藍 | 白，強度 1 | |
| dusk | 17:00–19:00 | 橘紅到紫 | 橘，強度 0.8 | 圖層加暗色 tint 模擬逆光 |
| night | 19:00–05:00 | 深藍到黑 | 藍白，強度 0.45 | 星星粒子、月亮、民宅窗戶亮燈圖層 |

- 自動：每分鐘檢查一次本地時間。
- 手動：TopBar 太陽／月亮按鈕循環四段，寫入 `localStorage['dayCycle.override']`；再點一次回到自動時顯示「自動」。
- 切換時各層顏色以 1.2 秒 lerp 過渡。
- `app.css` 依 `<html data-daycycle="night">` 同步調整介面色票（對話框、路標木色不變，文字對比自動調整）。

### 9.4 屬性天氣 `src/config/weather.js`

| types[0] | key | 粒子 |
|---|---|---|
| Grass | leaves | 綠葉，緩慢左右擺盪下落 |
| Fire | embers | 火星，向上帶輕微亂數 |
| Water | rain | 雨滴直落，落地處小漣漪 |
| Lightning | sparks | 隨機閃電白光（全畫面 80ms）加小電花 |
| Psychic | orbs | 紫色光點，緩慢漂浮 |
| Fighting | dust | 沙塵，貼近地面橫向飄 |
| Darkness | mist | 紫黑霧氣，低透明度大顆粒 |
| Metal | shards | 銀色光屑，旋轉下落 |
| Fairy | stars | 粉色星星，閃爍 |
| Dragon | scales | 金色鱗光，繞圈 |
| Colorless | feathers | 白色羽毛，飄落 |
| 無 types（訓練家、能量） | glow | 柔和光暈，無粒子 |

- 只在卡牌 `active` 時出現，收合後 2 秒淡出。雙屬性取第一個。
- 實作為單一 `THREE.Points` + 自訂 shader，粒子數桌機 300、手機 150；`lightning` 另加一個全螢幕 quad。

### 9.5 博士對話框

- 位置：展示區標題正下方，白底圓角對話框，左側頭像（素材 `/town/professor.png`，未到用剪影）。
- 觸發：Section 第一次進入視窗（IntersectionObserver，threshold 0.25）開始逐字，每字 40ms。點擊立即顯示全文。已播完不重播。
- 無障礙：全文一開始就在 DOM，逐字效果以 `aria-hidden` 的視覺層疊加，`prefers-reduced-motion` 時直接全文。
- 口吻：大木博士第一人稱，30 到 50 字。文案在 `sections.js` 的 `blurb`。

### 9.6 路標

- 18 個木牌，橫向排列，桌機可換行、手機橫向捲動（`scroll-snap`）。
- 目前所在展示區高亮：以捲動位置判斷，取最後一個頂端已到達停靠線的展示區（IntersectionObserver 在落點時會與上一區尾端相交而選錯）。
- 平滑捲動途中沿路展示區會延遲掛載而改變高度，`scrollend` 後再瞬間校正一次落點。
- 點擊：`scrollIntoView({ behavior: 'smooth' })`，`scroll-margin-top` 預留 TopBar + 路標高度。
- 搜尋中時路標隱藏。

### 9.7 傾斜感應授權（iOS）

- 只在 `typeof DeviceOrientationEvent.requestPermission === 'function'` 且 `navigator.maxTouchPoints > 0` 時顯示按鈕「開啟傾斜感應」
  （部分桌機 Chrome 也暴露 requestPermission，以觸控點數過濾）。
- 授權成功後隱藏按鈕並呼叫凍結區的 `resetBaseOrientation()`；拒絕則顯示「已停用」。
- 授權狀態不持久化（iOS 每次載入都需重新授權）。

## 10. 手機規則

| 項目 | 規則 |
|---|---|
| 斷點 | 沿用原作：< 900px 為手機／平板排版 |
| 觸控目標 | 所有按鈕至少 44×44px |
| TopBar | 站名縮成圖示，搜尋框點擊展開全寬 |
| 卡牌格 | 沿用原作 Cards.svelte 的三張扇形疊放規則，不改 |
| 捕捉按鈕 | 固定底部中央，避開卡牌區 |
| 圖鑑 | 底部抽屜 |
| 對話框 | 全寬，頭像縮小放左上 |
| 場景 | 見 §8.4 降級 |

## 11. 效能

- Section 以 IntersectionObserver 延遲掛載卡牌（rootMargin 200px），離開視窗 800px 以上時卸載。
- 場景 render loop 只在需要時跑（可見、非 reduced-motion）。
- three.js 以 `manualChunks` 拆成獨立 chunk。
- 圖層貼圖用 `TextureLoader`，`generateMipmaps` 關閉，`minFilter: LinearFilter`。

## 12. 里程碑與 commit

| # | 內容 | 驗收 |
|---|---|---|
| 0 | 鷹架、凍結區複製、Svelte 5 相容驗證（已完成） | `diff -r` 與原作一致、`vite build` 通過、headless Chrome 驗證通過 |
| 1 | Commit 1：里程碑 0 + gtag shim + 文件（已完成，2026-09-06） | `git init` 後首次 commit |
| 2 | 介面骨架：app.css、TopBar、Hero、Signpost、Section、CardGrid、ProfessorDialog、Search（含中文搜尋與 build:names）、Footer、sections.js（已完成，2026-09-06；headless Chrome 23 項驗收通過） | 18 區塊可瀏覽、中英文搜尋可用、路標可跳轉、手機排版正確 |
| 3 | 場景：TownScene 佔位版、視差、日夜循環（已完成，2026-09-06；headless Chrome 16 項驗收通過） | 四時段可切換、reduced-motion 靜態 |
| 4 | 互動：捕捉、圖鑑、屬性天氣、傾斜授權（已完成，2026-09-06；headless Chrome 28 項驗收通過） | 全流程可在桌機與手機操作 |
| 5 | Commit 2：完整展示館（已完成，2026-09-06；對 `vite preview` 生產版本走完桌機與手機各 13 項，0 console error） | headless Chrome 走一遍：載入、捲動、放大、捕捉、圖鑑、搜尋，無 console error |

不 push，遠端由使用者自行設定。

## 13. 待使用者提供

- 真新鎮圖層素材（清單見 `public/town/README.md`）。目前以佔位圖運作。
- 大木博士頭像：已提供並裁切為 `public/town/professor.png`（512×512，白底，2026-09-06）。
- 部署目標（決定後只需確認 `base` 仍為 `/`）。
