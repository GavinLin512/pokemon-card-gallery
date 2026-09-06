// 真新鎮場景圖層設定（PLAN §8.1）。由遠到近。
// src 為空字串或載入失敗時，以佔位圖代替（scene/placeholders.js）。素材需求見 public/town/README.md。
//   width/height   素材像素尺寸，用來算比例
//   depth          0 最遠到 1 最近，決定疊放順序
//   parallax       滑鼠／陀螺儀位移係數
//   scrollFactor   頁面捲動位移係數
//   anchor         top（上緣貼視窗頂）、bottom（下緣貼視窗底）、horizon（下緣貼地平線）、horizon-top（上緣貼地平線）
//   y              相對視窗高度的偏移（正值向上）
//   widthFrac      顯示寬度相對視窗寬度（預設 1.15，留視差移動空間）
//   x              水平偏移，相對視窗寬度
//   drift          雲朵每秒向右飄移像素
//   role           night 只在夜晚顯示；haze 為清晨薄霧

export const PARALLAX_PX = 90
/** 地平線位置，相對視窗高度、從底部起算。地平線以下由天空 shader 畫地面漸層，任何長寬比都有地面。 */
export const HORIZON = 0.42

export const townLayers = [
  { key: 'clouds-far', src: '', width: 2400, height: 600, depth: 0.1, parallax: 0.05, scrollFactor: 0.03, anchor: 'top', y: 0.03, drift: 4 },
  { key: 'moon', src: '', width: 400, height: 400, depth: 0.12, parallax: 0.04, scrollFactor: 0.02, anchor: 'top', y: 0.1, widthFrac: 0.09, x: 0.3, role: 'night' },
  { key: 'treeline', src: '', width: 2400, height: 500, depth: 0.25, parallax: 0.1, scrollFactor: 0.05, anchor: 'horizon', y: -0.03 },
  { key: 'haze', src: '', width: 2400, height: 500, depth: 0.28, parallax: 0.1, scrollFactor: 0.06, anchor: 'horizon', y: -0.12, role: 'haze' },
  { key: 'fields', src: '', width: 2400, height: 900, depth: 0.4, parallax: 0.16, scrollFactor: 0.1, anchor: 'horizon-top', y: 0.02 },
  { key: 'lab', src: '', width: 1200, height: 900, depth: 0.5, parallax: 0.24, scrollFactor: 0.14, anchor: 'horizon', y: -0.06, widthFrac: 0.22, x: 0.3 },
  { key: 'houses', src: '', width: 2400, height: 800, depth: 0.6, parallax: 0.34, scrollFactor: 0.2, anchor: 'horizon', y: -0.1, widthFrac: 0.42, x: -0.25 },
  { key: 'houses-night', src: '', width: 2400, height: 800, depth: 0.61, parallax: 0.34, scrollFactor: 0.2, anchor: 'horizon', y: -0.1, widthFrac: 0.42, x: -0.25, role: 'night' },
  { key: 'pond', src: '', width: 1200, height: 500, depth: 0.72, parallax: 0.42, scrollFactor: 0.24, anchor: 'bottom', y: 0.04, widthFrac: 0.3, x: -0.3 },
  { key: 'clouds-near', src: '', width: 2400, height: 500, depth: 0.7, parallax: 0.3, scrollFactor: 0.1, anchor: 'top', y: 0.14, drift: 8 },
  { key: 'trees-near', src: '', width: 2400, height: 700, depth: 0.85, parallax: 0.5, scrollFactor: 0.28, anchor: 'bottom', y: -0.01 },
  { key: 'foreground-grass', src: '', width: 2400, height: 300, depth: 1, parallax: 0.6, scrollFactor: 0.32, anchor: 'bottom', y: -0.02 }
]
