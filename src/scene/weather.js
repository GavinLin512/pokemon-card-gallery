import { Group, BufferGeometry, Float32BufferAttribute, ShaderMaterial, Points, Color,
  AdditiveBlending, NormalBlending, Mesh, PlaneGeometry, DoubleSide, MeshBasicMaterial, PointLight } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createWeatherState, weatherLook } from './weather-state.js'
import { particleVertex, particleFragment, effectFragmentEnd } from './weather-shaders.js'

/** 世界座標天氣；與地景共用深度，所有資源集中建立、淡入淡出及釋放。 */
export function createWeather(scene, { lowPower = false, trees = [], surfaces = [], flowers = [], clouds } = {}) {
  const group = new Group(); group.name = 'type-weather'; scene.add(group)
  const state = createWeatherState(), effects = [], resources = []
  let time = 0, nextLightning = .4 + Math.random()*.6, flash = 0
  const heightAt = (x,z) => surfaces.reduce((height,b) =>
    x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z ? Math.max(height,b.max.y) : height, .05)

  function outdoorPoint() {
    for (let i=0; i<30; i++) {
      const x=(Math.random()-.5)*42, z=22-Math.random()*207
      if (heightAt(x,z)<1) return {x,z}
    }
    // 中央道路無建築，保留一個確定在戶外的後備點。
    return {x:0,z:-30-Math.random()*70}
  }
  function register(key, weightKey, mesh, material, color, strength=1, staticEffect=false) {
    mesh.name=key; mesh.visible=false; group.add(mesh)
    effects.push({key,weightKey,mesh,material,color:new Color(color),strength,staticEffect})
    resources.push(mesh.geometry,material)
  }
  function particles(key, weightKey, mode, count, color, size, {additive=false,strength=1,staticEffect=false}={}) {
    count=Math.round(count*(lowPower?.42:1))
    const positions=[], seeds=[]
    for (let i=0; i<count; i++) {
      let x=(Math.random()-.5)*48, z=24-Math.random()*213, y=.35
      if ((mode===0||key==='leaf-glow')&&trees.length) {
        const tree=trees[i%trees.length]; x=tree.x*.78+(Math.random()-.5)*4;z=tree.z+(Math.random()-.5)*4;y=.6
      }
      if (key==='flower-glow'&&flowers.length) {
        const flower=flowers[i%flowers.length];x=flower.x+(Math.random()-.5)*3;z=flower.z+(Math.random()-.5)*3;y=.6
      }
      if ([1,3,4,9,11,12].includes(mode)) { ({x,z}=outdoorPoint()) }
      if (mode===3) y=1+Math.random()*3
      if (mode===4) y=.5+Math.random()*1.8
      if (mode===11) y=.8+Math.random()*2.8
      if (mode===13) y=1+Math.random()*5
      const height=heightAt(x,z)
      if (mode!==2&&mode!==10&&height>1) y+=height
      positions.push(x,y,z); seeds.push(Math.random(),Math.random(),Math.random(),height)
    }
    const geometry=new BufferGeometry()
    geometry.setAttribute('position',new Float32BufferAttribute(positions,3))
    geometry.setAttribute('seed',new Float32BufferAttribute(seeds,4))
    const material=new ShaderMaterial({vertexShader:particleVertex,fragmentShader:particleFragment,
      transparent:true,depthWrite:false,depthTest:true,blending:additive?AdditiveBlending:NormalBlending,
      uniforms:{time:{value:0},mode:{value:mode},viewport:{value:800},size:{value:size},color:{value:new Color(color)},opacity:{value:0}}})
    const mesh=new Points(geometry,material);mesh.frustumCulled=false
    register(key,weightKey,mesh,material,color,strength,staticEffect)
  }
  particles('leaves','leaves',0,2500,'#a4d84d',.75)
  particles('leaf-glow','leaves',5,650,'#d0ff8a',.22,{additive:true,strength:.8})
  particles('embers','embers',1,1000,'#ff9a35',.27,{additive:true})
  particles('rain','rain',2,14500,'#c1daed',.95,{strength:.8})
  particles('rain-splash','rain',10,2800,'#d4eeff',.34,{strength:.75})
  particles('rain-mist','rain',4,200,'#859db1',10,{strength:.22,staticEffect:true})
  particles('aura-flow','aura',9,500,'#eeb07b',4,{additive:true,strength:.38})
  particles('aura-dust','aura',12,1600,'#ad805c',.34)
  particles('orbs','orbs',3,420,'#c48dff',1.2,{additive:true})
  particles('psychic-fog','orbs',4,260,'#9b6cca',11,{strength:.36,staticEffect:true})
  particles('mist','mist',4,330,'#283145',13,{strength:.55,staticEffect:true})
  particles('dark-shadows','mist',11,500,'#101626',.65,{strength:.8})
  particles('shards','shards',8,1000,'#e7efff',.65,{additive:true})
  particles('petals','petals',6,1800,'#ffc1d5',.7)
  particles('flower-glow','petals',5,700,'#ffd0e4',.3,{additive:true})
  particles('dragon-scales','rays',13,750,'#ffd065',.5)
  particles('feathers','feathers',7,1100,'#ffffff',.85)

  const planeVertex=`attribute float phase;varying vec2 vUv;varying float vPhase,vDistance;
    void main(){vUv=uv;vPhase=phase;vec4 view=modelViewMatrix*vec4(position,1.);vDistance=-view.z;gl_Position=projectionMatrix*view;}`
  function planes(key,weightKey,placements,fragment,color,{additive=true,strength=1,staticEffect=false}={}) {
    const parts=placements.map(([x,y,z,w,h,vertical,angle=0],i) => {
      const g=new PlaneGeometry(w,h)
      if (!vertical) g.rotateX(-Math.PI/2)
      g.rotateY(angle);g.translate(x,y,z)
      g.setAttribute('phase',new Float32BufferAttribute(new Array(g.attributes.position.count).fill(i*.618),1))
      return g
    })
    const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose())
    const material=new ShaderMaterial({vertexShader:planeVertex,
      fragmentShader:`uniform float time,opacity;uniform vec3 color;varying vec2 vUv;varying float vPhase,vDistance;
      void main(){vec3 tint=color;float alpha=0.;${fragment}${effectFragmentEnd}}`,
      uniforms:{time:{value:0},opacity:{value:0},color:{value:new Color(color)}},
      transparent:true,depthWrite:false,depthTest:true,side:DoubleSide,blending:additive?AdditiveBlending:NormalBlending})
    register(key,weightKey,new Mesh(geometry,material),material,color,strength,staticEffect)
  }
  const ring=`float t=fract(time*.42+vPhase);float r=length(vUv-.5)*2.;
    alpha=(1.-smoothstep(.025,.075,abs(r-t)))*(1.-t);
    alpha+=exp(-abs(r-t)*18.)*(1.-t)*.25;`
  const centers=Array.from({length:18},(_,i)=>[Math.sin(i*3)*3,.18,14-i*11,15,15,false])
  planes('aura','aura',centers,ring,'#ff8e4f',{strength:.9,additive:false})
  planes('psychic-rings','orbs',centers,ring,'#c191ff',{strength:.85,additive:false})
  planes('fairy-rings','petals',centers,ring,'#ffa8d1',{strength:.65,additive:false})
  const pond=[]
  for (const [x,z,w,d,y] of [[-7.2,13.7,5.05,5.85,.225],[-12,-134,5.45,5.95,.225]]) {
    for(let i=0;i<(lowPower?24:48);i++) pond.push([x+(Math.random()-.5)*(w-1.2),y,z+(Math.random()-.5)*(d-1.2),1.1,1.1,false])
  }
  planes('ripples','rain',pond,ring.replace('time*.42','time*1.2'),'#c0e9ff',{strength:1.1})
  const puddles=Array.from({length:lowPower?75:160},()=>{
    const {x,z}=outdoorPoint(); return [x,.09,z,1.5+Math.random()*2.5,1.2+Math.random()*2,false]
  })
  planes('puddles','rain',puddles,`
    vec2 p=vUv-.5;float r=length(p*vec2(1.,1.2));
    float edge=1.-smoothstep(.32,.48,r+.035*sin(vUv.x*28.)*sin(vUv.y*22.));
    float shine=pow(.5+.5*sin(vUv.y*14.+sin(vUv.x*8.)+time*.6),8.);
    tint=mix(color*.45,color,shine);alpha=edge*(.3+shine*.38);
  `,'#aecfdf',{additive:false,staticEffect:true})
  const flames=[]
  for(let i=0;i<(lowPower?85:180);i++) {
    const {x,z}=outdoorPoint(),h=1.2+Math.random()*1.8
    for (const angle of [0,Math.PI/2]) flames.push([x,h/2+.07,z,.8+Math.random()*.65,h,true,angle])
  }
  planes('flames','embers',flames,`
    float y=vUv.y;float t=time*2.8+vPhase*8.;
    float bend=sin(y*6.-t)*y*.15+sin(y*14.-t*1.7)*y*.05;
    float width=(1.-y)*(.36+.08*sin(t+y*10.));
    float body=1.-smoothstep(width*.35,width,abs(vUv.x-.5-bend));
    alpha=body*smoothstep(0.,.12,y)*(1.-smoothstep(.65,1.,y));
    tint=mix(vec3(1.,.12,.015),color,pow(body,3.)*(1.-y));
  `,'#ffd784',{strength:.85})
  planes('rays','rays',Array.from({length:18},(_,i)=>[Math.sin(i*2.7)*12,14,6-i*12,8,28,true]),`
    float center=.5+vUv.y*.12;float width=mix(.46,.08,vUv.y);
    float core=exp(-pow((vUv.x-center)/width,2.));
    float streak=.7+.3*sin(vUv.x*65.+vPhase*20.);
    alpha=core*streak*sin(vUv.y*3.14159)*(.72+.28*sin(time*.35+vPhase))*.34;
  `,'#ffd073',{additive:false,strength:1.5})

  const boltGeometry=new BufferGeometry()
  boltGeometry.setAttribute('position',new Float32BufferAttribute([],3))
  const boltMaterial=new MeshBasicMaterial({color:'#edf4ff',transparent:true,depthWrite:false,side:DoubleSide,toneMapped:false})
  const bolt=new Mesh(boltGeometry,boltMaterial);bolt.name='cloud-lightning';bolt.frustumCulled=false;bolt.visible=false;group.add(bolt)
  const lightningLight=new PointLight('#c8dcff',0,110,1.5);group.add(lightningLight)
  resources.push(boltGeometry,boltMaterial)
  function strike(camera) {
    const origin=clouds?.strikeOrigin(camera)
    if (!origin) return
    const {x,y,z}=origin, points=[], floor=heightAt(x,z)+.2
    const segment=(a,b,width)=>{
      points.push(a[0]-width,a[1],a[2],a[0]+width,a[1],a[2],b[0]-width,b[1],b[2],
        a[0]+width,a[1],a[2],b[0]+width,b[1],b[2],b[0]-width,b[1],b[2])
    }
    let previous=[x,y,z]
    for(let i=1;i<=18;i++) {
      const end=i===18, p=[x+(end?0:(Math.random()-.5)*4),y-(y-floor)*i/18,z+(end?0:(Math.random()-.5)*1.6)]
      segment(previous,p,.14)
      if(i===4||i===8||i===11) {
        let branch=p
        const side=Math.random()<.5?-1:1
        for(let j=1;j<=3;j++) {
          const next=[p[0]+side*j*(.8+Math.random()*.65),p[1]-j*.9,p[2]+j*.3]
          segment(branch,next,.075-j*.014);branch=next
        }
      }
      previous=p
    }
    boltGeometry.setAttribute('position',new Float32BufferAttribute(points,3));boltGeometry.computeBoundingSphere()
    lightningLight.position.set(x,Math.min(12,y-4),z);flash=.62
  }
  return {
    state,group,
    set(key){state.select(key)},
    resize(w,h){for(const e of effects) if(e.material.uniforms.viewport) e.material.uniforms.viewport.value=h},
    update(dt,camera,reduced=false) {
      state.update(dt,reduced)
      const step=Math.max(0,Math.min(dt,.1));if(!reduced) time+=step
      const weights=state.weights
      for(const e of effects) {
        e.material.uniforms.time.value=reduced?0:time
        e.material.uniforms.opacity.value=(reduced&&!e.staticEffect?0:weights[e.weightKey])*e.strength
        e.mesh.visible=e.material.uniforms.opacity.value>.001
      }
      if(reduced||weights.sparks<.5) {flash=0;nextLightning=time+.4+Math.random()*.6}
      else if(time>=nextLightning) {strike(camera);nextLightning=time+1.4+Math.random()*1.6}
      flash=Math.max(0,flash-step)
      // 每次放電兩個短脈衝，局部照亮雲底與地景；不使用全螢幕白閃。
      const age=.62-flash
      const pulse=flash>0?Math.max(0,1-age/.16,1-Math.abs(age-.3)/.1):0
      bolt.visible=pulse>.02;boltMaterial.opacity=Math.min(1,pulse*1.3)*weights.sparks
      lightningLight.intensity=pulse*210*weights.sparks
      clouds?.setFlash(pulse*weights.sparks)
    },
    environment(){return state.environment()},
    look(base,env){return weatherLook(base,env)},
    setLook(look){for(const e of effects)e.material.uniforms.color.value.copy(e.color).multiplyScalar(1-look.windows*.58)},
    get activeKey(){return state.key},
    get count(){return effects.reduce((n,e)=>n+(e.mesh.isPoints?e.mesh.geometry.attributes.position.count:0),0)},
    dispose(){resources.forEach(r=>r.dispose());scene.remove(group);group.clear()}
  }
}
