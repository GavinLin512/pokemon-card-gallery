import { Vector4 } from 'three'
import { weatherFields } from './weather-shaders.js'

/**
 * dragon：龍影的世界位置 (x, z)、飛行方向與影子深淺；impact：格鬥衝擊 (x, z, 經過秒數, 強度)。兩者由 weather.js 每幀算出，
 * 衝擊也交給看板（樹與草叢）伏倒。
 */
export function createSurfaceWeather() {
  return {
    ...Object.fromEntries(['time','wind','leaves','embers','orbs','shards','petals','rain','feathers','mist','night','motion','ground','impactGround']
      .map(key => [key, { value: key === 'motion' ? 1 : 0 }])),
    dragon: { value: new Vector4() },
    impact: { value: new Vector4() }
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
      transformed.x+=sway*wx_wind*.26*leverage;
      transformed.z-=sway*wx_wind*.08*leverage;
      ` : vegetation ? `
      float sway=sin(wx_time*1.6-position.z*.48+position.x*.25);
      float swell=.65+.35*sin(wx_time*.8-position.z*.2);
      float leverage=min(2.6,max(0.,position.y));
      transformed.x+=sway*swell*wx_wind*.26*leverage;
      transformed.z+=sway*wx_wind*.1*leverage;
      ` : ''}
      ${vegetation ? `
      // 格鬥：衝擊波經過時草木朝外伏倒、壓低，再回彈。
      if(wx_impact.w>.001) {
        float bend=weatherImpactBend(position.xz,wx_impact);
        transformed.xz+=normalize(position.xz-wx_impact.xy+vec2(1e-4,0.))*bend*.45*leverage;
        transformed.y-=abs(bend)*min(.4,leverage*.35);
      }
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
      // 惡的暗影觸手與超能力的薄紫霧只貼著地面：wx_ground 為鏡頭所在處的地形高度，
      // 高出它 1.4–2.2 以上（屋頂、通風塔）就淡掉；斜度依地景同一個 up。
      float onGround=up*(1.-smoothstep(wx_ground+1.4,wx_ground+2.2,wxPosition.y));
      // 惡：地面爬著墨色觸手，與雲影、龍影同樣遮住天氣染光；減少動態時停用。
      vec2 tendril=vec2(0.);
      if(wx_mist>.001&&onGround>0.) {
        tendril=weatherTendrils(wxPosition.xz,wx_time)*wx_mist*onGround;
        shade=max(shade,tendril.x*.62);
      }
      diffuseColor.rgb*=1.-shade*wx_motion*(1.-wx_night*.6);
      // 超能力：朝上的地面鋪一片片緩慢飄移的薄紫霧；減少動態時停住不動。
      float psychicMist=0.;
      if(wx_orbs>.001&&onGround>0.) {
        psychicMist=weatherPsychicMist(wxPosition.xz,wx_time)*wx_orbs*onGround;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.66,.96),psychicMist*.38);
      }
      // 格鬥：衝擊點裂開放射狀裂痕，一圈衝擊波往外推；強度在減少動態時為 0。
      // 只畫在與衝擊點同高的地面（wx_impactGround），裂痕不會延伸到旁邊的平屋頂或台地上。
      float crack=0.,shock=0.;
      if(wx_impact.w>.001) {
        float reach=length(wxPosition.xz-wx_impact.xy);
        float level=up*(1.-smoothstep(.4,.8,abs(wxPosition.y-wx_impactGround)));
        if(reach<8.&&level>0.) {
          crack=weatherCracks(wxPosition.xz,wx_impact)*level*wx_impact.w;
          shock=exp(-abs(reach-wx_impact.z*7.)*2.2)*(1.-smoothstep(.15,.9,wx_impact.z))*(1.-smoothstep(4.,8.,reach))*level*wx_impact.w;
          diffuseColor.rgb*=1.-crack*.6;
        }
      }
    `)
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      float nightFade=1.-wx_night*.78;
      float lowGlow=exp(-max(0.,wxPosition.y)*.26);
      vec3 glow=vec3(.38,.045,.68)*wx_orbs*lowGlow*.22;
      glow+=vec3(.85,.26,.44)*wx_petals*lowGlow*.12;
      glow+=vec3(1.,.22,.025)*wx_embers*lowGlow*.12;
      glow+=vec3(.55,.72,.9)*wx_shards*up*grain*.025;
      // 鋼：銀色反光帶每 6 秒由左往右斜斜掃過地面、屋頂與牆面一次（前 2.4 秒），位置相對鏡頭，每一站都看得到。
      if(wx_shards>.001) {
        float sweepPhase=fract(wx_time/6.);
        float sweep=dot(wxPosition.xz-cameraPosition.xz,vec2(.91,.41))-mix(-70.,70.,sweepPhase/.4);
        float sheen=exp(-sweep*sweep*1.4)+.5*exp(-(sweep+1.7)*(sweep+1.7)*6.);
        glow+=vec3(.82,.9,1.)*wx_shards*wx_motion*sheen*step(sweepPhase,.4)*(.3+.5*up)*${vegetation ? '.4' : '1.'};
      }
      // 雲影與龍影也遮住天氣的染光，影子不會被天氣染光照亮回去。
      totalEmissiveRadiance+=glow*nightFade*(1.-shade*wx_motion);
      // 以下三種光不受夜色減弱：薄紫霧的微光、裂縫剛裂開時的熱光與衝擊波，以及夜晚暗影觸手外圍的紫光。
      if(psychicMist>0.) totalEmissiveRadiance+=vec3(.5,.34,.8)*psychicMist*(.05+wx_night*.12);
      if(crack+shock>0.) totalEmissiveRadiance+=vec3(1.,.4,.08)*crack*exp(-wx_impact.z*2.5)*.8+vec3(1.,.62,.3)*shock*.22;
      if(tendril.y>0.) totalEmissiveRadiance+=vec3(.42,.12,.7)*max(0.,tendril.y-tendril.x)*wx_night*wx_motion*.28;
    `)
  }
  material.customProgramCacheKey = () => `${baseKey}-landscape-weather-v4-${vegetation}-${water}-${breeze}`
}
