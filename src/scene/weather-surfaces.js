import { weatherFields } from './weather-shaders.js'

export function createSurfaceWeather() {
  return Object.fromEntries(['time','wind','aura','leaves','embers','orbs','shards','petals','rays','rain','night','motion']
    .map(key => [key, { value: key === 'motion' ? 1 : 0 }]))
}

/** 擴充既有地面細紋；所有地景材質共用權重，無新增繪製或每幀重新編譯。 */
export function addLandscapeWeather(material, uniforms, { vegetation = false, water = false } = {}) {
  const beforeCompile = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey()
  material.onBeforeCompile = shader => {
    beforeCompile.call(material, shader)
    for (const [key, uniform] of Object.entries(uniforms)) shader.uniforms[`wx_${key}`] = uniform
    const declarations = Object.keys(uniforms).map(key => `uniform float wx_${key};`).join('\n')
    const varyings = 'varying vec3 wxPosition, wxNormal;\n'
    shader.vertexShader = declarations + varyings + weatherFields + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      ${vegetation ? `
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
    `)
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      float nightFade=1.-wx_night*.78;
      float lowGlow=exp(-max(0.,wxPosition.y)*.26);
      float beam=weatherBeam(wxPosition.xz,wx_time);
      float pulse=weatherPulse(wxPosition.xz,wx_time);
      vec3 glow=vec3(.38,.045,.68)*wx_orbs*lowGlow*.22;
      glow+=vec3(.85,.26,.44)*wx_petals*lowGlow*.12;
      glow+=vec3(1.,.48,.08)*wx_rays*beam*(.18+.3*up);
      glow+=vec3(1.,.22,.025)*wx_embers*lowGlow*.12;
      glow+=vec3(.55,.72,.9)*wx_shards*up*grain*.025;
      glow+=vec3(1.,.18,.02)*wx_aura*pulse*lowGlow*.24;
      totalEmissiveRadiance+=glow*nightFade;
    `)
  }
  material.customProgramCacheKey = () => `${baseKey}-landscape-weather-v2-${vegetation}-${water}`
}
