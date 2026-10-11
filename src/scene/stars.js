// 星空（PLAN §9.3 夜晚）：正交背景層的點粒子。每顆星有自己的遠近，遠的小而暗、偏冷色、
// 幾乎不隨視差移動、閃爍較明顯；近的大而亮、帶柔光暈、跟著視差走。
// 屬性只在建立時抽一次，改變視窗只重算像素座標，星星不會重新洗牌。
import { BufferGeometry, Float32BufferAttribute, ShaderMaterial, Points, Vector2 } from 'three'
import { STARS } from '../config/town.js'

const STAR_SHADER = {
  vertexShader: `
    attribute float depth;
    attribute float size;
    attribute float glow;
    attribute float warmth;
    attribute float phase;
    uniform vec2 shift;
    uniform float time;
    uniform float pixelRatio;
    varying float vAlpha;
    varying float vCore;
    varying float vFlare;
    varying vec3 vTint;
    void main() {
      vec3 p = position;
      // 小星核心佔比高、是清晰亮點；大星核心佔比低、光暈長。最近最亮的幾顆再加四芒星光。
      vCore = mix(0.55, 0.2, depth);
      vFlare = smoothstep(0.6, 1.0, depth) * 0.7;
      // 近星跟滿視差，遠星只跟一成
      p.xy += shift * (0.1 + 0.9 * depth);
      // 大氣閃爍：遠星幅度大、近星幾乎不閃；兩個不同頻率疊加避免像節拍器
      float speed = 0.9 + 1.6 * fract(phase * 7.31);
      float wave = 0.7 * sin(time * speed + phase * 6.2832) + 0.3 * sin(time * speed * 2.7 + phase * 12.0);
      float amplitude = mix(0.4, 0.1, depth);
      vAlpha = glow * (1.0 - amplitude * (0.5 + 0.5 * wave));
      vTint = mix(vec3(0.78, 0.86, 1.0), vec3(1.0, 0.92, 0.78), warmth);
      gl_PointSize = size * pixelRatio;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `
    uniform float opacity;
    varying float vAlpha;
    varying float vCore;
    varying float vFlare;
    varying vec3 vTint;
    void main() {
      vec2 d = gl_PointCoord - vec2(0.5);
      float r = length(d) * 2.0;
      if (r > 1.0) discard;
      // 核心實心、外圈柔尾；核心佔比由頂點依遠近決定。
      // smoothstep 邊界必須遞增（反向屬未定義行為，Metal 後端會得到 0），所以用 1 減。
      float a = 1.0 - smoothstep(vCore, 1.0, r);
      a *= 0.6 + 0.4 * a;
      // 四芒星光：沿十字方向從核心往外淡出，只有大星有
      float cross = max(0.0, 1.0 - min(abs(d.x), abs(d.y)) * 12.0) * (1.0 - r);
      a = max(a, cross * vFlare);
      gl_FragColor = vec4(mix(vTint, vec3(1.0), a), a * vAlpha * opacity);
      #include <colorspace_fragment>
    }
  `
}

const smoothstep = (lo, hi, v) => { const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo))); return t * t * (3 - 2 * t) }

/**
 * 抽出每顆星的常態屬性（純函式，random 可注入）。
 * u 為水平位置（-0.5..0.5，乘視窗寬），alt 為地平線以上的高度比例（0..1），depth 0 最遠、1 最近。
 */
export function starField(count, random = Math.random) {
  const field = {}
  for (const key of ['u', 'alt', 'depth', 'size', 'glow', 'warmth', 'phase']) field[key] = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    // 冪次讓大多數星星落在遠處，只有少數近而亮
    const depth = Math.pow(random(), 2.2)
    field.u[i] = random() - .5
    // 稍偏向天頂，地平線附近較疏
    field.alt[i] = Math.pow(random(), .75)
    field.depth[i] = depth
    // 平方曲線讓尺寸分成明顯的層次：多數是小亮點、幾十顆中等、少數幾顆大星。
    // 最小尺寸要讓 Retina 螢幕上至少有一個完整的亮心像素，否則柔邊衰減會把小星吃掉
    field.size[i] = STARS.size[0] + (STARS.size[1] - STARS.size[0]) * depth * depth
    // 地平線附近受大氣消光，暗兩到四成
    const extinction = .6 + .4 * smoothstep(0, .35, field.alt[i])
    field.glow[i] = Math.min(1, (.5 + .5 * Math.pow(depth, .8) + (random() - .5) * .16) * extinction)
    field.warmth[i] = random()
    field.phase[i] = random()
  }
  return field
}

export function createStars({ lowPower = false } = {}) {
  const count = lowPower ? STARS.lowPowerCount : STARS.count
  const field = starField(count)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 3), 3))
  for (const key of ['depth', 'size', 'glow', 'warmth', 'phase']) geometry.setAttribute(key, new Float32BufferAttribute(field[key], 1))
  const material = new ShaderMaterial({
    ...STAR_SHADER,
    uniforms: { opacity: { value: 0 }, shift: { value: new Vector2() }, time: { value: 0 }, pixelRatio: { value: 1 } },
    transparent: true,
    depthTest: false,
    depthWrite: false
  })
  const points = new Points(geometry, material)
  points.renderOrder = 1
  // 視差位移在著色器內，不更新 bounding sphere；點數少，直接不裁切
  points.frustumCulled = false
  return {
    points,
    /** horizon 為天空著色器的地平線（相對視窗高度、從底部起算）。 */
    layout(width, height, horizon, pixelRatio) {
      const position = geometry.attributes.position
      for (let i = 0; i < count; i++) {
        // 寬度多留兩成給視差；高度留 3% 邊界，星星不貼地平線也不貼視窗頂
        position.setXYZ(i, field.u[i] * width * 1.2, -height / 2 + (horizon + (.03 + .94 * field.alt[i]) * (1 - horizon)) * height, 0)
      }
      position.needsUpdate = true
      material.uniforms.pixelRatio.value = pixelRatio
    },
    setOpacity(value) {
      material.uniforms.opacity.value = value
    },
    /** shift 為最近一層的視差位移（px），time 只在非 reduced-motion 時前進。 */
    update(shiftX, shiftY, time) {
      material.uniforms.shift.value.set(shiftX, shiftY)
      material.uniforms.time.value = time
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    }
  }
}
