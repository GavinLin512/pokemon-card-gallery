import { splitAtEdges, nearTerrace, groundAt, TERRACES, PLATEAUS, STAIRS, CHEEK } from './terrain.js'

/** route-01.webp 的像素座標換算成世界座標：寬度每 12 像素 1 單位，深度每像素 0.16 單位。 */
export const routePoint = (px, py) => [(px - 192) / 12, -19 - (608 - py) * .16]
const LEDGE_SPECS = [[106,510,148],[264,510,176],[324,427,48],
  [106,333,50],[264,333,174],[47,333,30],[87,253,108],[86,173,108],
  [86,93,108],[239,94,159]]
/**
 * 一號道路的土坡 { x0, x1, z }：原作的單向跳台，只能由北往南跳下。
 * 現行畫風以窄土堤呈現；HD-2D 改由 terrain.js 的台地與高地擋土牆呈現，後方是較高的地面。
 */
export const ROUTE_LEDGES = LEDGE_SPECS.map(([px, py, width]) => {
  const [x, z] = routePoint(px, py)
  return { x0: x - width / 24, x1: x + width / 24, z }
})

/** 從區段清單中挖掉 [a, b]。 */
const subtract = (pieces, [a, b]) => pieces
  .flatMap(([x0, x1]) => [[x0, Math.min(x1, a)], [Math.max(x0, b), x1]])
  .filter(([x0, x1]) => x1 - x0 > 1e-6)
/**
 * HD-2D 的土坡面 { x0, x1, z, low, high }：原作土坡所在的那段擋土牆正面，z 是所在的台地邊界或高地南緣。
 * 同一道牆上相連的土坡合併；階梯與兩側矮牆處切開；高地與台地同高相接、沒有牆的地方略過；太短的碎段不做。
 * 只有這些段落能從高處往南跳下，其餘擋土牆不能通行。
 */
export const LEDGE_FACES = (() => {
  const lines = new Map()
  for (const l of ROUTE_LEDGES) {
    const z = TERRACES.find(t => Math.abs(t.z - l.z) < 1)?.z ?? PLATEAUS.find(p => Math.abs(p.south - l.z) < .1)?.south
    if (z === undefined) continue
    lines.set(z, [...(lines.get(z) ?? []), [l.x0, l.x1]])
  }
  const faces = []
  lines.forEach((spans, z) => {
    let pieces = []
    for (const [x0, x1] of spans.sort((a, b) => a[0] - b[0])) {
      const last = pieces[pieces.length - 1]
      if (last && x0 <= last[1]) last[1] = Math.max(last[1], x1)
      else pieces.push([x0, x1])
    }
    for (const s of STAIRS) if (s.axis === 'z' && s.top === z) pieces = subtract(pieces, [s.at - s.width / 2 - CHEEK, s.at + s.width / 2 + CHEEK])
    for (const p of PLATEAUS) if (p.north === z) pieces = subtract(pieces, [p.x0, p.x1])
    for (const [x0, x1] of pieces) {
      if (x1 - x0 < 1) continue
      const x = (x0 + x1) / 2
      faces.push({ x0, x1, z, low: groundAt(x, z + .05), high: groundAt(x, z - .05) })
    }
  })
  return faces
})()
/** 原圖一格（16 像素）的世界尺寸；路中的樹叢在原圖佔 2×2 格。 */
export const TILE = { x: 16 / 12, z: 16 * .16 }
/** 一號道路的樹：路中的樹叢（原圖像素座標，grove）與兩側樹林。 */
export const ROUTE_TREES = [
  ...[[143,80],[143,112],[143,145],[48,248],[175,247],[207,247],[239,247],
    [48,406],[80,406],[112,406],[144,406],[175,406]].map(([px, py]) => {
    const [x, z] = routePoint(px, py)
    return { x, z, seed: px + py, grove: true }
  }),
  ...Array.from({ length: 36 }, (_, i) => {
    const z = -20 - i * 2.7
    const row = [{ x: -16, z, seed: i }, { x: 16, z, seed: i + 7 }]
    return i % 2 ? row : [...row, { x: -19, z: z - 1, seed: i + 4 }, { x: 19, z: z - 1, seed: i + 9 }]
  }).flat()
]
/** 一號道路兩側的花叢（每叢四株，由此點往東、往南排開）與告示牌。 */
const ROUTE_FLOWERS = Array.from({ length: 6 }, (_, k) => {
  const z = -20 - k * 6 * 2.7
  return [[-12, z], [11, z - 3]]
}).flat()
export const ROUTE_SIGNS = [[-3, -23], [3, -108]]

// 真新鎮北側的連續地景。沿用村莊的幾何、材質與合併流程。
// terraced（HD-2D）時，路面在台地與高地邊緣切段，土坡改由擋土牆與後方的高地取代（見 terrain.js）。
export function buildNorthernRegion({ box, shape, tree, fence, windowAt, root, lowPower, Group, pond, terraced = false }) {
  const road = '#e3cf91'
  const pieces = (x, z, w, d) => (terraced ? splitAtEdges(x, z, w, d) : [[x, z, w, d]])
  const path = (x, z, w, d) => pieces(x, z, w, d).forEach(([cx, cz, cw, cd]) => box(road, cx, -0.055, cz, cw, 0.1, cd))
  // 依 route-01.webp 的像素地圖配置：南口長草、東側折返、中央雙土坡、北口長草。
  function routeRect(px, py, w, d, paint = path) {
    const [x,z] = routePoint(px,py)
    paint(x,z,w/12,d*.16)
  }
  for (const rect of [[192,565,42,100],[190,481,316,28],[324,422,40,138],
    [214,349,266,27],[101,313,40,74],[166,291,169,29],[230,272,40,52],
    [279,198,138,36],[324,163,40,60],[319,73,58,34],[253,58,182,30],
    [190,24,54,100]]) routeRect(...rect)
  // 土路外緣保留草色細邊，路寬與空隙不再是等距的鋸齒。
  function flowers(x, z, count = 5) {
    for (let i = 0; i < count; i++) {
      const px = x + (i % 3) * 0.8, pz = z + Math.floor(i / 3) * 0.9
      shape('crown', '#43865b', px, 0.16, pz, 0.4, 0.22, 0.36)
      for (let j = 0; j < 3; j++) shape('crown', '#e77973', px + Math.cos(j * 2.1) * 0.17, 0.4, pz + Math.sin(j * 2.1) * 0.17, 0.19, 0.17, 0.19)
      shape('crown', '#ffe09b', px, 0.5, pz, 0.08, 0.08, 0.08)
    }
  }
  function grassPatch(x, z, w, d) {
    box('#559968', x, -0.025, z, w, 0.1, d)
    // HD-2D 的長草改由像素草叢密鋪（tufts.js），不建立立體草葉。
    if (terraced) return
    const step = lowPower ? 1.05 : .72
    for (let dx = -w / 2 + .36; dx < w / 2; dx += step) {
      for (let dz = -d / 2 + .36; dz < d / 2; dz += step) {
        for (let i=0; i<3; i++) {
          const blade = shape('blade', i === 1 ? '#85bc6f' : '#3f8c5a', x+dx, .035, z+dz, .65, .65+(i%2)*.2, .65)
          blade.rotation.y = i * 2.094 + (Math.round(dx*7)%2)*.2
        }
      }
    }
  }
  for (const rect of [[105,542,142,63],[247,566,142,40],[296,532,49,42],
    [239,425,101,82],[254,137,186,79]]) routeRect(...rect, grassPatch)
  // 土坡：南面是碎石崖面，北側頂上留草緣。
  function ledge({ x0, x1, z }) {
    const x = (x0 + x1) / 2, w = x1 - x0
    box('#947965', x, .19, z, w, .52, .48)
    box('#639f75', x, .47, z-.12, w, .08, .65)
    for (let i=0; i<w/.5; i++) {
      const rock = box(i%2 ? '#867c79' : '#b5987b', x0+i*.5+.2, .18, z+.23, .4, .32, .14)
      rock.rotation.z = (i%3-1)*.18
    }
  }
  // HD-2D 土坡面：土色崖面蓋住那段擋土牆，嵌兩排碎石；牆頂的草緣由台地草皮提供。已在正確高度，合併時不再抬升。
  function ledgeFace({ x0, x1, z, low, high }) {
    const face = high - low, w = x1 - x0
    const place = mesh => { mesh.userData.terrain = true; return mesh }
    place(box('#947965', (x0 + x1) / 2, low + (face - .1) / 2, z + .05, w, face - .1, .1))
    for (let row = 0; row < Math.max(1, Math.round(face / .4)); row++) {
      for (let i = 0; i < w / .5 - row % 2; i++) {
        const rock = place(box(i % 2 ? '#867c79' : '#b5987b', x0 + i * .5 + .2 + (row % 2) * .25, low + .16 + row * .36, z + .15, .4, .32, .14))
        rock.rotation.z = ((i + row) % 3 - 1) * .18
      }
    }
  }
  if (terraced) LEDGE_FACES.forEach(ledgeFace)
  else ROUTE_LEDGES.forEach(ledge)
  for (const t of ROUTE_TREES) tree(t.x, t.z, t.seed)
  for (const [x, z] of ROUTE_FLOWERS) {
    // HD-2D：東側花叢移出土路與階梯；跨在台地邊界上的一叢略過，不會半埋進擋土牆。
    if (terraced && x > 0) {
      if (!nearTerrace(z + .45, .75)) flowers(13.2, z, 4)
    } else flowers(x, z, 4)
  }
  fence(-13.3, -22, 21); fence(2.8, -22, 18)
  function sign(x, z) {
    box('#816c50', x, 0.55, z, 0.14, 1.1, 0.14)
    box('#e9debd', x, 1.2, z, 1, 0.7, 0.14)
    for (let i = 0; i < 3; i++) box('#8b8871', x, 1.35 - i * 0.16, z + 0.08, 0.65, 0.04, 0.02)
  }
  for (const [x, z] of ROUTE_SIGNS) sign(x, z)

  // 常磐市：白色街道環繞市區；入口從南側中央接入。
  const street = (x, z, w, d) => pieces(x, z, w, d).forEach(([cx, cz, cw, cd]) => box('#d2dfce', cx, -0.025, cz, cw, 0.12, cd))
  path(0, -116, 5, 10)
  street(0, -122, 38, 4)
  street(-3, -146, 4, 48)
  street(18, -146, 4, 48)
  street(7.5, -169, 25, 4)
  street(7.5, -145, 25, 3.5)
  street(7.5, -127, 25, 3.5)
  street(7.5, -157, 25, 3.5)
  street(-11, -145, 13, 3.5)
  path(-20, -145, 9, 3.5)
  // 市區代表建築，各有入口、窗框、瓦條和屋頂標誌。
  function building(x, z, { roof, wall = '#e2dfb9', w = 6, d = 4.5, h = 3, emblem = false, label = '' }) {
    const p = new Group(); p.position.set(x, 0, z); root.add(p)
    box('#788891', 0, 0.16, 0, w + 0.3, 0.32, d + 0.3, p)
    box('#639f75', .15, -.045, .3, w+1.35, .05, d+1.3, p)
    box(wall, 0, h / 2, 0, w, h, d, p)
    shape('gable', wall, 0, h, 0, w, .78, d, p)
    box('#52677f', 0, h-.05, 0, w+.4, .2, d+.4, p)
    for (const side of [-1,1]) {
      box('#788891', side*(w/2-.08), h/2, d/2+.04, .16, h, .12, p)
      box('#f1e7cb', 0, .48, side*(d/2+.02), w, .15, .08, p)
    }
    box('#f1e7cb', 0, h - 0.4, d / 2 + 0.04, w, 0.18, 0.16, p)
    for (const side of [-1, 1]) {
      const tile = box(roof, 0, h + 0.45, side * d / 4, w + 0.65, 0.18, d / 2 + 0.42, p)
      tile.rotation.x = side * 0.24
      for (let i = 0; i < w * 2; i++) box(roof, -w / 2 + i * 0.5, h + 0.52, side * d / 4, 0.06, 0.12, d / 2 + 0.3, p).rotation.x = side * 0.24
      for (let j=1; j<5; j++) {
        const z=j*(d/2+.3)/5
        box(roof, 0, h+.81-z*.245, side*z, w+.65, .065, .045, p).rotation.x=side*.24
      }
      box(roof, 0, h+.12, side*(d/2+.3), w+.75, .22, .16, p)
      for (const x of [-1,1]) box(roof, x*(w/2+.28), h+.45, side*d/4, .14, .25, d/2+.48, p).rotation.x=side*.24
    }
    box(roof, 0, h + 0.79, 0, w + 0.65, 0.14, 0.2, p)
    windowAt(-w * 0.3, 1.3, d / 2 + 0.1, w * 0.23, 0.85, p)
    windowAt(w * 0.3, 1.3, d / 2 + 0.1, w * 0.23, 0.85, p)
    box('#617c86', 0, 0.95, d / 2 + 0.12, 1.2, 1.8, 0.18, p)
    box('#83c8e2', 0, 1.1, d / 2 + 0.23, 0.9, 1.2, 0.05, p)
    box('#e3e4d6', 0, 0.2, d / 2 + 0.6, 1.9, 0.25, 1.2, p)
    box('#788891', 0, .1, d/2+1, 2.1, .13, .35, p)
    if (label) {
      box('#edf1db', -w*.32, .57, d/2+.19, 1.45, .47, .13, p)
      lettering(label, -w*.32, .57, d/2+.28, .065, p)
    }
    if (emblem) {
      const disc = shape('cylinder', '#f6edcf', 0, 2.8, d / 2 + 0.3, 0.6, 0.15, 0.6, p)
      disc.rotation.x = Math.PI / 2
      box(roof, 0, 2.95, d / 2 + 0.42, 0.8, 0.24, 0.06, p)
      box('#5d6973', 0, 2.77, d / 2 + 0.44, 1, 0.08, 0.07, p)
      const button = shape('cylinder', '#f6edcf', 0, 2.78, d / 2 + 0.49, 0.16, 0.05, 0.16, p)
      button.rotation.x = Math.PI / 2
    } else {
      box('#bfa463', w * 0.3, h + 1, -0.8, 0.65, 1.25, 0.7, p)
      box('#79734f', w * 0.3, h + 1.65, -0.8, 0.8, 0.1, 0.85, p)
      box('#52677f', w*.3, h+1.72, -.8, .46, .04, .5, p)
      for (let i=0; i<3; i++) box('#79734f', w*.3, h+.72+i*.25, -.43, .52, .05, .04, p)
    }
  }
  function lettering(text, x, y, z, size, parent) {
    const glyphs = {P:['110','101','110','100','100'],C:['111','100','100','100','111'],S:['111','100','111','001','111'],H:['101','101','111','101','101'],O:['111','101','101','101','111'],G:['111','100','101','101','111'],Y:['101','101','010','010','010'],M:['101','111','111','101','101']}
    for (let n=0; n<text.length; n++) for (let row=0; row<5; row++) for (let col=0; col<3; col++) {
      if (glyphs[text[n]][row][col] === '1') box('#ae4b49', x+(n*4+col-(text.length*4-2)/2)*size, y+(2-row)*size, z, size*.8, size*.8, .025, parent)
    }
  }
  building(3, -133, { roof: '#d7685c', wall: '#dfebe2', w: 6.8, emblem: true, label: 'PC' }) // 寶可夢中心
  building(12, -151, { roof: '#5597c1', wall: '#dae5df', emblem: true, label: 'SHOP' }) // 商店
  building(2, -151, { roof: '#6e9a4f', w: 5 })
  building(2, -163, { roof: '#72a44f', w: 5.5 })
  building(12, -164, { roof: '#b5a15d', wall: '#d8ceaa', w: 8, d: 6, h: 4, emblem: true, label: 'GYM' }) // 道館
  for (let i = 0; i < 6; i++) flowers(10 + (i % 3) * 1.8, -137 + Math.floor(i / 3) * 1.6, 3)
  for (let i = 0; i < 5; i++) { tree(-14 + i * 2.5, -167, i); tree(-14 + i * 2.5, -154, i + 2) }
  for (let z = -165; z <= -156; z += 3) for (let x = -14; x <= -7; x += 3) tree(x, z, Math.round(-z))
  fence(-16, -151, 21); fence(-16, -171, 21)
  fence(-16, -171, 33, true); fence(-3.6, -171, 33, true)
  fence(3.5, -157, 26)
  pond(-12, -134, 6, 6.5)
  for (let i=0; i<9; i++) shape('crown', '#88ba6d', -4.6, .36, -154-i*1.7, .43,.45,.43)
  for (const [x,z] of [[-.8,-150],[4.8,-150],[-1,-163],[5,-163]]) shape('crown', '#88ba6d', x,.38,z,.42,.46,.42)
  // 西側是連續岩台、層狀崖面與碎石紋理，不是堆疊圓球；西出口留通道。
  for (const [z,d] of [[-130,24],[-163,28]]) {
    box('#947965', -25, 2.2, z, 8, 4.7, d)
    box('#b5987b', -25.3, 4.64, z, 7.4, .2, d-.4)
    for (let row=0; row<4; row++) {
      box(row%2 ? '#867c79' : '#947965', -20.95+row*.11, .45+row, z, .3, .22, d)
      for (let j=0; j<d/.85; j++) {
        const stone=shape('rock', (j+row)%3 ? '#b5987b' : '#b0a084', -20.85+row*.08, .6+row+(j%3)*.06, z-d/2+j*.85+.35, .38, .5, .57)
        stone.rotation.x = ((j+row)%3-1)*.2
      }
    }
    for (let i=0; i<(lowPower ? 60 : 140); i++) {
      const rock=shape('rock', i%3 ? '#b0a084' : '#947965', -25.3+Math.sin(i*127.1)*3.1, 4.82, z+Math.sin(i*311.7)*(d/2-.4), .4,.16,.55)
      rock.rotation.y=(i%4)*.7
    }
  }
  for (let i = 0; i < 22; i++) { tree(23, -118 - i * 2.8, i); tree(26, -118 - i * 2.8, i + 4) }
  for (let i = 0; i < 16; i++) { tree(-18 + i * 2.7, -178, i); tree(-18 + i * 2.7, -181, i + 4) }
  for (let i = 0; i < 6; i++) { tree(-19 + i * 2.5, -118, i); tree(6 + i * 2.5, -118, i + 3) }
  sign(-5, -120); sign(-5, -145)
}
