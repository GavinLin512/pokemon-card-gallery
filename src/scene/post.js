import { WebGLRenderTarget, Scene, OrthographicCamera, PlaneGeometry, ShaderMaterial, Mesh, LinearFilter, Vector2 } from 'three'

/**
 * 背景 canvas 的全畫面後製；DOM 卡牌與文字不經過此通道。
 * 現行畫風只在熱浪時啟用折射。HD-2D 原型固定啟用，同一個 pass 內完成熱浪、移軸景深、調色與暗角。
 */
export function createPostPass({ hd2d = false, lowPower = false } = {}) {
  // HD-2D 每幀都經過此目標，需自帶多重取樣抗鋸齒；低效能裝置省略。
  const target = new WebGLRenderTarget(1, 1, { minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: true, samples: hd2d && !lowPower ? 4 : 0 })
  const scene = new Scene(), camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1), geometry = new PlaneGeometry(2, 2)
  const material = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    defines: hd2d ? { HD2D: '', TAPS: lowPower ? 10 : 24 } : {},
    uniforms: {
      map: { value: target.texture },
      texel: { value: new Vector2(1, 1) },
      time: { value: 0 },
      strength: { value: 0 },
      // 焦平面在卡牌所在的畫面中段；band 內清晰，往上下 .32 內漸變到最大模糊（像素）。
      focus: { value: 0.46 },
      band: { value: 0.1 },
      blur: { value: lowPower ? 7 : 14 }
    },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `
      uniform sampler2D map; uniform vec2 texel; uniform float time, strength, focus, band, blur;
      varying vec2 vUv;
      vec3 tap(vec2 uv) { return texture2D(map, clamp(uv, .001, .999)).rgb; }
      void main() {
        vec2 uv = vUv;
        float ground = (1. - smoothstep(.4, .68, uv.y)) * smoothstep(0., .15, uv.y);
        uv.x += sin(uv.y * 95. + time * 2.4 + sin(uv.x * 23. + time)) * .0026 * strength * ground;
        uv.y += sin(uv.x * 45. + time * 1.7) * .001 * strength * ground;
        vec3 color = tap(uv);
        #ifdef HD2D
          // 移軸景深：只依畫面高度模糊，不需深度圖；黃金角圓盤取樣。
          // 亮處加權，水面反光、窗燈等亮點化成圓形散景。焦平面以上（遠景與天空）模糊約減半。
          float amount = smoothstep(band, band + .32, abs(uv.y - focus)) * blur * (uv.y > focus ? .55 : 1.);
          if (amount > .05) {
            vec3 sum = color;
            float total = 1.;
            // 每個像素隨機旋轉取樣圓盤，避免小亮點印出固定花紋。
            float spin = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))) * 6.2832;
            for (int i = 0; i < TAPS; i++) {
              float r = sqrt((float(i) + .5) / float(TAPS));
              float a = float(i) * 2.39996 + spin;
              vec3 s = tap(uv + vec2(cos(a), sin(a)) * r * amount * texel);
              float glow = max(dot(s, vec3(.299, .587, .114)) - .5, 0.) * 4.;
              float w = 1. + glow * glow * 3.;
              sum += s * w;
              total += w;
            }
            color = sum / total;
          }
          // 調色在感知空間：參考 HD-2D 的暖金色調與較深的暗部，但保留真新鎮的明亮。
          vec3 c = pow(max(color, 0.), vec3(1. / 2.2));
          float l = dot(c, vec3(.299, .587, .114));
          c = mix(vec3(l), c, 1.1);
          c = mix(c, c * c * (3. - 2. * c), .32);
          c *= mix(vec3(.94, .93, .98), vec3(1.07, 1.01, .9), smoothstep(.15, .85, l));
          vec2 d = vUv - .5;
          c *= 1. - dot(d, d) * .8;
          color = pow(clamp(c, 0., 1.), vec3(2.2));
        #endif
        gl_FragColor = vec4(color, 1.);
        #include <colorspace_fragment>
      }
    `
  })
  scene.add(new Mesh(geometry, material))
  return {
    target,
    /** HD-2D 永遠經過後製；現行畫風只有熱浪時才經過。 */
    active(heatStrength) {
      return hd2d || heatStrength > .001
    },
    resize(w, h, ratio) {
      target.setSize(Math.round(w * ratio), Math.round(h * ratio))
      material.uniforms.texel.value.set(1 / target.width, 1 / target.height)
    },
    render(renderer, time, strength) {
      material.uniforms.time.value = time
      material.uniforms.strength.value = strength
      renderer.setRenderTarget(null)
      renderer.clear()
      renderer.render(scene, camera)
    },
    dispose() {
      target.dispose()
      geometry.dispose()
      material.dispose()
    }
  }
}
