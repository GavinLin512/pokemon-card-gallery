import { InstancedMesh, SphereGeometry, MeshStandardMaterial, Object3D, Vector3 } from 'three'

// 每次頁面載入取得新種子；同次瀏覽重建場景時保留相同雲層。
const cloudSeed = globalThis.crypto.getRandomValues(new Uint32Array(1))[0]

/** 世界座標的雲層：與地景共用飛行鏡頭，不追隨 scrollY，也不循環平鋪。 */
export function createClouds({ lowPower = false } = {}) {
  const geometry = new SphereGeometry(1, lowPower ? 12 : 20, lowPower ? 8 : 12)
  // 輕微不規則的曲面配合平滑法線，避免每個隆起都是完美橢球。
  const positions = geometry.attributes.position
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
    const bulge = 1 + 0.065 * Math.sin(x * 5 + z * 3) * Math.cos(y * 4 - z * 2)
      + 0.035 * Math.cos(z * 7 + y * 3) * Math.sin(x * 3 - y * 2)
    positions.setXYZ(i, x * bulge, y * bulge, z * bulge)
  }
  geometry.computeVertexNormals()
  const material = new MeshStandardMaterial({ color: '#f4f8ff', roughness: 1, metalness: 0, emissive: '#bdcddd', emissiveIntensity: 0.45 })
  const weatherUniforms = { cover: {value:1}, thickness: {value:1}, time: {value:0}, wind: {value:0} }
  material.onBeforeCompile = shader => {
    shader.uniforms.cloudCover = weatherUniforms.cover
    shader.uniforms.cloudThickness = weatherUniforms.thickness
    shader.uniforms.cloudTime = weatherUniforms.time
    shader.uniforms.cloudWind = weatherUniforms.wind
    shader.vertexShader = 'uniform float cloudCover, cloudThickness, cloudTime, cloudWind;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      transformed *= vec3(cloudCover, cloudThickness, cloudCover);
      transformed.y *= 1. + sin(cloudTime*.2+instanceMatrix[3].x*.4)*cloudWind*.12;
    `)
  }
  // 每次載入隨機，同次瀏覽回捲與手機降級不會重新洗牌。
  function randomFor(seed) {
    let value = seed >>> 0
    return () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0
      return value / 4294967296
    }
  }
  const instances = []
  const origins = []
  const transform = new Object3D()
  const rows = 10
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < 3; column++) {
      if (lowPower && column === (row % 2 === 0 ? 0 : 2)) continue
      const random = randomFor(cloudSeed + row * 137 + column * 719)
      const x = (column - 1) * 34 + (random() - 0.5) * 22
      const y = 24 + random() * 10
      const z = -24 - row * 28 - random() * 14
      origins.push(new Vector3(x, y, z))
      // 細長雲、厚積雲、斷續雲團、偏側隆起；每種再獨立變化比例與隆起數。
      const family = Math.floor(random() * 4)
      const width = 7 + random() * 8
      const thickness = family === 0 ? 0.65 + random() * 0.6 : 1.1 + random() * 1.2
      const depth = 1.8 + random() * 2.4
      const peak = (random() - 0.5) * 0.85
      const angle = (random() - 0.5) * 0.8
      const count = 7 + Math.floor(random() * 6)
      function add(dx, dy, dz, sx, sy, sz) {
        transform.position.set(x + dx * Math.cos(angle) - dz * Math.sin(angle), y + dy, z + dx * Math.sin(angle) + dz * Math.cos(angle))
        transform.scale.set(sx, sy, sz)
        transform.rotation.set((random() - 0.5) * 0.25, random() * Math.PI, (random() - 0.5) * 0.22)
        transform.updateMatrix()
        instances.push(transform.matrix.clone())
      }
      // 交疊底部把隆起連成整體；薄雲的尾端逐漸收細。
      add(-width * 0.12, -thickness * 0.2, 0, width * 0.42, thickness * 0.36, depth * 0.8)
      add(width * 0.22, -thickness * 0.12, depth * 0.08, width * 0.32, thickness * 0.42, depth * 0.67)
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1) * 2 - 1
        const taper = Math.pow(Math.max(0, 1 - t * t), 0.55)
        const mound = Math.exp(-Math.pow((t - peak) * 2, 2))
        const radius = (0.55 + random() * 0.7) * (0.45 + taper * 0.8)
        const puffHeight = thickness * radius * 0.7 * (family === 3 ? 0.55 + mound : 0.75 + random() * 0.4)
        const gap = family === 2 && i % 4 === 0 ? depth * 0.6 : 0
        add(t * width * 0.48 + (random() - 0.5) * 0.5,
          puffHeight * 0.2 + mound * thickness * 0.2,
          (random() - 0.5) * depth * 0.7 + gap,
          width / count * (1.7 + random() * 0.7), puffHeight,
          depth * radius * (0.6 + random() * 0.25))
      }
    }
  }
  const mesh = new InstancedMesh(geometry, material, instances.length)
  mesh.name = 'world-clouds'
  instances.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
  mesh.boundingSphere.radius += 25
  let elapsed = 0
  return {
    mesh,
    strikeOrigin(camera) {
      camera.updateMatrixWorld(true)
      mesh.updateMatrixWorld(true)
      const visible = origins.map(origin => mesh.localToWorld(origin.clone())).filter(origin => {
        const projected = origin.clone().project(camera)
        const depth = camera.position.z - origin.z
        return depth > 18 && depth < 100 && Math.abs(projected.x) < .85 && projected.y > -.1 && projected.y < 1.15
      })
      if (!visible.length) return null
      const origin = visible[Math.floor(Math.random() * visible.length)].clone()
      origin.y -= .25
      return origin
    },
    setLook(look, env) {
      material.emissive.copy(look.light)
      if (env) {
        material.color.copy(env.cloud)
        weatherUniforms.cover.value = env.cover
        weatherUniforms.thickness.value = env.thickness
        weatherUniforms.wind.value = env.wind
        material.emissiveIntensity = .45 * env.light
      }
    },
    update(dt, reduced) {
      if (reduced) return
      elapsed += Math.max(0, Math.min(dt, 0.1))
      weatherUniforms.time.value = elapsed
      // 有界且連續的微風；無換邊重生，不會在鏡頭中突然跳走。
      mesh.position.x = Math.sin(elapsed * 0.008) * 7
    },
    dispose() {
      mesh.dispose()
      geometry.dispose()
      material.dispose()
    }
  }
}
