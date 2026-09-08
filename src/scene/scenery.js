import { BufferGeometry, Float32BufferAttribute } from 'three'

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
