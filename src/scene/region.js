// 真新鎮北側的連續地景。沿用村莊的幾何、材質與合併流程。
export function buildNorthernRegion({ box, shape, tree, fence, windowAt, root, lowPower, Group }) {
  const road = '#e3cf91'
  const path = (x, z, w, d) => box(road, x, -0.055, z, w, 0.1, d)
  // 一號道路，南口 z=-19，北口 z=-112。折返步道之間是長草與矮土坡。
  path(0, -22, 4.2, 10)
  path(4, -28, 12, 4.2)
  path(8, -36, 4.2, 20)
  path(0, -45, 20, 4.2)
  path(-8, -53, 4.2, 19)
  path(0, -62, 20, 4.2)
  path(8, -71, 4.2, 21)
  path(0, -81, 20, 4.2)
  path(-8, -90, 4.2, 21)
  path(-4, -100, 12, 4.2)
  path(0, -107, 4.2, 16)

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
    const step = lowPower ? 1.05 : 0.75
    for (let dx = -w / 2 + 0.4; dx < w / 2; dx += step) {
      for (let dz = -d / 2 + 0.4; dz < d / 2; dz += step) {
        const blade = shape('cone', '#3f8c5a', x + dx, 0.38, z + dz, 0.3, 0.85, 0.16)
        blade.rotation.z = 0.18
        const tip = shape('cone', '#85bc6f', x + dx + 0.2, 0.28, z + dz + 0.14, 0.18, 0.6, 0.2)
        tip.rotation.z = -0.35
      }
    }
  }
  grassPatch(-6, -35, 12, 10)
  grassPatch(5, -54, 12, 9)
  grassPatch(-5, -72, 12, 9)
  grassPatch(5, -91, 12, 10)
  grassPatch(-9, -108, 7, 7)
  for (const [x, z, w] of [[-6, -41, 13], [6, -59, 13], [-6, -77, 13], [6, -97, 13]]) {
    box('#947965', x, 0.28, z, w, 0.7, 0.65)
    box('#78ac76', x, 0.66, z - 0.1, w, 0.12, 0.9)
    for (let i = 0; i < w; i++) box('#b5987b', x - w / 2 + i, 0.2, z + 0.36, 0.45, 0.23, 0.1)
  }
  for (let i = 0; i < 36; i++) {
    const z = -20 - i * 2.7
    tree(-16, z, i); tree(16, z, i + 7)
    if (i % 2 === 0) { tree(-19, z - 1, i + 4); tree(19, z - 1, i + 9) }
    if (i % 6 === 0) { flowers(-12, z, 4); flowers(11, z - 3, 4) }
  }
  fence(-14, -22, 15); fence(5, -22, 14)
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
  // 市區代表建築，各有入口、窗框、瓦條和屋頂標誌。
  function building(x, z, { roof, wall = '#e2dfb9', w = 6, d = 4.5, h = 3, emblem = false }) {
    const p = new Group(); p.position.set(x, 0, z); root.add(p)
    box('#788891', 0, 0.16, 0, w + 0.3, 0.32, d + 0.3, p)
    box(wall, 0, h / 2, 0, w, h, d, p)
    box('#f1e7cb', 0, h - 0.4, d / 2 + 0.04, w, 0.18, 0.16, p)
    for (const side of [-1, 1]) {
      const tile = box(roof, 0, h + 0.45, side * d / 4, w + 0.65, 0.18, d / 2 + 0.42, p)
      tile.rotation.x = side * 0.24
      for (let i = 0; i < w * 2; i++) box(roof, -w / 2 + i * 0.5, h + 0.49, side * d / 4, 0.065, 0.13, d / 2 + 0.3, p).rotation.x = side * 0.24
    }
    box(roof, 0, h + 0.79, 0, w + 0.65, 0.14, 0.2, p)
    windowAt(-w * 0.3, 1.3, d / 2 + 0.1, w * 0.23, 0.85, p)
    windowAt(w * 0.3, 1.3, d / 2 + 0.1, w * 0.23, 0.85, p)
    box('#617c86', 0, 0.95, d / 2 + 0.12, 1.2, 1.8, 0.18, p)
    box('#83c8e2', 0, 1.1, d / 2 + 0.23, 0.9, 1.2, 0.05, p)
    box('#e3e4d6', 0, 0.2, d / 2 + 0.6, 1.9, 0.25, 1.2, p)
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
    }
  }
  building(3, -133, { roof: '#d7685c', wall: '#dfebe2', w: 6.8, emblem: true }) // 寶可夢中心
  building(12, -151, { roof: '#5597c1', wall: '#dae5df', emblem: true }) // 商店
  building(2, -151, { roof: '#6e9a4f', w: 5 })
  building(2, -163, { roof: '#72a44f', w: 5.5 })
  building(12, -164, { roof: '#b5a15d', wall: '#d8ceaa', w: 8, d: 6, h: 4, emblem: true }) // 道館
  for (let i = 0; i < 6; i++) flowers(10 + (i % 3) * 1.8, -137 + Math.floor(i / 3) * 1.6, 3)
  for (let i = 0; i < 5; i++) { tree(-14 + i * 2.5, -167, i); tree(-14 + i * 2.5, -154, i + 2) }
  for (let z = -165; z <= -156; z += 3) for (let x = -14; x <= -7; x += 3) tree(x, z, Math.round(-z))
  fence(-16, -151, 21); fence(-16, -171, 21)
  box('#877e76', -12, 0, -134, 6, 0.3, 6.5)
  box('#529db9', -12, 0.18, -134, 5.5, 0.08, 6)
  // 西側岩壁用交錯石塊分層，上緣覆草，留出通往西側的開口。
  for (let i = 0; i < 20; i++) {
    const z = -119 - i * 3
    if (z < -141 && z > -149) continue
    for (let row = 0; row < 3; row++) {
      shape('crown', row % 2 ? '#9b9076' : '#b0a084', -23 - row * 0.45, 0.9 + row * 1.65, z, 3, 1.3, 2)
    }
    box('#7b9e69', -24, 5.3, z, 4.5, 0.35, 3.3)
  }
  for (let i = 0; i < 22; i++) { tree(23, -118 - i * 2.8, i); tree(26, -118 - i * 2.8, i + 4) }
  for (let i = 0; i < 16; i++) { tree(-18 + i * 2.7, -178, i); tree(-18 + i * 2.7, -181, i + 4) }
  for (let i = 0; i < 6; i++) { tree(-19 + i * 2.5, -118, i); tree(6 + i * 2.5, -118, i + 3) }
  sign(-5, -120); sign(-5, -145)
}
