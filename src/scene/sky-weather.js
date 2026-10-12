import { BufferGeometry, Float32BufferAttribute, ShaderMaterial, Mesh, Color, Vector2, AdditiveBlending, DoubleSide, PlaneGeometry } from 'three'

// 屬性天氣的天空（PLAN §9.4，2026-10-12）：龍的龍星群與超能力的極光，畫在 town.js 的正交背景層，與星星、月亮同層。
// 斜俯視時天空只是畫面上緣的一條，距離約 100–190 單位，世界座標的粒子與平面會被距離淡出；
// 背景層先畫、村莊後畫，雲團與遠景自然蓋在流星與極光前面。

const METEOR_SHADER = {
  vertexShader: `
    attribute vec2 corner;
    attribute vec4 seed;
    uniform float time, horizon;
    uniform vec2 resolution;
    varying vec2 vLocal;
    varying float vWidth, vTrail, vFade;
    float meteorRandom(float k, float s) { return fract(sin(k * 12.9898 + s * 78.233) * 43758.5453); }
    void main() {
      // 每顆流星各自循環；每一輪重新抽起點、方向與大小，偶爾出現一顆大的。
      float period = 2.6 + seed.y * 3.;
      float cycle = time / period + seed.x, age = fract(cycle) * period, k = floor(cycle);
      float duration = .7 + seed.z * .5, t = clamp(age / duration, 0., 1.);
      float big = step(.86, meteorRandom(k, seed.w));
      float skyH = (1. - horizon) * resolution.y;
      float side = meteorRandom(k + .5, seed.z) < .5 ? -1. : 1.;
      vec2 start = vec2((meteorRandom(k, seed.z) - .5) * resolution.x * 1.1, resolution.y * .5 - skyH * (.02 + meteorRandom(k + .3, seed.y) * .4));
      vec2 dir = normalize(vec2(side * (.7 + meteorRandom(k + .7, seed.x) * .8), -1.));
      vec2 head = start + dir * (skyH * 1.3 + 160.) * (1. - big * .25) * t;
      vTrail = (90. + seed.z * 140.) * (1. + big * .8) * min(1., t * 5.);
      vWidth = (3. + seed.w * 2.2) * (1. + big * 1.3);
      vFade = step(age, duration) * sqrt(sin(t * 3.14159));
      // 四邊形從流星頭前方 3 倍寬延伸到尾巴末端；vLocal 為（頭後方距離, 側向距離），單位 px。
      float behind = mix(-3. * vWidth, vTrail, corner.x), offset = corner.y * 3. * vWidth;
      vLocal = vec2(behind, offset);
      vec2 p = head - dir * behind + vec2(-dir.y, dir.x) * offset;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0., 1.);
    }
  `,
  fragmentShader: `
    uniform float opacity;
    uniform vec3 headColor, trailColor, tailColor;
    varying vec2 vLocal;
    varying float vWidth, vTrail, vFade;
    void main() {
      // 金白色的頭帶柔光，尾巴由橘金漸變成紫並收細。
      float along = clamp(vLocal.x / max(vTrail, 1.), 0., 1.);
      float taper = vWidth * mix(1., .2, along);
      float trail = exp(-vLocal.y * vLocal.y / (taper * taper) * 1.5) * pow(1. - along, 1.4) * step(0., vLocal.x);
      float glow = exp(-dot(vLocal, vLocal) / (vWidth * vWidth) * .6);
      vec3 tint = mix(mix(trailColor, tailColor, along), headColor, clamp(glow * 1.4, 0., 1.));
      float a = (trail * .9 + glow) * vFade * opacity;
      if (a < .003) discard;
      gl_FragColor = vec4(tint, a);
      #include <colorspace_fragment>
    }
  `
}

// 超能力的極光：三道光簾，下緣是一條大幅起伏的曲線，粉白清楚，往上轉洋紅再淡成紫；簾幕有皺褶與細直條紋，緩慢流動。
// HD-2D 的天空只有畫面上緣約 15%，且在移軸模糊帶內：光簾要高、條紋要細而分明才看得出來；
// 用一般混色而非疊加，粉紅天色上不會疊成一片白。
const AURORA_SHADER = {
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
  `,
  fragmentShader: `
    uniform float time, horizon, opacity, aspect;
    varying vec2 vUv;
    void main() {
      // h：地平線為 0、畫面頂端為 1。
      float h = (vUv.y - horizon) / (1. - horizon);
      if (h < -.05) discard;
      float x = vUv.x * aspect;
      vec3 sum = vec3(0.);
      float weight = 0.;
      for (int i = 0; i < 3; i++) {
        float f = float(i);
        float base = .12 + f * .16 + .14 * sin(x * .9 + time * .12 + f * 2.1) + .05 * sin(x * 2.6 - time * .2 + f * 4.);
        float d = h - base;
        float curtain = smoothstep(-.02, .01, d) * exp(-max(d, 0.) * (2.2 + f));
        float fold = sin(x * 7. + sin(x * 1.9 + time * .3 + f) * 2.5);
        float rays = .3 + .7 * pow(.5 + .5 * sin(x * 32. + fold * 2. + f * 7.), 3.);
        vec3 tint = mix(vec3(1., .88, .98), vec3(1., .36, .8), smoothstep(0., .06, d));
        tint = mix(tint, vec3(.58, .42, 1.), smoothstep(.06, .35, d));
        float w = curtain * rays * (1. - f * .25);
        sum += tint * w;
        weight += w;
      }
      float a = clamp(weight, 0., 1.) * opacity * .85 * smoothstep(-.05, .06, h);
      if (a < .003) discard;
      gl_FragColor = vec4(sum / max(weight, 1e-3), a);
      #include <colorspace_fragment>
    }
  `
}

export function createSkyWeather({ lowPower = false } = {}) {
  const count = lowPower ? 8 : 14
  const corners = [], seeds = [], index = []
  for (let i = 0; i < count; i++) {
    const seed = [Math.random(), Math.random(), Math.random(), Math.random()]
    for (const [along, side] of [[0, -1], [0, 1], [1, -1], [1, 1]]) { corners.push(along, side); seeds.push(...seed) }
    index.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3)
  }
  const geometry = new BufferGeometry()
  // position 只供 three 計算頂點數；實際位置在著色器內算。
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(count * 12), 3))
  geometry.setAttribute('corner', new Float32BufferAttribute(corners, 2))
  geometry.setAttribute('seed', new Float32BufferAttribute(seeds, 4))
  geometry.setIndex(index)
  const meteorMaterial = new ShaderMaterial({
    ...METEOR_SHADER,
    uniforms: {
      time: { value: 0 }, horizon: { value: .8 }, resolution: { value: new Vector2(1, 1) }, opacity: { value: 0 },
      headColor: { value: new Color('#fff4d6') }, trailColor: { value: new Color('#ffb347') }, tailColor: { value: new Color('#9b6cff') }
    },
    transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending, side: DoubleSide
  })
  const meteors = new Mesh(geometry, meteorMaterial)
  meteors.name = 'draco-meteors'
  meteors.frustumCulled = false
  meteors.renderOrder = 2
  meteors.visible = false

  const auroraGeometry = new PlaneGeometry(1, 1)
  const auroraMaterial = new ShaderMaterial({
    ...AURORA_SHADER,
    uniforms: { time: { value: 0 }, horizon: { value: .8 }, opacity: { value: 0 }, aspect: { value: 1 } },
    transparent: true, depthTest: false, depthWrite: false
  })
  const aurora = new Mesh(auroraGeometry, auroraMaterial)
  aurora.name = 'psychic-aurora'
  aurora.frustumCulled = false
  // 天空（0）之後、星星（1）與流星（2）之前。
  aurora.renderOrder = .5
  aurora.visible = false

  return {
    meshes: [aurora, meteors],
    /** horizon 為天空著色器的地平線（相對視窗高度、從底部起算）。 */
    layout(width, height, horizon) {
      meteorMaterial.uniforms.resolution.value.set(width, height)
      meteorMaterial.uniforms.horizon.value = horizon
      aurora.scale.set(width, height, 1)
      auroraMaterial.uniforms.horizon.value = horizon
      auroraMaterial.uniforms.aspect.value = width / height
    },
    /**
     * rays 為龍屬性權重（減少動態時傳 0）；orbs 為超能力權重。
     * 極光屬於天色，減少動態時仍顯示，呼叫端不推進時間，光簾停住不動。
     */
    update(time, rays, orbs) {
      meteorMaterial.uniforms.time.value = time
      meteorMaterial.uniforms.opacity.value = rays
      meteors.visible = rays > .001
      auroraMaterial.uniforms.time.value = time
      auroraMaterial.uniforms.opacity.value = orbs
      aurora.visible = orbs > .001
    },
    dispose() {
      geometry.dispose()
      meteorMaterial.dispose()
      auroraGeometry.dispose()
      auroraMaterial.dispose()
    }
  }
}
