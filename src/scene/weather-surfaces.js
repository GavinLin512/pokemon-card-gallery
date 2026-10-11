import { Vector4 } from 'three'
import { weatherFields } from './weather-shaders.js'

/** dragon：龍影的世界位置 (x, z)、飛行方向與影子深淺，由 weather.js 每幀算出。 */
export function createSurfaceWeather() {
  return {
    ...Object.fromEntries(['time','wind','aura','leaves','embers','orbs','shards','petals','rain','feathers','night','motion']
      .map(key => [key, { value: key === 'motion' ? 1 : 0 }])),
    dragon: { value: new Vector4() }
  }
}

/**
 * 擴充既有地面細紋；所有地景材質共用權重，無新增繪製或每幀重新編譯。
 * breeze（HD-2D）：植物改用與看板相同的微風擺動，並以 swayBase 屬性（植物所在地面高度）計算離地高度，
 * 抬上台地的植物底部不會跟著滑動。
 */
export function addLandscapeWeather(material, uniforms, { vegetation = false, water = false, breeze = false } = {}) {
  const beforeCompile = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey()
  material.onBeforeCompile = shader => {
    beforeCompile.call(material, shader)
    for (const [key, uniform] of Object.entries(uniforms)) shader.uniforms[`wx_${key}`] = uniform
    const declarations = Object.entries(uniforms).map(([key, u]) => `uniform ${u.value.isVector4 ? 'vec4' : 'float'} wx_${key};`).join('\n')
    const varyings = 'varying vec3 wxPosition, wxNormal;\n'
    const base = vegetation && breeze ? 'attribute float swayBase;\n' : ''
    shader.vertexShader = declarations + varyings + base + weatherFields + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      ${vegetation && breeze ? `
      float leverage=min(2.6,max(0.,position.y-swayBase));
      float sway=breezeSway(position.xz,wx_time,sin(position.x*.37)*cos(position.z*.41)*.3,2.2);
      float pulse=weatherPulse(position.xz,wx_time)*wx_aura;
      transformed.x+=(sway*wx_wind*.26+pulse*.5)*leverage;
      transformed.z-=sway*wx_wind*.08*leverage;
      transformed.y-=pulse*min(.5,leverage*.45);
      ` : vegetation ? `
      float sway=sin(wx_time*1.6-position.z*.48+position.x*.25);
      float swell=.65+.35*sin(wx_time*.8-position.z*.2);
      float pulse=weatherPulse(position.xz,wx_time)*wx_aura;
      float leverage=min(2.6,max(0.,position.y));
      transformed.x+=(sway*swell*wx_wind*.26+pulse*.5)*leverage;
      transformed.z+=sway*wx_wind*.1*leverage;
      transformed.y-=pulse*min(.5,max(0.,position.y)*.45);
      ` : ''}
      ${water ? 'transformed.x+=sin(wx_time*1.4+position.z*2.)*.08*wx_motion;' : ''}
      wxPosition=(modelMatrix*vec4(transformed,1.)).xyz;
      wxNormal=normalize(mat3(modelMatrix)*normal);
    `)
    shader.fragmentShader = declarations + varyings + weatherFields + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float up=smoothstep(.25,.9,wxNormal.y);
      float grain=fract(sin(dot(floor(wxPosition.xz*18.),vec2(127.1,311.7)))*43758.5453);
      float detailFade=1.-smoothstep(.03,.16,length(fwidth(wxPosition.xz)));
      float frost=(.12+grain*.26*detailFade)*up*wx_shards*${vegetation || water ? '0.' : '1.'};
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.72,.82,.92),frost*.45);
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.91,1.16,.88),wx_leaves*.42);
      diffuseColor.rgb*=1.-wx_rain*.18;
      // 無色的雲影與龍飛過的影子；減少動態時兩者都停用，不會凍結在地上。
      // 近處可見地面約 30 單位見方，龍影縮成翼展約 15，整個形狀才看得出是龍。
      // 以 uniform 分支略過沒用到的天氣，所有片段走同一路徑，晴天不多算雜訊與龍形。
      float shade=0.;
      if(wx_feathers>.001) shade=weatherCloudShade(wxPosition.xz,wx_time)*wx_feathers*.35;
      if(wx_dragon.w>.001) {
        // 轉到龍的座標：+y 為飛行方向（angle 為 0 時往 -z），拍翅隨時間。
        vec2 offset=wxPosition.xz-wx_dragon.xy, ahead=vec2(sin(wx_dragon.z),-cos(wx_dragon.z));
        vec2 q=vec2(dot(offset,vec2(-ahead.y,ahead.x)),dot(offset,ahead))*1.5;
        shade=max(shade,dragonShape(q,wx_time*4.2)*wx_dragon.w*.7);
      }
      diffuseColor.rgb*=1.-shade*wx_motion*(1.-wx_night*.6);
    `)
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      float nightFade=1.-wx_night*.78;
      float lowGlow=exp(-max(0.,wxPosition.y)*.26);
      float pulse=weatherPulse(wxPosition.xz,wx_time);
      vec3 glow=vec3(.38,.045,.68)*wx_orbs*lowGlow*.22;
      glow+=vec3(.85,.26,.44)*wx_petals*lowGlow*.12;
      glow+=vec3(1.,.22,.025)*wx_embers*lowGlow*.12;
      glow+=vec3(.55,.72,.9)*wx_shards*up*grain*.025;
      glow+=vec3(1.,.18,.02)*wx_aura*pulse*lowGlow*.24;
      // 鋼：銀色反光帶每 6 秒由左往右斜斜掃過地面、屋頂與牆面一次（前 2.4 秒），位置相對鏡頭，每一站都看得到。
      if(wx_shards>.001) {
        float sweepPhase=fract(wx_time/6.);
        float sweep=dot(wxPosition.xz-cameraPosition.xz,vec2(.91,.41))-mix(-70.,70.,sweepPhase/.4);
        float sheen=exp(-sweep*sweep*1.4)+.5*exp(-(sweep+1.7)*(sweep+1.7)*6.);
        glow+=vec3(.82,.9,1.)*wx_shards*wx_motion*sheen*step(sweepPhase,.4)*(.3+.5*up)*${vegetation ? '.4' : '1.'};
      }
      // 雲影與龍影也遮住天氣的染光，影子不會被天氣染光照亮回去。
      totalEmissiveRadiance+=glow*nightFade*(1.-shade*wx_motion);
    `)
  }
  material.customProgramCacheKey = () => `${baseKey}-landscape-weather-v3-${vegetation}-${water}-${breeze}`
}
