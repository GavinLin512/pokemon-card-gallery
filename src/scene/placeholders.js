// 佔位圖（PLAN §8.2）：素材未到時，以 Canvas 2D 畫出真新鎮的幾何體再交給 three.js 當貼圖。
// 造型與配色參考遊戲版真新鎮俯視圖：兩棟橘紅屋頂灰藍牆民宅、黃牆灰瓦研究所、柵欄、花圃、池塘、沙路、環繞的圓頂樹。
// 雲朵與樹列不碰左右邊界，讓 RepeatWrapping 平鋪飄移時邊緣不露白。

const C = {
  cloud: 'rgba(255,255,255,0.96)',
  cloudShade: 'rgba(220,235,250,0.9)',
  grass: '#a9e2a0',
  grassDot: '#8fd08a',
  grassDark: '#6cbf6a',
  treeDark: '#3f8f4a',
  treeMid: '#5cb45e',
  treeLight: '#8fdc72',
  treeOutline: '#2d6b36',
  trunk: '#8a5a3c',
  roof: '#e8703a',
  roofRidge: '#c8542a',
  roofTop: '#f3945f',
  wall: '#bcc5d1',
  wallShade: '#98a3b2',
  outline: '#5d6675',
  window: '#5aa9e6',
  windowLit: '#ffd76a',
  door: '#c9483a',
  mailbox: '#f2f4f7',
  labWall: '#e9d27b',
  labWallShade: '#cdb45f',
  labRoof: '#8b949f',
  labRoofLine: '#6e7783',
  labVent: '#b83a2e',
  labDoorRoof: '#4caf50',
  fence: '#c9ced8',
  fenceShade: '#9aa2b0',
  flower: '#e84a4a',
  flowerLeaf: '#4faa4f',
  sand: '#e6d29a',
  sandEdge: '#cdb87e',
  pond: '#4a90e2',
  pondDeep: '#3b78c4',
  pondEdge: '#2f5a8a',
  pondWave: '#8cc4ff',
  haze: 'rgba(255,255,255,0.9)',
  moon: '#fff4c2'
}

function canvasFor(width, height) {
  const c = document.createElement('canvas')
  c.width = Math.round(width)
  c.height = Math.round(height)
  return c
}

function box(ctx, x, y, w, h, fill, stroke = C.outline, lw = 3) {
  ctx.fillStyle = fill
  ctx.fillRect(x, y, w, h)
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.strokeRect(x, y, w, h)
  }
}

function cloud(ctx, x, y, r) {
  const puffs = [[0, 0, 1], [-0.9, 0.2, 0.75], [0.9, 0.15, 0.8], [-0.4, -0.45, 0.7], [0.45, -0.5, 0.65], [1.6, 0.35, 0.5], [-1.6, 0.4, 0.5]]
  ctx.fillStyle = C.cloudShade
  for (const [dx, dy, s] of puffs) {
    ctx.beginPath()
    ctx.ellipse(x + dx * r, y + dy * r + r * 0.18, r * s, r * s * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = C.cloud
  for (const [dx, dy, s] of puffs) {
    ctx.beginPath()
    ctx.ellipse(x + dx * r, y + dy * r, r * s, r * s * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** 圓頂樹：深綠底、中綠身、亮綠高光，帶樹幹 */
function tree(ctx, x, baseY, s) {
  ctx.fillStyle = C.trunk
  ctx.fillRect(x - s * 0.1, baseY - s * 0.35, s * 0.2, s * 0.35)
  ctx.strokeStyle = C.treeOutline
  ctx.lineWidth = 3
  ctx.fillStyle = C.treeDark
  ctx.beginPath()
  ctx.ellipse(x, baseY - s * 0.75, s * 0.5, s * 0.55, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = C.treeMid
  ctx.beginPath()
  ctx.ellipse(x - s * 0.05, baseY - s * 0.85, s * 0.38, s * 0.4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = C.treeLight
  ctx.beginPath()
  ctx.ellipse(x - s * 0.15, baseY - s * 1.0, s * 0.18, s * 0.16, 0, 0, Math.PI * 2)
  ctx.fill()
}

/** 民宅：2.5D 盒子，屋頂有頂面與正面、三道屋脊線；lit 只畫亮窗 */
function house(ctx, x, baseY, w, h, lit) {
  const wallH = h * 0.5
  const roofFrontH = h * 0.3
  const roofTopH = h * 0.2
  const wallY = baseY - wallH
  if (!lit) {
    // 牆
    box(ctx, x, wallY, w, wallH, C.wall)
    ctx.fillStyle = C.wallShade
    ctx.fillRect(x + w - w * 0.12, wallY, w * 0.12, wallH)
    // 屋頂正面（略寬於牆）
    const rx = x - w * 0.06
    const rw = w * 1.12
    box(ctx, rx, wallY - roofFrontH, rw, roofFrontH, C.roof, C.roofRidge)
    ctx.strokeStyle = C.roofRidge
    ctx.lineWidth = 3
    for (let i = 1; i <= 3; i++) {
      const yy = wallY - roofFrontH + (roofFrontH * i) / 4
      ctx.beginPath()
      ctx.moveTo(rx, yy)
      ctx.lineTo(rx + rw, yy)
      ctx.stroke()
    }
    // 屋頂頂面（後退的平行四邊形）
    ctx.fillStyle = C.roofTop
    ctx.beginPath()
    ctx.moveTo(rx, wallY - roofFrontH)
    ctx.lineTo(rx + rw * 0.12, wallY - roofFrontH - roofTopH)
    ctx.lineTo(rx + rw * 0.88, wallY - roofFrontH - roofTopH)
    ctx.lineTo(rx + rw, wallY - roofFrontH)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = C.roofRidge
    ctx.stroke()
    // 門與信箱
    box(ctx, x + w * 0.16, baseY - wallH * 0.62, w * 0.16, wallH * 0.62, C.door)
    box(ctx, x - w * 0.16, baseY - wallH * 0.55, w * 0.1, wallH * 0.3, C.mailbox)
    ctx.fillStyle = C.outline
    ctx.fillRect(x - w * 0.125, baseY - wallH * 0.25, w * 0.03, wallH * 0.25)
  }
  // 窗（兩層各兩扇）
  ctx.fillStyle = lit ? C.windowLit : C.window
  for (const [fx, fy] of [[0.42, 0.72], [0.66, 0.72], [0.42, 0.3], [0.66, 0.3]]) {
    const wx = x + w * fx
    const wy = baseY - wallH * fy - wallH * 0.1
    ctx.fillRect(wx, wy, w * 0.16, wallH * 0.2)
    if (!lit) {
      ctx.strokeStyle = C.outline
      ctx.lineWidth = 2
      ctx.strokeRect(wx, wy, w * 0.16, wallH * 0.2)
    }
  }
  if (lit) {
    ctx.fillStyle = 'rgba(255,215,106,0.32)'
    for (const [fx, fy] of [[0.42, 0.72], [0.66, 0.72], [0.42, 0.3], [0.66, 0.3]]) {
      ctx.fillRect(x + w * fx - w * 0.03, baseY - wallH * fy - wallH * 0.14, w * 0.22, wallH * 0.28)
    }
  }
}

function fence(ctx, x, y, len, s) {
  ctx.fillStyle = C.fenceShade
  ctx.fillRect(x, y + s * 0.35, len, s * 0.12)
  for (let px = x; px <= x + len; px += s * 0.8) {
    box(ctx, px, y, s * 0.28, s, C.fence, C.fenceShade, 2)
  }
}

function flowerBed(ctx, x, y, w, h, s) {
  ctx.fillStyle = C.grassDark
  ctx.globalAlpha = 0.35
  ctx.fillRect(x, y, w, h)
  ctx.globalAlpha = 1
  for (let fy = y + s * 0.6; fy < y + h; fy += s * 1.3) {
    for (let fx = x + s * 0.6; fx < x + w; fx += s * 1.3) {
      ctx.fillStyle = C.flowerLeaf
      ctx.fillRect(fx - s * 0.35, fy + s * 0.1, s * 0.7, s * 0.3)
      ctx.fillStyle = C.flower
      for (const [dx, dy] of [[0, -0.25], [-0.25, 0], [0.25, 0], [0, 0.2]]) {
        ctx.beginPath()
        ctx.arc(fx + dx * s, fy + dy * s, s * 0.2, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#ffe36a'
      ctx.beginPath()
      ctx.arc(fx, fy, s * 0.12, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function pond(ctx, x, y, w, h) {
  ctx.fillStyle = C.pondEdge
  ctx.beginPath()
  ctx.roundRect(x - 8, y - 8, w + 16, h + 16, 24)
  ctx.fill()
  ctx.fillStyle = C.pondDeep
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 18)
  ctx.fill()
  ctx.fillStyle = C.pond
  ctx.beginPath()
  ctx.roundRect(x + w * 0.08, y + h * 0.1, w * 0.84, h * 0.7, 14)
  ctx.fill()
  ctx.strokeStyle = C.pondWave
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  for (let i = 0; i < 4; i++) {
    const wy = y + h * (0.25 + i * 0.18)
    const wx = x + w * (0.15 + (i % 2) * 0.25)
    ctx.beginPath()
    ctx.moveTo(wx, wy)
    ctx.quadraticCurveTo(wx + w * 0.1, wy - 8, wx + w * 0.2, wy)
    ctx.quadraticCurveTo(wx + w * 0.3, wy + 8, wx + w * 0.4, wy)
    ctx.stroke()
  }
}

const painters = {
  'clouds-far'(ctx, w, h) {
    cloud(ctx, w * 0.18, h * 0.45, h * 0.15)
    cloud(ctx, w * 0.52, h * 0.3, h * 0.12)
    cloud(ctx, w * 0.8, h * 0.55, h * 0.14)
  },
  'clouds-near'(ctx, w, h) {
    cloud(ctx, w * 0.25, h * 0.5, h * 0.24)
    cloud(ctx, w * 0.72, h * 0.42, h * 0.22)
  },
  /** 遠景樹列：沿地平線一整排較小的圓頂樹，兩排錯落 */
  treeline(ctx, w, h) {
    const s = h * 0.3
    for (let x = s * 0.3; x < w; x += s * 0.62) tree(ctx, x, h * 0.9, s * (0.9 + ((x / s) % 3) * 0.08))
    for (let x = s * 0.6; x < w; x += s * 0.7) tree(ctx, x, h * 1.0, s * (0.95 + ((x / s) % 2) * 0.1))
  },
  haze(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.6, C.haze)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  },
  /** 田野：草地點紋、沙路、花圃、柵欄 */
  fields(ctx, w, h) {
    ctx.fillStyle = C.grass
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = C.grassDot
    const step = h * 0.045
    for (let y = step * 0.5; y < h; y += step) {
      for (let x = (Math.round(y / step) % 2) * step * 0.5; x < w; x += step) {
        ctx.fillRect(x, y, step * 0.18, step * 0.18)
      }
    }
    // 沙路：由底部中央蜿蜒向右上到研究所
    ctx.strokeStyle = C.sandEdge
    ctx.lineWidth = h * 0.13
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(w * 0.42, h * 1.05)
    ctx.bezierCurveTo(w * 0.48, h * 0.7, w * 0.6, h * 0.55, w * 0.78, h * 0.3)
    ctx.stroke()
    ctx.strokeStyle = C.sand
    ctx.lineWidth = h * 0.1
    ctx.stroke()
    // 花圃與柵欄（左側）
    flowerBed(ctx, w * 0.12, h * 0.36, w * 0.14, h * 0.12, h * 0.035)
    fence(ctx, w * 0.11, h * 0.3, w * 0.16, h * 0.05)
    fence(ctx, w * 0.5, h * 0.62, w * 0.14, h * 0.05)
  },
  /** 大木研究所：黃磚牆、灰瓦頂、紅色通風塔、圓窗、綠頂門廊 */
  lab(ctx, w, h) {
    const baseY = h * 0.98
    const bw = w * 0.76
    const bx = w * 0.12
    const wallH = h * 0.36
    const wallY = baseY - wallH
    box(ctx, bx, wallY, bw, wallH, C.labWall)
    ctx.fillStyle = C.labWallShade
    ctx.fillRect(bx + bw - bw * 0.1, wallY, bw * 0.1, wallH)
    // 磚縫
    ctx.strokeStyle = C.labWallShade
    ctx.lineWidth = 2
    for (let i = 1; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(bx, wallY + (wallH * i) / 4)
      ctx.lineTo(bx + bw, wallY + (wallH * i) / 4)
      ctx.stroke()
    }
    // 屋頂正面與頂面（瓦片格線）
    const roofH = h * 0.22
    const rx = bx - w * 0.04
    const rw = bw + w * 0.08
    box(ctx, rx, wallY - roofH, rw, roofH, C.labRoof, C.labRoofLine)
    ctx.strokeStyle = C.labRoofLine
    ctx.lineWidth = 2
    for (let i = 1; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(rx, wallY - roofH + (roofH * i) / 4)
      ctx.lineTo(rx + rw, wallY - roofH + (roofH * i) / 4)
      ctx.stroke()
    }
    for (let i = 1; i < 10; i++) {
      ctx.beginPath()
      ctx.moveTo(rx + (rw * i) / 10, wallY - roofH)
      ctx.lineTo(rx + (rw * i) / 10, wallY)
      ctx.stroke()
    }
    const topH = h * 0.12
    ctx.fillStyle = '#a3acb6'
    ctx.beginPath()
    ctx.moveTo(rx, wallY - roofH)
    ctx.lineTo(rx + rw * 0.1, wallY - roofH - topH)
    ctx.lineTo(rx + rw * 0.9, wallY - roofH - topH)
    ctx.lineTo(rx + rw, wallY - roofH)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = C.labRoofLine
    ctx.stroke()
    // 紅色通風塔
    box(ctx, rx + rw * 0.66, wallY - roofH - topH - h * 0.1, rw * 0.14, h * 0.18, C.labVent, '#7d2a22')
    // 圓窗
    for (const fx of [0.18, 0.36, 0.64, 0.82]) {
      ctx.fillStyle = C.window
      ctx.beginPath()
      ctx.arc(bx + bw * fx, wallY + wallH * 0.35, wallH * 0.14, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = C.outline
      ctx.lineWidth = 3
      ctx.stroke()
    }
    // 綠頂門廊
    box(ctx, bx + bw * 0.42, baseY - wallH * 0.5, bw * 0.16, wallH * 0.5, '#6f8fb0')
    box(ctx, bx + bw * 0.38, baseY - wallH * 0.56, bw * 0.24, wallH * 0.1, C.labDoorRoof, '#2e7d32')
    // 風車
    ctx.strokeStyle = C.labRoofLine
    ctx.lineWidth = w * 0.014
    ctx.beginPath()
    ctx.moveTo(w * 0.94, baseY)
    ctx.lineTo(w * 0.94, baseY - h * 0.72)
    ctx.stroke()
    ctx.lineWidth = w * 0.02
    for (let a = 0; a < 4; a++) {
      const ang = (a * Math.PI) / 2 + 0.4
      ctx.beginPath()
      ctx.moveTo(w * 0.94, baseY - h * 0.72)
      ctx.lineTo(w * 0.94 + Math.cos(ang) * w * 0.11, baseY - h * 0.72 + Math.sin(ang) * w * 0.11)
      ctx.stroke()
    }
  },
  houses(ctx, w, h) {
    house(ctx, w * 0.22, h * 0.98, w * 0.24, h * 0.9, false)
    house(ctx, w * 0.6, h * 0.98, w * 0.22, h * 0.8, false)
  },
  'houses-night'(ctx, w, h) {
    house(ctx, w * 0.22, h * 0.98, w * 0.24, h * 0.9, true)
    house(ctx, w * 0.6, h * 0.98, w * 0.22, h * 0.8, true)
  },
  /** 池塘與一段柵欄（前景左側） */
  pond(ctx, w, h) {
    pond(ctx, w * 0.1, h * 0.3, w * 0.7, h * 0.6)
    fence(ctx, w * 0.05, h * 0.08, w * 0.9, h * 0.14)
  },
  /** 近景框樹：只在左右兩側，中間留空給內容 */
  'trees-near'(ctx, w, h) {
    const s = h * 0.5
    for (const [fx, fy, k] of [[0.03, 1.0, 1], [0.08, 0.96, 0.8], [0.02, 0.86, 0.65], [0.97, 1.0, 1], [0.92, 0.96, 0.8], [0.98, 0.86, 0.65]]) {
      tree(ctx, w * fx, h * fy, s * k)
    }
  },
  'foreground-grass'(ctx, w, h) {
    ctx.fillStyle = C.grassDark
    ctx.fillRect(0, h * 0.62, w, h * 0.38)
    ctx.fillStyle = C.treeDark
    for (let x = 0; x < w; x += h * 0.1) {
      ctx.beginPath()
      ctx.moveTo(x, h * 0.66)
      ctx.lineTo(x + h * 0.05, h * 0.42 + (x % 3) * h * 0.04)
      ctx.lineTo(x + h * 0.1, h * 0.66)
      ctx.closePath()
      ctx.fill()
    }
    ctx.fillRect(0, h * 0.66, w, h * 0.34)
  },
  moon(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.5)
    g.addColorStop(0, 'rgba(255,244,194,0.5)')
    g.addColorStop(1, 'rgba(255,244,194,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = C.moon
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, w * 0.26, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** 產生指定圖層的佔位圖 canvas。maxWidth 供低效能裝置限制貼圖尺寸。 */
export function drawPlaceholder(layer, maxWidth = 2048) {
  const scale = Math.min(1, maxWidth / layer.width)
  const c = canvasFor(layer.width * scale, layer.height * scale)
  const ctx = c.getContext('2d')
  const paint = painters[layer.key]
  if (paint) paint(ctx, c.width, c.height)
  return c
}

/** 載入使用者素材並縮到 maxWidth 內；失敗時回傳 null。 */
export function loadAsset(src, maxWidth = 2048) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.naturalWidth)
      const c = canvasFor(img.naturalWidth * scale, img.naturalHeight * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      resolve(c)
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}
