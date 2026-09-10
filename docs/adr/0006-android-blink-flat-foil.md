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
- 凍結區與第二凍結區不動。`public/css151/cards-151.css` 用相同類別名稱，只多 `.era-151` 前綴；`app.css` 在 `index.html`
  最後載入，權重相同或更高，兩個系列一併生效。

## 後果

- Android Blink 上正面閃卡層失去肉眼幾乎不可辨的 1px 深度，視覺無差異；iOS Safari 與 Firefox 維持原狀。
- 判斷依賴 UA 字串。若日後 Blink 修正壓平行為想比對，需暫時改 `flatFoil` 條件；未保留關閉用的網址參數。
- 桌機 Chrome 也是 Blink 但未回報問題，暫不套用；若桌機也出現同樣閃爍，把條件放寬為所有 Blink 即可。
