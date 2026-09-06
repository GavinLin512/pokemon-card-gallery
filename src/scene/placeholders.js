// 佔位圖（PLAN §8.2）：素材未到時，以 Canvas 2D 畫出純色幾何體，再交給 three.js 當貼圖。
// 雲朵不碰左右邊界，讓 RepeatWrapping 平鋪飄移時邊緣不露白。

const COLORS = {
  cloud: 'rgba(255,255,255,0.95)',
  mountain: '#5aa66a',
  mountainFar: '#7cbf86',
  field: '#6fbf5a',
  fieldDark: '#5aa84a',
  path: '#e9d3a3',
  roof: '#d9534f',
  wall: '#fff8ec',
  wallShade: '#e8dcc6',
  door: '#7a4a27',
  window: '#3a4a66',
  windowLit: '#ffd76a',
  lab: '#f4f4f0',
  labRoof: '#8fa3b8',
  grass: '#3f8a35',
  grassDark: '#2f6e28',
  moon: '#fff4c2'
}

function canvasFor(width, height) {
  const c = document.createElement('canvas')
  c.width = Math.round(width)
  c.height = Math.round(height)
  return c
}

function cloud(ctx, x, y, r) {
  ctx.fillStyle = COLORS.cloud
  const puffs = [
    [0, 0, 1],
    [-0.9, 0.2, 0.75],
    [0.9, 0.15, 0.8],
    [-0.4, -0.45, 0.7],
    [0.45, -0.5, 0.65],
    [1.6, 0.35, 0.5],
    [-1.6, 0.4, 0.5]
  ]
  for (const [dx, dy, s] of puffs) {
    ctx.beginPath()
    ctx.ellipse(x + dx * r, y + dy * r, r * s, r * s * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function house(ctx, x, baseY, w, h, lit) {
  const roofH = h * 0.45
  const wallH = h - roofH
  if (!lit) {
    ctx.fillStyle = COLORS.wall
    ctx.fillRect(x, baseY - wallH, w, wallH)
    ctx.fillStyle = COLORS.wallShade
    ctx.fillRect(x + w * 0.82, baseY - wallH, w * 0.18, wallH)
    ctx.fillStyle = COLORS.roof
    ctx.beginPath()
    ctx.moveTo(x - w * 0.08, baseY - wallH)
    ctx.lineTo(x + w / 2, baseY - h)
    ctx.lineTo(x + w * 1.08, baseY - wallH)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = COLORS.door
    ctx.fillRect(x + w * 0.42, baseY - wallH * 0.55, w * 0.16, wallH * 0.55)
  }
  ctx.fillStyle = lit ? COLORS.windowLit : COLORS.window
  for (const wx of [0.12, 0.7]) {
    ctx.fillRect(x + w * wx, baseY - wallH * 0.85, w * 0.18, wallH * 0.3)
  }
  if (lit) {
    ctx.fillStyle = 'rgba(255,215,106,0.35)'
    for (const wx of [0.12, 0.7]) {
      ctx.fillRect(x + w * wx - w * 0.03, baseY - wallH * 0.88, w * 0.24, wallH * 0.36)
    }
  }
}

const painters = {
  'clouds-far'(ctx, w, h) {
    cloud(ctx, w * 0.18, h * 0.45, h * 0.16)
    cloud(ctx, w * 0.52, h * 0.3, h * 0.13)
    cloud(ctx, w * 0.8, h * 0.55, h * 0.15)
  },
  'clouds-near'(ctx, w, h) {
    cloud(ctx, w * 0.25, h * 0.5, h * 0.24)
    cloud(ctx, w * 0.72, h * 0.42, h * 0.22)
  },
  mountains(ctx, w, h) {
    ctx.fillStyle = COLORS.mountainFar
    ctx.beginPath()
    ctx.moveTo(0, h)
    const farPeaks = [[0.05, 0.78], [0.2, 0.55], [0.35, 0.74], [0.5, 0.5], [0.65, 0.72], [0.82, 0.58], [0.95, 0.76]]
    for (const [px, py] of farPeaks) ctx.lineTo(w * px, h * py)
    ctx.lineTo(w, h * 0.8)
    ctx.lineTo(w, h)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = COLORS.mountain
    ctx.beginPath()
    ctx.moveTo(0, h)
    const nearPeaks = [[0, 0.88], [0.12, 0.68], [0.28, 0.85], [0.42, 0.62], [0.58, 0.84], [0.74, 0.66], [0.9, 0.88], [1, 0.82]]
    for (const [px, py] of nearPeaks) ctx.lineTo(w * px, h * py)
    ctx.lineTo(w, h)
    ctx.closePath()
    ctx.fill()
  },
  haze(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.6, 'rgba(255,255,255,0.9)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  },
  fields(ctx, w, h) {
    ctx.fillStyle = COLORS.field
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = COLORS.fieldDark
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      ctx.ellipse(w * (0.1 + i * 0.17), h * (0.2 + (i % 2) * 0.3), w * 0.09, h * 0.07, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = COLORS.path
    ctx.lineWidth = h * 0.06
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(w * 0.35, h)
    ctx.bezierCurveTo(w * 0.45, h * 0.7, w * 0.55, h * 0.55, w * 0.66, h * 0.32)
    ctx.stroke()
  },
  lab(ctx, w, h) {
    const baseY = h * 0.98
    const bw = w * 0.7
    const bx = w * 0.15
    const bh = h * 0.45
    ctx.fillStyle = COLORS.lab
    ctx.fillRect(bx, baseY - bh, bw, bh)
    ctx.fillStyle = COLORS.labRoof
    ctx.fillRect(bx - w * 0.03, baseY - bh - h * 0.04, bw + w * 0.06, h * 0.05)
    ctx.fillStyle = COLORS.lab
    ctx.beginPath()
    ctx.arc(w * 0.5, baseY - bh - h * 0.04, w * 0.2, Math.PI, 0)
    ctx.fill()
    ctx.fillStyle = COLORS.window
    for (let i = 0; i < 4; i++) ctx.fillRect(bx + bw * (0.1 + i * 0.22), baseY - bh * 0.75, bw * 0.12, bh * 0.28)
    ctx.fillStyle = COLORS.door
    ctx.fillRect(w * 0.46, baseY - bh * 0.4, w * 0.08, bh * 0.4)
    // 風車
    ctx.strokeStyle = COLORS.labRoof
    ctx.lineWidth = w * 0.015
    ctx.beginPath()
    ctx.moveTo(w * 0.86, baseY)
    ctx.lineTo(w * 0.86, baseY - h * 0.7)
    ctx.stroke()
    ctx.lineWidth = w * 0.02
    for (let a = 0; a < 4; a++) {
      const ang = (a * Math.PI) / 2 + 0.4
      ctx.beginPath()
      ctx.moveTo(w * 0.86, baseY - h * 0.7)
      ctx.lineTo(w * 0.86 + Math.cos(ang) * w * 0.12, baseY - h * 0.7 + Math.sin(ang) * w * 0.12)
      ctx.stroke()
    }
  },
  houses(ctx, w, h) {
    house(ctx, w * 0.3, h * 0.98, w * 0.26, h * 0.9, false)
    house(ctx, w * 0.64, h * 0.98, w * 0.2, h * 0.7, false)
  },
  'houses-night'(ctx, w, h) {
    house(ctx, w * 0.3, h * 0.98, w * 0.26, h * 0.9, true)
    house(ctx, w * 0.64, h * 0.98, w * 0.2, h * 0.7, true)
  },
  'foreground-grass'(ctx, w, h) {
    ctx.fillStyle = COLORS.grass
    ctx.fillRect(0, h * 0.6, w, h * 0.4)
    ctx.fillStyle = COLORS.grassDark
    for (let x = 0; x < w; x += h * 0.1) {
      ctx.beginPath()
      ctx.moveTo(x, h * 0.65)
      ctx.lineTo(x + h * 0.05, h * 0.42 + (x % 3) * h * 0.04)
      ctx.lineTo(x + h * 0.1, h * 0.65)
      ctx.closePath()
      ctx.fill()
    }
    ctx.fillRect(0, h * 0.65, w, h * 0.35)
  },
  moon(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.5)
    g.addColorStop(0, 'rgba(255,244,194,0.5)')
    g.addColorStop(1, 'rgba(255,244,194,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = COLORS.moon
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
