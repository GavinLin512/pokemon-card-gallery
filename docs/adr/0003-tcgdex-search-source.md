---
status: accepted
date: 2026-09-06
---

# 搜尋改用 TCGdex GraphQL，回應轉成 pokemontcg.io 格式

取代 ADR-0002 的資料來源。pokemontcg.io API 不穩定（2026-09-06 整日回 502），
搜尋改打 `https://api.tcgdex.net/v2/graphql`：免金鑰、CORS 全開、一次請求即可取得
稀有度、屬性、階段等欄位（REST 列表端點只回 id 與名稱，要逐張再查）。

只有搜尋換來源。展示區的 `public/data/cards.json` 屬凍結區，維持不動。

## 為什麼要轉格式

閃卡效果分兩層：凍結區 CSS 依 `data-rarity`、`data-subtypes` 決定通用效果；
凍結區 CardProxy 再依集號、卡號、稀有度拼出原作 CDN（`VITE_CDN`）上每張卡專屬的 foil 與 mask 圖片路徑。
CDN 只有 pokemontcg.io 格式的集號與卡號，稀有度字彙也是 pokemontcg.io 的。
因此 `src/config/tcgdex.js` 把 TCGdex 回應逐欄轉成 pokemontcg.io 格式後才交給元件，兩層效果都保留。

## 對應規則摘要

- 集號：`swsh12.5` 轉 `swsh12pt5`、`swsh4.5sv` 轉 `swsh45sv`、`swsh10.5`（Pokémon GO）轉 `pgo`，TG 集兩邊相同。
- 卡號：純數字去前導零；TG01、SV001、SWSH076 保持原樣。
- 稀有度：`Holo Rare V` 系列依 stage 推導（TCGdex 偶有標錯）；`Secret Rare` 依 V 系列或支援者判為彩虹卡，其餘金卡；
  畫廊集的一般閃卡加 `Trainer Gallery` 前綴，其餘與主集相同；Shiny Vault 的 V 與 VMAX 沿用 pokemontcg.io 的 `Rare Holo V`、`Rare Holo VMAX`，
  由 CardProxy 依 SV 卡號自行轉為 Shiny。
- subtypes：由 category、stage、suffix、trainerType、energyType 拼出。
- 圖片：優先 TCGdex 的 webp；TG、GG、SV 畫廊集與部分促銷卡 TCGdex 沒有圖片，退回 `images.pokemontcg.io`（與其 API 是分開的 CDN）。
  TCGdex 每集約 3% 的卡只有 `high.webp` 沒有 `low.webp`（2026-09-09 實測 swsh1 7 張、swsh9 11 張、swshp 11 張），
  搜尋結果縮圖載入失敗時由 `SearchResults` 的 onerror 改載 `images.large`，僅切換一次避免無限重試。
- 排序：GraphQL 的 sort 參數無效，改依集號發行順序表在前端排序，促銷卡沉底。

以凍結區 `cards.json` 的 88 張劍盾卡驗證，74 張逐欄相同；其餘差異為 pokemontcg.io 自身的資料特例
（促銷卡的實際稀有度、宇宙閃 Cosmos、極少數金色 VSTAR），CardProxy 的促銷卡規則會自行補正，未補正者只影響 CSS 通用效果，遮罩層不受影響。

## 已知限制

- TCGdex 分不出 `Rare Holo Cosmos`，這類卡顯示為一般 `Rare`。
- 金色的 VSTAR、VMAX 秘稀（例如 swsh9-184 Arceus VSTAR）會被判為彩虹卡，遮罩相同，只有 CSS 光澤顏色不同。
- 名稱比對為子字串，搜 `chu` 會同時命中 Pikachu 與 Raichu。
