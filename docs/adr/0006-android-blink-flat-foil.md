---
status: accepted
date: 2026-09-11
---

# Android Blink 放大閃爍：以 `<html data-flat-foil>` 把正面閃卡層改為平面

手機實測：iOS Safari 與 Android Firefox 放大卡牌正常，Android Chrome（及其他 Blink 引擎瀏覽器）部分卡牌閃爍破圖。
三者交集是 Blink 引擎，不是系統、GPU 或記憶體。

## 原因

凍結區 `public/css/cards/base.css` 把 `card__shine`、`card__shine::before`、`card__shine::after`、`card__glare`
分別放在 translateZ 1px、1.2px、1.41px，並對 `.card__rotator *` 宣告 `transform-style: preserve-3d`、
對 `.card__front *` 宣告 `backface-visibility: hidden`。這幾層同時帶有 `filter`、`mix-blend-mode`、`overflow: hidden`
與 `mask-image`，依 CSS 規範屬於會使 3D 情境失效的 grouping 屬性。

WebKit 與 Gecko 仍把整組交給真正的 3D 合成，Z 排序穩定；Blink 則把每一層壓平成獨立 render surface，
每幀重新決定繪製順序，0.2px 到 0.4px 的深度差落在誤差範圍內，結果就是圖層交替蓋住彼此。
基本卡沒有 `::before` 與 `::after` 這幾層，所以不會閃，符合「有些卡會、有些不會」。

診斷過程曾以網址旗標 `?cardtest=` 排除其他假設（合成層數、放大倍率、三維場景競爭 GPU），旗標保留供日後比對。

## 決定

- `src/stores/viewport.svelte.js` 新增 `flatFoil`：UA 含 Android 且不是 Firefox 即為 Blink（Chrome、Edge、Samsung Internet、WebView）。
- `App.svelte` 啟動時在 `<html>` 加上 `data-flat-foil`。
- `src/app.css` 以 `html[data-flat-foil]` 覆寫 `.card__front`、`.card__front *`、`.card__shine::before`、`.card__shine::after`
  的 `transform: none` 與 `transform-style: flat`，讓正面各層依 DOM 順序與 z-index 疊放。翻面仍由 `.card__rotator`
  的 preserve-3d 與 `.card__back` 的 rotateY(180deg) 負責，第一次放大的 360 度翻轉與卡背不受影響。
- 同一個條件下另給 `.card__front` 加 `isolation: isolate`（2026-10-11 補上，原因見後果）。
- 凍結區與第二凍結區不動。`public/css151/cards-151.css` 用相同類別名稱，只多 `.era-151` 前綴；`app.css` 在 `index.html`
  最後載入，多數規則權重相同或更高，但有兩處漏網，2026-10-14 補上（見後果）。

## 後果

- Android Blink 上正面閃卡層失去肉眼幾乎不可辨的 1px 深度；iOS Safari 與 Firefox 維持原狀。
- 第一版只做平面化時其實有視覺差異：`.card__front` 原本靠 `translate3d` 成為堆疊情境，拿掉後 shine、glare 的混合模式
  失去以卡圖為底的混色群組，閃卡層等於直接蓋在卡圖上。手機回報 VSTAR、VMAX 異圖變暗，訓練家全圖泛白。
  以桌機 Chrome 強制加上 `data-flat-foil` 重現，劍盾系列半數像素明顯偏差；加上 `isolation: isolate` 後與未平面化時
  逐像素一致，翻到背面也正常。151 系列實測不受影響，加上後外觀同樣不變。`isolation` 不加回任何 Z 偏移，
  理論上不影響閃爍修正，但仍需以 Android Chrome 實機確認。
- 2026-10-14 手機回報 151 系列部分卡牌放大仍閃爍、劍盾正常。以 Android UA 掃描正面所有元素與偽元素的計算後 transform，
  劍盾 0 處殘留，151 有兩處：
  - 正面卡圖：`.era-151 .card__rotator img:not(.card__back)` 權重 (0,3,1) 高於 `.card__front *` 的 (0,2,1)，每張 151 卡圖都留著
    `translate3d(0, 0, 0.01px)`。劍盾同一條規則是 (0,2,1)，只靠 `app.css` 較晚載入才蓋過。補上權重 (0,3,2) 的
    `.card__rotator .card__front img`，桌機 Chrome 強制平面化比對修正前後逐像素一致。
  - `.card__glitter::before`、`::after`（151 才有，特別插圖稀有與超稀有會顯示）：`*` 選不到偽元素，原清單只列 shine，
    兩層留在 translateZ(1px)。改成 `transform: none` 會讓兩層不再獨立合成，閃粉混色與原設計偏差三到四成像素；
    改用 `translateZ(0)` 深度歸零、外觀與未平面化時一致。
  - 修正後兩個系列各站共 84 個卡牌狀態掃描皆無殘留。是否消除閃爍仍需 Android Chrome 實機確認。
- 判斷依賴 UA 字串。若日後 Blink 修正壓平行為想比對，需暫時改 `flatFoil` 條件；未保留關閉用的網址參數。
- 桌機 Chrome 也是 Blink 但未回報問題，暫不套用；若桌機也出現同樣閃爍，把條件放寬為所有 Blink 即可。
