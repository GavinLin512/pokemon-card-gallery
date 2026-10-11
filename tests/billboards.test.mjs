import test from 'node:test'
import assert from 'node:assert/strict'
import { ShaderLib, DoubleSide, RGBADepthPacking, Vector3 } from 'three'
import { createBillboards } from '../src/scene/billboards.js'

// 看板的光照整合靠替換 three 內建 shader 的 #include 片段；片段名稱若隨版本改變，replace 會默默失效。
// 這裡用 three 目前的 Lambert 與深度 shader 實際跑一次 onBeforeCompile，確認每個片段都被換掉。
const canvas = { width: 16, height: 16 }
const compile = (material, lib) => {
  const shader = { uniforms: {}, vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader }
  material.onBeforeCompile(shader)
  return shader
}

test('billboards are lit, receive shadows at their centre axis and keep a flat-up normal', () => {
  const billboards = createBillboards({ canvas, columns: 2, rows: 3, count: 4, width: 1, height: 2, nearFade: [8, 13] })
  const { mesh } = billboards
  assert.ok(mesh.material.isMeshLambertMaterial)
  assert.ok(mesh.receiveShadow)
  assert.ok(!mesh.castShadow && !mesh.customDepthMaterial)
  assert.equal(mesh.material.shadowSide, DoubleSide)
  assert.equal(mesh.material.emissiveMap, mesh.material.map)
  const shader = compile(mesh.material, ShaderLib.lambert)
  for (const chunk of ['project_vertex', 'worldpos_vertex', 'defaultnormal_vertex']) {
    assert.ok(!shader.vertexShader.includes(`#include <${chunk}>`), `${chunk} 未被替換`)
  }
  assert.match(shader.vertexShader, /transformedNormal = normalize\(\(viewMatrix \* vec4\(0\., 1\., 0\., 0\.\)\)/)
  // emissiveMap 用自己的 UV varying；沒同步會把整張圖集疊在一個看板上，夜晚出現雜色亮點。
  assert.match(shader.vertexShader, /#ifdef USE_EMISSIVEMAP\s+vEmissiveMapUv = vMapUv;/)
  assert.match(ShaderLib.lambert.fragmentShader + '', /emissivemap_fragment/)
  assert.match(shader.vertexShader, /worldPosition = vec4\(bbCenter \+ bbRoot \+ vec3\(0\., position\.y \* bbSize\.y, 0\.\) \+ bbSun \* \.25, 1\.\)/)
  assert.match(shader.vertexShader, /vec3 bbRoot = vec3\(0\.\);/, '沒有 rootShift 時不做樹根位移')
  assert.match(shader.fragmentShader, /bbDither > smoothstep\(8\.00, 13\.00, bbDepth\)/)
  assert.ok(shader.uniforms.bbTime && shader.uniforms.bbWind)
  assert.deepEqual(shader.uniforms.bbSun.value.toArray(), [0, 0, 0], '沒給 sun 時取樣點不偏移')
  billboards.setFloor(.2)
  assert.equal(mesh.material.emissive.r, .2)
  billboards.dispose()
})

test('shadow-casting billboards get a depth material whose plane stays put, and sample shadows toward the sun', () => {
  const sun = new Vector3(-26, 26, 5).normalize()
  const billboards = createBillboards({ canvas, columns: 5, count: 3, width: 3.1, height: 4.65, castShadow: true, sun, rootShift: 4 / 48 })
  const { mesh } = billboards
  assert.ok(mesh.castShadow)
  const depth = mesh.customDepthMaterial
  assert.ok(depth?.isMeshDepthMaterial)
  assert.equal(depth.depthPacking, RGBADepthPacking)
  assert.equal(depth.alphaTest, .5)
  const shader = compile(depth, ShaderLib.depth)
  assert.ok(!shader.vertexShader.includes('#include <project_vertex>'))
  // 遮擋面不沿光線位移（影子才會從樹腳開始），只水平朝光源挪樹根半寬；自我遮擋由取樣點往光源偏移避開。
  assert.ok(!shader.vertexShader.includes('viewMatrix[0][2]'))
  assert.match(shader.vertexShader, /bbRoot = vec3\(bbTowardSun\.x, 0\., bbTowardSun\.y\) \* bbSize\.x \* 0\.083;/)
  assert.match(shader.vertexShader, /bbWorld \+= bbRoot;/)
  assert.match(shader.vertexShader, /instanceSprite\.x\) \/ 5\./)
  const lit = compile(mesh.material, ShaderLib.lambert)
  assert.equal(lit.uniforms.bbSun.value, sun)
  assert.ok(!lit.vertexShader.includes('bbWorld += bbRoot'), '顏色材質的看板本身不位移')
  assert.match(lit.vertexShader, /worldPosition = vec4\(bbCenter \+ bbRoot \+ /)
  billboards.dispose()
})
