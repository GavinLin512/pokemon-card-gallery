import { WebGLRenderTarget, Scene, OrthographicCamera, PlaneGeometry, ShaderMaterial, Mesh, LinearFilter, Vector2 } from 'three'

/**
 * 背景 canvas 的全畫面後製；DOM 卡牌與文字不經過此通道。
 * 現行畫風只在火（熱浪）、超能力（空間扭曲）與格鬥（畫面震動）天氣時啟用。
 * HD-2D 原型固定啟用，同一個 pass 內完成畫面震動、空間扭曲、熱浪、移軸景深、調色與暗角。
 * effects：{ heat, warp, quake, shakeX, shakeY }，由 town.js 每幀寫入同一個物件，不另外配置。
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
      warp: { value: 0 },
      shake: { value: new Vector2() },
      // 天空著色器的地平線（相對畫面高度、從底部起算），由 town.js 的版面計算寫入。
      horizon: { value: .84 },
      // 焦平面在卡牌所在的畫面中段；band 內清晰，往上下 .32 內漸變到最大模糊（像素）。
      focus: { value: 0.46 },
      band: { value: 0.1 },
      blur: { value: lowPower ? 7 : 14 }
    },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `
      uniform sampler2D map; uniform vec2 texel, shake; uniform float time, strength, focus, band, blur, warp, horizon;
      varying vec2 vUv;
      vec3 tap(vec2 uv) { return texture2D(map, clamp(uv, .001, .999)).rgb; }
      void main() {
        vec2 uv = vUv;
        // 格鬥的畫面震動：整張圖平移幾個像素並略為放大，邊緣不露出夾邊的拉伸。
        if (shake.x != 0. || shake.y != 0.) uv = (uv - .5) * (1. - max(abs(shake.x), abs(shake.y)) * 2.) + .5 + shake;
        // 超能力的空間扭曲：每 5 秒一圈波紋從畫面左右其中一側外面擴散進來掃過整個畫面，波前帶一點粉紫色。
        // 起點以不含 sin 的雜湊（同 weatherHash）依輪次挑選。
        float ripple = 0.;
        if (warp > .001) {
          float k = floor(time / 5.), age = time - k * 5.;
          vec3 h = fract(vec3(k, k + 1.7, k + 4.3) * .1031);
          h += dot(h, h.yzx + 33.33);
          vec2 rnd = fract((h.xx + h.yz) * h.zy);
          float aspect = texel.y / texel.x;
          vec2 d = (uv - vec2(rnd.x < .5 ? -.15 : 1.15, .2 + rnd.y * .6)) * vec2(aspect, 1.);
          float r = length(d), front = r - age * .6;
          ripple = exp(-front * front * 70.) * (1. - smoothstep(2.8, 4.6, age)) * smoothstep(0., .3, age) * warp;
          uv += d / max(r, .001) / vec2(aspect, 1.) * sin(front * 38.) * ripple * .011;
        }
        // 火的熱浪（2026-10-12 減弱）：只在地平線下方約三成畫面高的遠景地面帶微微晃動，近處的房子與圍欄不再像融化；
        // 範圍跟著地平線，HD-2D 與現行畫風都落在遠景。
        float ground = smoothstep(horizon - .34, horizon - .2, uv.y) * (1. - smoothstep(horizon - .04, horizon + .04, uv.y));
        uv.x += sin(uv.y * 95. + time * 2.4 + sin(uv.x * 23. + time)) * .0011 * strength * ground;
        uv.y += sin(uv.x * 45. + time * 1.7) * .0004 * strength * ground;
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
        if (ripple > 0.) color = mix(color, color * vec3(1.12, .96, 1.2) + vec3(.02, 0., .03), ripple * .6);
        gl_FragColor = vec4(color, 1.);
        #include <colorspace_fragment>
      }
    `
  })
  scene.add(new Mesh(geometry, material))
  return {
    target,
    /**
     * HD-2D 永遠經過後製；現行畫風只在熱浪、空間扭曲或格鬥天氣時經過。
     * 格鬥依天氣權重（quake）而非震動當下開關，現行畫風不會每一擊都切換一次抗鋸齒。
     */
    active(effects) {
      return hd2d || effects.heat > .001 || effects.warp > .001 || effects.quake > .001
    },
    /** 地平線（相對畫面高度、從底部起算）；熱浪只在它下方的遠景帶。 */
    setHorizon(value) {
      material.uniforms.horizon.value = value
    },
    resize(w, h, ratio) {
      target.setSize(Math.round(w * ratio), Math.round(h * ratio))
      material.uniforms.texel.value.set(1 / target.width, 1 / target.height)
    },
    render(renderer, time, effects) {
      material.uniforms.time.value = time
      material.uniforms.strength.value = effects.heat
      material.uniforms.warp.value = effects.warp
      material.uniforms.shake.value.set(effects.shakeX, effects.shakeY)
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
