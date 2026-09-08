// 真新鎮北側的連續地景。沿用村莊的幾何、材質與合併流程。
export function buildNorthernRegion({ box, shape, tree, fence, windowAt, root, lowPower, Group, pond }) {
  const road = '#e3cf91'
  const path = (x, z, w, d) => box(road, x, -0.055, z, w, 0.1, d)
  // 依 route-01.webp 的像素地圖配置：南口長草、東側折返、中央雙土坡、北口長草。
  const routePoint = (px, py) => [(px - 192) / 12, -19 - (608 - py) * .16]
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
  function ledge(px, py, width) {
    const [x,z] = routePoint(px,py), w=width/12
    box('#947965', x, .19, z, w, .52, .48)
    box('#639f75', x, .47, z-.12, w, .08, .65)
    for (let i=0; i<w/.5; i++) {
      const rock = box(i%2 ? '#867c79' : '#b5987b', x-w/2+i*.5+.2, .18, z+.23, .4, .32, .14)
      rock.rotation.z = (i%3-1)*.18
    }
  }
  for (const ledgeSpec of [[106,510,148],[264,510,176],[324,427,48],
    [106,333,50],[264,333,174],[47,333,30],[87,253,108],[86,173,108],
    [86,93,108],[239,94,159]]) ledge(...ledgeSpec)
  for (const [px,py] of [[143,80],[143,112],[143,145],[48,248],
    [175,247],[207,247],[239,247],[48,406],[80,406],[112,406],[144,406],[175,406]]) {
    const [x,z] = routePoint(px,py); tree(x,z,px+py)
  }
  for (let i = 0; i < 36; i++) {
    const z = -20 - i * 2.7
    tree(-16, z, i); tree(16, z, i + 7)
    if (i % 2 === 0) { tree(-19, z - 1, i + 4); tree(19, z - 1, i + 9) }
    if (i % 6 === 0) { flowers(-12, z, 4); flowers(11, z - 3, 4) }
  }
  fence(-13.3, -22, 21); fence(2.8, -22, 18)
  function sign(x, z) {
    box('#816c50', x, 0.55, z, 0.14, 1.1, 0.14)
    box('#e9debd', x, 1.2, z, 1, 0.7, 0.14)
    for (let i = 0; i < 3; i++) box('#8b8871', x, 1.35 - i * 0.16, z + 0.08, 0.65, 0.04, 0.02)
  }
  sign(-3, -23); sign(3, -108)

  // 常磐市：白色街道環繞市區；入口從南側中央接入。
  const street = (x, z, w, d) => box('#d2dfce', x, -0.025, z, w, 0.12, d)
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
