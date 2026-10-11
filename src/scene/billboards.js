import { InstancedMesh, PlaneGeometry, MeshBasicMaterial, InstancedBufferAttribute, Matrix4, CanvasTexture, NearestFilter, SRGBColorSpace } from 'three'
import { breezeField } from './weather-shaders.js'

/**
 * 永遠面向鏡頭、保持直立的像素看板（HD-2D 的樹與村民）。
 * 同一張圖集的所有實例共用一次繪製；每個實例指定圖集欄、列與是否左右翻轉。
 * sway 傳入 { time, wind } uniform 時，看板上端隨風擺動：每個實例依位置取得固定的亂數相位與頻率，
 * 高的看板（樹）擺得慢而幅度大，矮的（草）擺得快；底邊固定不動。
 * nearFade 傳入 [起點, 終點]（視線深度）時，太靠近鏡頭的看板以網點逐漸挖空，不會突然巨大地擋住畫面。
 */
export function createBillboards({ canvas, columns, rows = 1, count, width, height, sway = null, nearFade = null }) {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  const geometry = new PlaneGeometry(1, 1)
  geometry.translate(0, 0.5, 0) // 原點在底邊中央，直接站在地面上
  const sprite = new InstancedBufferAttribute(new Float32Array(count * 3), 3)
  geometry.setAttribute('instanceSprite', sprite)
  const material = new MeshBasicMaterial({ map: texture, alphaTest: 0.5 })
  material.onBeforeCompile = shader => {
    shader.uniforms.bbTime = sway?.time ?? { value: 0 }
    shader.uniforms.bbWind = sway?.wind ?? { value: 0 }
    shader.vertexShader = 'attribute vec3 instanceSprite;\nuniform float bbTime, bbWind;\nvarying float bbDepth;\n' + breezeField + shader.vertexShader
      .replace('#include <uv_vertex>', `
        #include <uv_vertex>
        vMapUv = vec2(((instanceSprite.z > .5 ? 1. - uv.x : uv.x) + instanceSprite.x) / ${columns}.,
          (uv.y + ${rows - 1}. - instanceSprite.y) / ${rows}.);
      `)
      .replace('#include <project_vertex>', `
        vec3 bbCenter = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
        vec2 bbSize = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
        vec3 bbRight = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
        float bbSeed = fract(sin(dot(bbCenter.xz, vec2(12.9898, 78.233))) * 43758.5453);
        float bbRate = (2.6 + bbSeed * 1.2) * inversesqrt(max(bbSize.y, 1.));
        float bbSway = breezeSway(bbCenter.xz, bbTime, bbSeed, bbRate) * bbWind * .22 * sqrt(bbSize.y) * pow(position.y, 1.5);
        vec3 bbWorld = bbCenter + bbRight * (position.x * bbSize.x + bbSway) + vec3(0., position.y * bbSize.y, 0.);
        vec4 mvPosition = viewMatrix * vec4(bbWorld, 1.);
        gl_Position = projectionMatrix * mvPosition;
        bbDepth = -mvPosition.z;
      `)
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
  material.customProgramCacheKey = () => `billboard-v2-${columns}-${rows}-${nearFade}`
  const mesh = new InstancedMesh(geometry, material, count)
  // 看板在 shader 內展開，包圍球不準；數量少，直接略過視錐剔除。
  mesh.frustumCulled = false
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
    /** 以場景光色染色，讓看板跟著日夜與天氣變暗變暖。 */
    setTint(color) {
      material.color.copy(color)
    },
    dispose() {
      texture.dispose()
      geometry.dispose()
      material.dispose()
      mesh.dispose()
    }
  }
}
