// 村民像素人物（CONTEXT.md 的村民）：16×24，以文字樣板描繪。
// 符號：o 輪廓、e 眼睛、s 皮膚、h/H 頭髮亮暗、c/C 上衣亮暗、p/P 褲子亮暗、f 鞋。
import { canvasOf, pixelWriter, INK } from './pixel-art.js'

export const VILLAGER_W = 16
export const VILLAGER_H = 24
export const VILLAGER_VARIANTS = 10
/** 圖集欄位：正面站立與左右腳、背面站立與左右腳、側面站立與跨步。 */
export const VILLAGER_FRAME = { front: 0, frontL: 1, frontR: 2, back: 3, backL: 4, backR: 5, side: 6, sideStride: 7 }

// 正面左半邊，鏡射出右半邊。
const FRONT_HALF = [
  '........', '.....ooo', '....ohhh', '...ohhhh', '..ohhhhh', '..ohhHHH', '..ohHsss', '..ohsess',
  '..ohsess', '..ohssss', '...ossss', '.....oos', '...ooccc', '..occccc', '..oCcccc', '..oCcccc',
  '..osoccc', '...oPppp', '...opppp', '...opppo', '...oppo.', '...offo.', '...oooo.', '........'
]
const SIDE = [
  '................', '......ooooo.....', '.....ohhhhho....', '....ohhhhhhho...',
  '...ohhhhhhhhho..', '...ohhhhhhHHso..', '...ohhhhhHssso..', '...ohhhhhsseso..',
  '...ohhhhhssesso.', '...ohhhhsssssso.', '....ohhhsssso...', '......osso......',
  '.....occcco.....', '....occcccco....', '....occCCcco....', '....occCCcco....',
  '....occsscco....', '....oPpppppo....', '.....oppppo.....', '.....oppppo.....',
  '.....oppppo.....', '.....offfffo....', '.....ooooooo....', '................'
]
const SIDE_STRIDE = ['....opo..opo....', '...opo....opo...', '..offo....offfo.', '..oooo....ooooo.']

const front = FRONT_HALF.map(half => half + [...half].reverse().join(''))
/** 背面：臉部換成頭髮。 */
const back = front.map((row, y) => (y >= 5 && y <= 10 ? row.replace(/[se]/g, y === 10 ? 'H' : 'h') : row))
const side = SIDE
const sideStride = [...SIDE.slice(0, 19), ...SIDE_STRIDE, SIDE[23]]

/** 抬起一隻腳：該側 20–22 列往上移一列。 */
function liftFoot(rows, leftSide) {
  return rows.map((row, y) => {
    if (y < 20 || y > 22) return row
    const source = y === 22 ? '.'.repeat(VILLAGER_W) : rows[y + 1]
    return leftSide ? source.slice(0, 8) + row.slice(8) : row.slice(0, 8) + source.slice(8)
  })
}

/** 依 VILLAGER_FRAME 順序排列的八個姿勢，每個是 24 列 × 16 字元。 */
export const villagerFrames = [front, liftFoot(front, true), liftFoot(front, false), back, liftFoot(back, true), liftFoot(back, false), side, sideStride]
const frames = villagerFrames

const SKIN = ['#f6d3b3', '#e6b48c', '#c08a60']
const HAIR = [['#6b4a2f', '#4a3220'], ['#2f2a33', '#1c1920'], ['#e2b75c', '#b98c3a'], ['#b5533c', '#86392a'], ['#a8a8b4', '#7c7c8a'], ['#3d5a8a', '#2a3f63']]
const SHIRT = [['#d9534f', '#a83a3a'], ['#4a8fd9', '#3469a8'], ['#5cae5c', '#3f8540'], ['#e8b04a', '#b98530'], ['#9b6ad0', '#7349a3'], ['#f0ece0', '#c8c2b0'], ['#e57fa8', '#b85a80']]
const PANTS = [['#3f4f7a', '#2c3857'], ['#5a4636', '#3f3026'], ['#6b6f78', '#4c4f57'], ['#2f4a3a', '#203328']]

function villagerPalette(i) {
  const [hair, hairShade] = HAIR[(i * 5 + 1) % HAIR.length]
  const [shirt, shirtShade] = SHIRT[(i * 3 + 2) % SHIRT.length]
  const [pants, pantsShade] = PANTS[(i * 7) % PANTS.length]
  return { o: INK, e: INK, s: SKIN[i % SKIN.length], h: hair, H: hairShade, c: shirt, C: shirtShade, p: pants, P: pantsShade, f: '#4a3428', dress: i % 4 === 3 }
}

/** 列：村民樣式；欄：VILLAGER_FRAME。每四人有一人穿連身裙（褲子換成上衣色、腿露出皮膚）。 */
export function drawVillagerAtlas() {
  const canvas = canvasOf(VILLAGER_W * frames.length, VILLAGER_H * VILLAGER_VARIANTS)
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(canvas.width, canvas.height)
  const put = pixelWriter(image)
  for (let v = 0; v < VILLAGER_VARIANTS; v++) {
    const palette = villagerPalette(v)
    frames.forEach((rows, f) => rows.forEach((row, y) => [...row].forEach((symbol, x) => {
      if (symbol === '.') return
      let color = palette[symbol]
      if (palette.dress && (symbol === 'p' || symbol === 'P')) color = y <= 18 ? palette[symbol === 'p' ? 'c' : 'C'] : palette.s
      put(f * VILLAGER_W + x, v * VILLAGER_H + y, color)
    })))
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}
