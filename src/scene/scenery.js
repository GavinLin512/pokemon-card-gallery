import { BufferGeometry, Float32BufferAttribute } from 'three'
import { PATTERN_WORLD, TONE_RANGE } from './pixel-art.js'

/** 封閉三角屋頂，x 為屋脊方向，底面 y=0、屋脊 y=1。 */
export function createGableGeometry() {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([
    -.5,0,-.5, -.5,0,.5, -.5,1,0,
    .5,0,-.5, .5,0,.5, .5,1,0
  ], 3))
  geometry.setIndex([0,1,2, 3,5,4, 0,2,5, 0,5,3, 1,4,5, 1,5,2, 0,3,4, 0,4,1])
  geometry.computeVertexNormals()
  // 與 BoxGeometry 一樣提供 normal / uv，讓同色幾何可合併。
  geometry.setAttribute('uv', new Float32BufferAttribute([0,0,1,0,.5,1,0,0,1,0,.5,1], 2))
  return geometry
}

const groundColors = new Set(['#72b98a', '#a4d6ae', '#639f75', '#e0cb8e', '#e3cf91', '#d2dfce', '#559968'])

/** 世界座標細紋不隨鏡頭游移；遠處自動淡出，不新增貼圖或 draw call。 */
export function addSurfaceDetail(material, color) {
  if (!groundColors.has(color)) return
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 terrainPosition;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      terrainPosition = position;
    `)
    shader.fragmentShader = 'varying vec3 terrainPosition;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 cell = floor(terrainPosition.xz * 7.0);
      float seed = fract(sin(dot(cell, vec2(127.1,311.7))) * 43758.5453);
      vec2 local = fract(terrainPosition.xz * 7.0);
      float fleck = step(.82, seed) * (1. - smoothstep(.12,.36,length(local-vec2(.5))));
      float distanceFade = 1. - smoothstep(20.,65.,vViewPosition.z);
      diffuseColor.rgb *= 1. + (fleck*.24 - step(seed,.09)*.07)*distanceFade;
    `)
  }
  material.customProgramCacheKey = () => 'terrain-flecks-v1'
}

/** 一株長草的彎葉，雙面三角片；比圓錐更接近原圖的放射葉形。 */
export function createBladeGeometry() {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([0,0,0, -.2,.4,-.12, 0,.85,-.36, .2,.4,-.12],3))
  geometry.setIndex([0,1,2,0,2,3])
  geometry.computeVertexNormals()
  geometry.setAttribute('uv', new Float32BufferAttribute([.5,0,0,.5,.5,1,1,.5],2))
  return geometry
}

/**
 * HD-2D 原型的像素貼圖：接在 addLandscapeWeather 之後，沿用其世界座標與法線。
 * 依表面朝向選投影平面，以世界座標取樣 pixel-art.js 的圖樣（每單位 16 格）：R 乘上明暗，G 混入點綴色。
 * 斜屋頂依坡向翻轉，魚鱗瓦的弧邊一律朝下坡；牆腳接地處壓暗，近似環境光遮蔽。
 * 不需要 UV，合併後的幾何也能對齊；遠處由 mipmap 平均，不增加繪製次數。
 */
export function addPixelTexture(material, { texture, accent }) {
  const beforeCompile = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey()
  material.onBeforeCompile = shader => {
    beforeCompile.call(material, shader)
    shader.uniforms.pxPattern = { value: texture }
    shader.uniforms.pxAccent = { value: accent }
    shader.fragmentShader = 'uniform sampler2D pxPattern;\nuniform vec3 pxAccent;\n' + shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 pxNormal = abs(wxNormal);
      bool pxTop = pxNormal.y > .6;
      float pxDownhill = wxNormal.z < -.02 ? -1. : 1.;
      vec2 pxPlane = pxTop ? vec2(wxPosition.x, -wxPosition.z * pxDownhill) : (pxNormal.x > pxNormal.z ? wxPosition.zy : wxPosition.xy);
      vec4 pxSample = texture2D(pxPattern, pxPlane / ${PATTERN_WORLD}.);
      diffuseColor.rgb = mix(diffuseColor.rgb, pxAccent, pxSample.g) * pxSample.r * ${TONE_RANGE};
      if (!pxTop) diffuseColor.rgb *= mix(.66, 1., smoothstep(.05, 1., wxPosition.y));
    `)
  }
  material.customProgramCacheKey = () => `${baseKey}-pixel-v3`
}
