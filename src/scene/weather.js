// 屬性天氣粒子（PLAN §9.4）：單一 THREE.Points + 自訂 shader，所有粒子運動都在頂點著色器內以時間與亂數計算，
// CPU 不逐粒更新。lightning 另加一個全螢幕 quad 閃白；glow 用同一個 quad 畫柔和光暈。

import {
  Points,
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  Mesh,
  PlaneGeometry,
  Color,
  AdditiveBlending,
  NormalBlending
} from 'three'
import { weatherEffects, WEATHER_FADE_OUT_MS } from '../config/weather.js'

const VERT = /* glsl */ `
  uniform float uTime; uniform float uW; uniform float uH; uniform float uHorizon;
  uniform int uMode; uniform float uSize; uniform float uPixelRatio;
  attribute vec3 aSeed;
  varying float vAlpha; varying float vShape; varying float vRot;
  const float TAU = 6.28318;
  void main() {
    float s0 = aSeed.x, s1 = aSeed.y, s2 = aSeed.z;
    float t = uTime;
    vec2 p = vec2(0.0);
    float alpha = 1.0, size = uSize, shape = 0.0, rot = 0.0;
    float groundTop = -uH * 0.5 + uHorizon * uH;
    if (uMode == 0) { // leaves 綠葉，緩慢左右擺盪下落
      float speed = 40.0 + s2 * 50.0; float life = fract(t * speed / (uH * 1.2) + s1);
      p = vec2((s0 - 0.5) * uW * 1.1 + sin(t * 1.5 + s1 * TAU) * 40.0, uH * 0.6 - life * uH * 1.2);
      shape = 3.0; rot = t * 2.0 + s2 * TAU; size *= 0.9 + s2 * 0.5;
    } else if (uMode == 1) { // embers 火星，向上帶輕微亂數
      float speed = 70.0 + s2 * 90.0; float life = fract(t * speed / (uH * 0.9) + s1);
      p = vec2((s0 - 0.5) * uW * 1.1 + sin(t * 3.0 + s1 * 20.0) * 18.0 * life, -uH * 0.5 + life * uH * 0.9);
      alpha = 1.0 - life; size *= 0.5 + s2 * 0.8;
    } else if (uMode == 2) { // rain 雨滴直落，落地處小漣漪
      float speed = 900.0 + s2 * 300.0; float top = uH * 0.6;
      float ground = groundTop - s2 * uHorizon * uH * 0.9;
      float life = fract(t * speed / (top - ground) + s1);
      p.x = (s0 - 0.5) * uW * 1.1;
      if (life > 0.9) { float r = (life - 0.9) / 0.1; p.y = ground; shape = 4.0; size *= 1.6 + r * 3.0; alpha = 1.0 - r; }
      else { p.y = top - life * (top - ground); shape = 1.0; size *= 1.3; alpha = 0.85; }
    } else if (uMode == 3) { // sparks 小電花，隨機閃爍
      p = vec2((s0 - 0.5) * uW, (s1 - 0.4) * uH);
      alpha = step(0.75, fract(t * (1.5 + s2 * 3.0) + s1)); size *= 0.8 + s2;
    } else if (uMode == 4) { // orbs 紫色光點，緩慢漂浮
      p = vec2((s0 - 0.5) * uW + sin(t * 0.5 + s1 * TAU) * 40.0, (s1 - 0.5) * uH + cos(t * 0.4 + s2 * TAU) * 30.0);
      alpha = 0.45 + 0.45 * sin(t + s2 * TAU); size *= 1.0 + s2 * 1.2;
    } else if (uMode == 5) { // dust 沙塵，貼近地面橫向飄
      float x = mod(s0 * uW * 1.2 + t * (60.0 + s2 * 80.0), uW * 1.2) - uW * 0.6;
      p = vec2(x, -uH * 0.5 + s1 * uHorizon * uH * 0.7 + sin(t * 2.0 + s2 * TAU) * 6.0);
      alpha = 0.4; size *= 0.8 + s2 * 0.8;
    } else if (uMode == 6) { // mist 紫黑霧氣，低透明度大顆粒
      float x = mod(s0 * uW * 1.3 + t * (10.0 + s2 * 15.0), uW * 1.3) - uW * 0.65;
      p = vec2(x, -uH * 0.5 + s1 * uH * 0.55);
      alpha = 0.16; size *= 0.7 + s2 * 0.8;
    } else if (uMode == 7) { // shards 銀色光屑，旋轉下落
      float speed = 90.0 + s2 * 90.0; float life = fract(t * speed / (uH * 1.2) + s1);
      p = vec2((s0 - 0.5) * uW * 1.1 + sin(t * 2.5 + s1 * TAU) * 14.0, uH * 0.6 - life * uH * 1.2);
      shape = 3.0; rot = t * 5.0 + s2 * TAU; alpha = 0.6 + 0.4 * sin(t * 6.0 + s1 * TAU); size *= 0.7 + s2 * 0.5;
    } else if (uMode == 8) { // stars 粉色星星，閃爍
      p = vec2((s0 - 0.5) * uW, (s1 - 0.5) * uH + sin(t * 0.6 + s2 * TAU) * 10.0);
      shape = 2.0; alpha = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(t * (2.0 + s2 * 2.0) + s1 * TAU), 2.0); size *= 0.8 + s2 * 1.0;
    } else if (uMode == 9) { // scales 金色鱗光，繞圈
      float r = 20.0 + s2 * 50.0; float a = t * (0.8 + s2) + s1 * TAU;
      p = vec2((s0 - 0.5) * uW + cos(a) * r, (s1 - 0.5) * uH + sin(a) * r * 0.6);
      alpha = 0.6 + 0.4 * sin(a * 2.0); size *= 0.7 + s2 * 0.8;
    } else { // feathers 白色羽毛，飄落
      float speed = 25.0 + s2 * 30.0; float life = fract(t * speed / (uH * 1.2) + s1);
      p = vec2((s0 - 0.5) * uW * 1.1 + sin(t * 1.2 + s1 * TAU) * 50.0, uH * 0.6 - life * uH * 1.2);
      shape = 3.0; rot = sin(t * 1.2 + s1 * TAU) * 0.8 + 0.4; alpha = 0.9; size *= 0.9 + s2 * 0.5;
    }
    vAlpha = alpha; vShape = shape; vRot = rot;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
    gl_PointSize = size * uPixelRatio;
  }
`

const FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity;
  varying float vAlpha; varying float vShape; varying float vRot;
  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float a;
    if (vShape < 0.5) { a = smoothstep(1.0, 0.55, length(uv)); }                       // 圓點
    else if (vShape < 1.5) { a = (1.0 - smoothstep(0.1, 0.25, abs(uv.x))) * (1.0 - smoothstep(0.6, 1.0, abs(uv.y))); } // 雨絲
    else if (vShape < 2.5) { float d = abs(uv.x) + abs(uv.y); a = smoothstep(0.9, 0.2, d) * smoothstep(1.0, 0.3, length(uv) * 1.2); } // 星
    else if (vShape < 3.5) { float c = cos(vRot), s = sin(vRot); vec2 r = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y); a = smoothstep(1.0, 0.7, length(r * vec2(1.0, 2.2))); } // 葉／屑
    else { float d = length(uv * vec2(1.0, 2.4)); a = smoothstep(0.22, 0.0, abs(d - 0.72)); } // 漣漪環
    float alpha = a * vAlpha * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`

const QUAD_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uFlash; uniform float uGlow;
  varying vec2 vUv;
  void main() {
    float d = distance(vUv, vec2(0.5, 0.5));
    float glow = uGlow * smoothstep(0.75, 0.05, d) * 0.5;
    float a = max(uFlash, glow);
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor, a);
  }
`
const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

/**
 * @param {import('three').Scene} scene
 * @param {{ count: number, pixelRatio: number, horizon: number }} opts
 */
export function createWeather(scene, opts) {
  const count = opts.count
  const seeds = new Float32Array(count * 3)
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count * 3; i++) seeds[i] = Math.random()
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new Float32BufferAttribute(seeds, 3))
  // 位置在 shader 內計算，給一個涵蓋全畫面的包圍球避免被視錐剔除
  geometry.computeBoundingSphere()
  geometry.boundingSphere.radius = 1e6

  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uW: { value: 1 },
      uH: { value: 1 },
      uHorizon: { value: opts.horizon },
      uMode: { value: 0 },
      uSize: { value: 10 },
      uPixelRatio: { value: opts.pixelRatio },
      uColor: { value: new Color('#ffffff') },
      uOpacity: { value: 0 }
    }
  })
  const points = new Points(geometry, material)
  points.renderOrder = 100
  points.frustumCulled = false
  points.visible = false
  scene.add(points)

  const quadMaterial = new ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: QUAD_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: { uColor: { value: new Color('#ffffff') }, uFlash: { value: 0 }, uGlow: { value: 0 } }
  })
  const quad = new Mesh(new PlaneGeometry(1, 1), quadMaterial)
  quad.renderOrder = 101
  quad.visible = false
  scene.add(quad)

  let current = null // 目前效果 key
  let opacity = 0
  let target = 0
  let glow = 0
  let glowTarget = 0
  let nextFlash = 0
  let flashUntil = 0

  function resize(w, h) {
    material.uniforms.uW.value = w
    material.uniforms.uH.value = h
    quad.scale.set(w, h, 1)
  }

  /** key 為 weatherEffects 的鍵；null 表示收合，開始淡出。 */
  function set(key) {
    if (key && key !== current && weatherEffects[key]) {
      const fx = weatherEffects[key]
      current = key
      material.uniforms.uMode.value = fx.mode
      material.uniforms.uSize.value = fx.size
      material.uniforms.uColor.value.set(fx.color)
      const blending = fx.additive ? AdditiveBlending : NormalBlending
      if (material.blending !== blending) {
        material.blending = blending
        material.needsUpdate = true
      }
      quadMaterial.uniforms.uColor.value.set(fx.lightning ? '#ffffff' : fx.color)
      nextFlash = 0
    }
    target = key ? 1 : 0
    glowTarget = key && weatherEffects[key]?.glow ? 1 : 0
  }

  function update(dt, now) {
    const fx = current ? weatherEffects[current] : null
    const rate = target > opacity ? dt / 0.6 : dt / (WEATHER_FADE_OUT_MS / 1000)
    opacity = opacity < target ? Math.min(target, opacity + rate) : Math.max(target, opacity - rate)
    glow = glow < glowTarget ? Math.min(glowTarget, glow + dt / 0.8) : Math.max(glowTarget, glow - dt / 1.5)

    const hasParticles = fx && fx.mode >= 0
    points.visible = hasParticles && opacity > 0.005
    material.uniforms.uOpacity.value = opacity
    material.uniforms.uTime.value = now / 1000

    let flash = 0
    if (fx?.lightning && target > 0) {
      if (!nextFlash) nextFlash = now + 1500 + Math.random() * 3000
      if (now >= nextFlash) {
        flashUntil = now + 80
        nextFlash = now + 3000 + Math.random() * 3000
      }
      if (now < flashUntil) flash = 0.7 * opacity
    }
    quadMaterial.uniforms.uFlash.value = flash
    quadMaterial.uniforms.uGlow.value = glow
    quad.visible = flash > 0 || glow > 0.005
  }

  return {
    set,
    update,
    resize,
    get active() {
      return opacity > 0.005 || glow > 0.005 || target > 0
    },
    get key() {
      return current
    },
    get opacity() {
      return opacity
    },
    dispose() {
      scene.remove(points)
      scene.remove(quad)
      geometry.dispose()
      material.dispose()
      quad.geometry.dispose()
      quadMaterial.dispose()
    }
  }
}
