// 真新鎮背景層設定（PLAN §8）。地景已改為 3D 村莊，正交背景層只剩天空、星星與月亮。

export const PARALLAX_PX = 90
/** 地平線位置，相對視窗高度、從底部起算；星星只出現在地平線以上。 */
export const HORIZON = 0.42

/**
 * 月亮：夜晚才顯示，上緣距視窗頂 y、水平偏移 x（相對視窗，正值在右），顯示寬度 widthFrac，parallax 為視差係數。
 * HD-2D 的方向光從左上照、影子落在右側，月亮改用 hd2dX 放在左上與影子方向一致；
 * 斜俯視的天空只剩畫面頂端一小段，偏移取 0.2 讓月亮避開左上角的站名卡與中央的卡種標題。
 */
export const MOON = { size: 400, parallax: 0.04, y: 0.1, x: 0.3, hd2dX: -0.2, widthFrac: 0.09 }

/** 星星：數量（低效能減半）、點大小範圍（CSS px，最遠到最近）、最近一層的視差係數；遠星只跟一成，月亮在星星前方故略小於 MOON.parallax。 */
export const STARS = { count: 320, lowPowerCount: 140, size: [1.4, 7], parallax: 0.035 }
