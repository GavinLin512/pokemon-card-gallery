import { InstancedMesh, PlaneGeometry, MeshLambertMaterial, MeshDepthMaterial, RGBADepthPacking, DoubleSide, InstancedBufferAttribute, Matrix4, Vector3, CanvasTexture, NearestFilter, SRGBColorSpace } from 'three'
import { breezeField } from './weather-shaders.js'

/**
 * 永遠面向鏡頭、保持直立的像素看板（HD-2D 的樹、草叢與村民）。
 * 同一張圖集的所有實例共用一次繪製；每個實例指定圖集欄、列與是否左右翻轉。
 * sway 傳入 { time, wind } uniform 時，看板上端隨風擺動：每個實例依位置取得固定的亂數相位與頻率，
 * 高的看板（樹）擺得慢而幅度大，矮的（草）擺得快；底邊固定不動。
 * nearFade 傳入 [起點, 終點]（視線深度）時，太靠近鏡頭的看板以網點逐漸挖空，不會突然巨大地擋住畫面。
 *
 * 看板受場景燈光與陰影影響：法線一律視為朝上，亮度與地面頂面相同，日夜光色、天氣染光與建築的影子都落在看板上。
 * 陰影以看板中軸取樣，同一列像素一起明暗，像紙片立在立體地景裡，也不會被自己投下的影子切成兩半。
 * castShadow 時另以面向光源的平面寫入陰影貼圖，投下完整的樹形剪影，樹腳與影子相接。
 * sun 是指向光源的單位向量：陰影取樣點沿它往光源移 0.25，看板永遠在自己的遮擋面之前，不會自我遮擋；
 * 遮擋面本身不沿光線移動，影子才會從樹腳開始。
 * rootShift（相對看板寬度，需搭配 sun）把遮擋面水平朝光源挪這麼多：影子從樹根朝光源那一側的邊緣開始延伸，
 * 樹根整個踩在自己的影子裡，而不是從樹幹中線才開始。
 */
export function createBillboards({ canvas, columns, rows = 1, count, width, height, sway = null, nearFade = null, castShadow = false, sun = null, rootShift = 0 }) {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  const geometry = new PlaneGeometry(1, 1)
  geometry.translate(0, 0.5, 0) // 原點在底邊中央，直接站在地面上
  const sprite = new InstancedBufferAttribute(new Float32Array(count * 3), 3)
  geometry.setAttribute('instanceSprite', sprite)
  const uniforms = { bbTime: sway?.time ?? { value: 0 }, bbWind: sway?.wind ?? { value: 0 }, bbSun: { value: sun ?? new Vector3() } }

  /** 看板的頂點變形，顏色與陰影深度兩個材質共用。陰影階段（depthPass）的 viewMatrix 是光源的視角，平面因此自然面向光源。 */
  function patchVertex(shader, depthPass) {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = 'attribute vec3 instanceSprite;\nuniform float bbTime, bbWind;\nuniform vec3 bbSun;\nvarying float bbDepth;\n' + breezeField + shader.vertexShader
      .replace('#include <uv_vertex>', `
        #include <uv_vertex>
        vMapUv = vec2(((instanceSprite.z > .5 ? 1. - uv.x : uv.x) + instanceSprite.x) / ${columns}.,
          (uv.y + ${rows - 1}. - instanceSprite.y) / ${rows}.);
      `)
      // 法線固定為世界的上方：看板與地面同樣受光，不因面向鏡頭而忽明忽暗。
      .replace('#include <defaultnormal_vertex>', 'vec3 transformedNormal = normalize((viewMatrix * vec4(0., 1., 0., 0.)).xyz);')
      .replace('#include <project_vertex>', `
        vec3 bbCenter = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
        vec2 bbSize = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
        vec3 bbRight = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
        float bbSeed = fract(sin(dot(bbCenter.xz, vec2(12.9898, 78.233))) * 43758.5453);
        float bbRate = (2.6 + bbSeed * 1.2) * inversesqrt(max(bbSize.y, 1.));
        float bbSway = breezeSway(bbCenter.xz, bbTime, bbSeed, bbRate) * bbWind * .22 * sqrt(bbSize.y) * pow(position.y, 1.5);
        vec3 bbWorld = bbCenter + bbRight * (position.x * bbSize.x + bbSway) + vec3(0., position.y * bbSize.y, 0.);
        ${rootShift ? `vec2 bbTowardSun = normalize(bbSun.xz);
        vec3 bbRoot = vec3(bbTowardSun.x, 0., bbTowardSun.y) * bbSize.x * ${rootShift.toFixed(3)};` : 'vec3 bbRoot = vec3(0.);'}
        ${depthPass ? '// 遮擋面水平朝光源挪樹根半寬，影子從樹根邊緣開始。\n        bbWorld += bbRoot;' : ''}
        vec4 mvPosition = viewMatrix * vec4(bbWorld, 1.);
        gl_Position = projectionMatrix * mvPosition;
        bbDepth = -mvPosition.z;
      `)
      // 陰影以看板中軸（含樹根位移）取樣，整列像素一起明暗；取樣點再往光源移一點，避開自己的遮擋面。
      .replace('#include <worldpos_vertex>', 'vec4 worldPosition = vec4(bbCenter + bbRoot + vec3(0., position.y * bbSize.y, 0.) + bbSun * .25, 1.);')
  }

  // emissiveMap 與貼圖相同：emissive 設為灰階 k 時，看板至少保留自身顏色的 k 倍，夜晚不會黑成剪影。
  const material = new MeshLambertMaterial({ map: texture, alphaTest: 0.5, emissiveMap: texture, shadowSide: DoubleSide })
  material.onBeforeCompile = shader => {
    patchVertex(shader, false)
    if (nearFade) {
      shader.fragmentShader = 'varying float bbDepth;\n' + shader.fragmentShader.replace('#include <clipping_planes_fragment>', `
        #include <clipping_planes_fragment>
        // 4×4 Bayer 規則網點，以 2×2 螢幕像素為一格，挖空時仍是像素畫的點陣感。
        vec2 bbCell = floor(gl_FragCoord.xy / 2.);
        vec2 bbHalf = floor(bbCell * .5);
        float bbDither = fract(bbCell.x * .5 + bbCell.y * bbCell.y * .75) + fract(bbHalf.x * .5 + bbHalf.y * bbHalf.y * .75) * .25 + .03;
        if (bbDither > smoothstep(${nearFade[0].toFixed(2)}, ${nearFade[1].toFixed(2)}, bbDepth)) discard;
      `)
    }
  }
  material.customProgramCacheKey = () => `billboard-v5-${columns}-${rows}-${nearFade}-${rootShift}`
  const mesh = new InstancedMesh(geometry, material, count)
  // 看板在 shader 內展開，包圍球不準；數量少，直接略過視錐剔除。
  mesh.frustumCulled = false
  mesh.receiveShadow = true
  let depthMaterial = null
  if (castShadow) {
    depthMaterial = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, map: texture, alphaTest: 0.5 })
    depthMaterial.onBeforeCompile = shader => patchVertex(shader, true)
    depthMaterial.customProgramCacheKey = () => `billboard-depth-v3-${columns}-${rows}-${rootShift}`
    mesh.customDepthMaterial = depthMaterial
    mesh.castShadow = true
  }
  const matrix = new Matrix4()
  return {
    mesh,
    set(index, x, y, z, column, row = 0, flip = false, scale = 1) {
      matrix.makeScale(width * scale, height * scale, 1).setPosition(x, y, z)
      mesh.setMatrixAt(index, matrix)
      sprite.setXYZ(index, column, row, flip ? 1 : 0)
    },
    commit() {
      mesh.instanceMatrix.needsUpdate = true
      sprite.needsUpdate = true
    },
    /** 最低亮度：看板至少保留自身顏色的 level 倍（0 為完全依燈光），夜晚人物與樹不會黑成剪影。 */
    setFloor(level) {
      material.emissive.setScalar(level)
    },
    dispose() {
      texture.dispose()
      geometry.dispose()
      material.dispose()
      depthMaterial?.dispose()
      mesh.dispose()
    }
  }
}
