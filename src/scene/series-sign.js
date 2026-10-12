import { Group, Mesh, BoxGeometry, PlaneGeometry, DataTexture, RGBAFormat, NearestFilter, SRGBColorSpace, MeshStandardMaterial } from 'three'
import { addLandscapeWeather } from './weather-surfaces.js'

// 系列路牌（PLAN §15.8，2026-10-12）：研究所圍欄前、中央步道右側的木牌，開場畫面在桌機與手機都不被標題擋住。
// 正面畫劍盾系列的劍與盾、背面畫 151 系列的精靈球與「151」；切換系列時木牌繞立柱翻半圈換面。
// 立柱是靜態模型，由 village.js 與其他方塊一起合併；這裡只建立會轉動的牌面。

/** 路牌位置（世界座標，立柱中心）。 */
export const SERIES_SIGN = { x: 2.2, z: 11.6 }
const FLIP_SECONDS = .7
/** 牌面每格像素的世界尺寸；22×19 格約 1.4×1.2 單位。 */
const TEXEL = .065

const PALETTE = {
  '.': '#e9debd', k: '#3b3a48', b: '#3f72d4', r: '#d8465c', s: '#e4ebf2', g: '#e6b43c', n: '#7a5234', w: '#ffffff'
}
/** 牌面點陣，每列等寬，由上而下。 */
export const SIGN_FACES = {
  swsh: [
    '......................',
    '......................',
    '..........kk..........',
    '.........kggk.........',
    '..........nn..........',
    '.......kkkkkkkk.......',
    '.......kggggggk.......',
    '....kkkkkksskkkkkk....',
    '....kbbbbksskrrrrk....',
    '....kbbbbksskrrrrk....',
    '....kbbbbksskrrrrk....',
    '....kbbbbksskrrrrk....',
    '.....kbbbksskrrrk.....',
    '.....kbbbksskrrrk.....',
    '......kbbksskrrk......',
    '.......kbksskrk.......',
    '........kksskk........',
    '..........kk..........',
    '......................'
  ],
  151: [
    '......................',
    '.........kkkk.........',
    '.......kkrrrrkk.......',
    '.......krrrrwrk.......',
    '......krrrkkrrrk......',
    '......kkkkwwkkkk......',
    '......kwwwkkwwwk......',
    '......kwwwwwwwwk......',
    '.......kwwwwwwk.......',
    '.......kkwwwwkk.......',
    '.........kkkk.........',
    '......................',
    '.....kk..kkkk..kk.....',
    '....kkk..kk...kkk.....',
    '.....kk..kkk...kk.....',
    '.....kk....kk..kk.....',
    '.....kk....kk..kk.....',
    '....kkkk.kkk..kkkk....',
    '......................'
  ]
}
/** 哪個系列在正面（旋轉 0）；其餘在背面（旋轉 π）。 */
const FRONT = 'swsh'

function faceTexture(rows) {
  const height = rows.length, width = rows[0].length
  const data = new Uint8Array(width * height * 4)
  rows.forEach((row, y) => [...row].forEach((symbol, x) => {
    const hex = parseInt(PALETTE[symbol].slice(1), 16)
    // DataTexture 的第一列在牌面底部。
    data.set([hex >> 16, (hex >> 8) & 255, hex & 255, 255], ((height - 1 - y) * width + x) * 4)
  }))
  const texture = new DataTexture(data, width, height, RGBAFormat)
  texture.magFilter = texture.minFilter = NearestFilter
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

const easeOutBack = t => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2

/**
 * 會翻面的牌面；group 放在立柱頂端的地面座標。weatherUniforms 讓牌面與地景一樣受雨、雲影與龍影影響。
 * update(dt) 推進翻面，dt 為 Infinity 時直接到位（減少動態）。
 */
export function createSeriesSign({ series = FRONT, ground = 0, weatherUniforms, breeze = false, shadowed = false } = {}) {
  const width = SIGN_FACES.swsh[0].length * TEXEL, height = SIGN_FACES.swsh.length * TEXEL
  const geometry = { frame: new BoxGeometry(width + .17, height + .16, .12), cap: new BoxGeometry(width + .34, .1, .24), face: new PlaneGeometry(width, height) }
  const wood = new MeshStandardMaterial({ color: '#816c50', roughness: .9, flatShading: true })
  const roof = new MeshStandardMaterial({ color: '#6b5741', roughness: .9, flatShading: true })
  const textures = Object.values(SIGN_FACES).map(faceTexture)
  const faces = textures.map(map => new MeshStandardMaterial({ map, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: 0, roughness: .9 }))
  const materials = [wood, roof, ...faces]
  for (const mat of materials) addLandscapeWeather(mat, weatherUniforms, { breeze })

  const group = new Group()
  group.name = 'series-sign'
  group.position.set(SERIES_SIGN.x, ground + 1.55, SERIES_SIGN.z)
  const cap = new Mesh(geometry.cap, roof)
  cap.position.y = height / 2 + .13
  const parts = [new Mesh(geometry.frame, wood), cap, ...Object.keys(SIGN_FACES).map((id, i) => {
    const face = new Mesh(geometry.face, faces[i])
    face.name = `series-sign-${id}`
    face.position.z = id === FRONT ? .065 : -.065
    if (id !== FRONT) face.rotation.y = Math.PI
    return face
  })]
  for (const part of parts) { part.castShadow = part.receiveShadow = shadowed; group.add(part) }

  let shown = series in SIGN_FACES ? series : FRONT
  let from = shown === FRONT ? 0 : Math.PI, to = from, elapsed = FLIP_SECONDS
  group.rotation.y = to

  return {
    group,
    materials,
    get series() { return shown },
    /** 牌面正在翻轉。 */
    get turning() { return elapsed < FLIP_SECONDS },
    /** 換成另一個系列；instant 時不翻轉直接換面。未知或相同的系列不動。 */
    setSeries(id, instant = false) {
      if (!(id in SIGN_FACES) || id === shown) return
      shown = id
      // 轉到最近一個新系列朝外的角度：靜止時往前翻半圈；翻到一半又切回時，從目前角度轉回去。
      from = group.rotation.y
      const turns = from / Math.PI, parity = id === FRONT ? 0 : 1
      let n = Math.round(turns)
      if (Math.abs(n % 2) !== parity) n += turns >= n ? 1 : -1
      to = n * Math.PI
      elapsed = instant ? FLIP_SECONDS : 0
      if (instant) group.rotation.y = to
    },
    update(dt) {
      if (elapsed >= FLIP_SECONDS) return
      elapsed = Math.min(FLIP_SECONDS, elapsed + dt)
      group.rotation.y = from + (to - from) * easeOutBack(elapsed / FLIP_SECONDS)
    },
    /** 夜晚牌面略微自發光，仍讀得出圖案。 */
    setNight(amount) {
      for (const face of faces) face.emissiveIntensity = amount * .35
    },
    dispose() {
      Object.values(geometry).forEach(g => g.dispose())
      textures.forEach(t => t.dispose())
      materials.forEach(m => m.dispose())
    }
  }
}
