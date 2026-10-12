import { Group, BufferGeometry, Float32BufferAttribute, ShaderMaterial, Points, Color,
  AdditiveBlending, NormalBlending, Mesh, PlaneGeometry, DoubleSide, MeshBasicMaterial, PointLight, Vector3, Vector4 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { particleVertex, particleFragment, effectFragmentEnd } from './weather-shaders.js'

/**
 * 世界座標天氣；與地景共用深度，所有資源集中建立、淡入淡出及釋放。
 * state 為場景外觀（look.js）的唯讀天氣權重與目前天氣，過場由場景外觀推進。
 */
export function createWeather(scene, { state, lowPower = false, trees = [], surfaces = [], flowers = [], glints = [], clouds, ground = null } = {}) {
  const group = new Group(); group.name = 'type-weather'; scene.add(group)
  const effects = [], resources = []
  let time = 0, nextLightning = .4 + Math.random()*.6, flash = 0
  /** 地面高度：HD-2D 傳入含台地與階梯的地形函式，現行畫風為平地。 */
  const floorAt = ground ?? (() => 0)
  /** 該點上方最高的屋頂／建築頂面；沒有建築時為 -Infinity。 */
  const roofAt = (x,z) => surfaces.reduce((height,b) =>
    x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z ? Math.max(height,b.max.y) : height, -Infinity)
  /** 雨滴的停止高度：屋頂，否則地面（含台地）略高一點。 */
  const heightAt = (x,z) => Math.max(roofAt(x,z), floorAt(x,z)+.05)
  const covered = (x,z) => roofAt(x,z) > floorAt(x,z)+1
  // 格鬥的震地衝擊 (x, z, 經過秒數, 強度) 與衝擊點地面高度：所有粒子材質共用同一個物件，每幀只改數值。
  const IMPACT_CYCLE=4, IMPACT_FIRST=1.2
  const impact=new Vector4(0,0,IMPACT_CYCLE,0), impactGround={value:0}

  function outdoorPoint() {
    for (let i=0; i<30; i++) {
      const x=(Math.random()-.5)*42, z=22-Math.random()*207
      if (!covered(x,z)) return {x,z}
    }
    // 中央道路無建築，保留一個確定在戶外的後備點。
    return {x:0,z:-30-Math.random()*70}
  }
  /** nightGlow：自己發光的效果（惡的眼睛），夜晚不跟著變暗。 */
  function register(key, weightKey, mesh, material, color, strength=1, staticEffect=false, nightGlow=false) {
    mesh.name=key; mesh.visible=false; group.add(mesh)
    effects.push({key,weightKey,mesh,material,color:new Color(color),strength,staticEffect,nightGlow})
    resources.push(mesh.geometry,material)
  }
  /** anchors：固定位置的粒子（鋼的反光點、惡的眼睛），直接使用給定的世界座標，手機隔一取一。 */
  function particles(key, weightKey, mode, count, color, size, {additive=false,strength=1,staticEffect=false,anchors=null,nightGlow=false}={}) {
    if (anchors) anchors=anchors.filter((_,i)=>!lowPower||i%2===0)
    count=anchors ? anchors.length : Math.round(count*(lowPower?.42:1))
    const positions=[], seeds=[]
    for (let i=0; i<count; i++) {
      if (anchors) { const {x,y,z}=anchors[i]; positions.push(x,y,z); seeds.push(Math.random(),Math.random(),Math.random(),y); continue }
      let x=(Math.random()-.5)*48, z=24-Math.random()*213, y=.35
      if ((mode===0||key==='leaf-glow')&&trees.length) {
        const tree=trees[i%trees.length]; x=tree.x*.78+(Math.random()-.5)*4;z=tree.z+(Math.random()-.5)*4;y=.6
      }
      if (key==='flower-glow'&&flowers.length) {
        const flower=flowers[i%flowers.length];x=flower.x+(Math.random()-.5)*3;z=flower.z+(Math.random()-.5)*3;y=.6
      }
      // 落地漣漪（10）與念力浮石（16）只取戶外地面；彈起水珠（14）仍可落在屋頂。
      if ([1,4,9,10,16].includes(mode)) { ({x,z}=outdoorPoint()) }
      if (mode===4) y=.5+Math.random()*1.8
      if (mode===16) y=.12
      const height=heightAt(x,z)
      // 雨滴、落地漣漪與水珠的高度由著色器依 seed.w（屋頂／地面）決定；其餘粒子抬到屋頂或所在台地。
      if (mode!==2&&mode!==10&&mode!==14) y+=covered(x,z) ? height : floorAt(x,z)
      positions.push(x,y,z); seeds.push(Math.random(),Math.random(),Math.random(),height)
    }
    const geometry=new BufferGeometry()
    geometry.setAttribute('position',new Float32BufferAttribute(positions,3))
    geometry.setAttribute('seed',new Float32BufferAttribute(seeds,4))
    const material=new ShaderMaterial({vertexShader:particleVertex,fragmentShader:particleFragment,
      transparent:true,depthWrite:false,depthTest:true,blending:additive?AdditiveBlending:NormalBlending,
      uniforms:{time:{value:0},mode:{value:mode},viewport:{value:800},size:{value:size},color:{value:new Color(color)},opacity:{value:0},
        impact:{value:impact},impactGround}})
    const mesh=new Points(geometry,material);mesh.frustumCulled=false
    register(key,weightKey,mesh,material,color,strength,staticEffect,nightGlow)
  }
  // 2026-10-12：飄葉 2500 減為 1500、羽毛 800 減為 500（使用者回饋太多）。
  particles('leaves','leaves',0,1500,'#8ccb4b',.8)
  particles('leaf-glow','leaves',5,650,'#d0ff8a',.22,{additive:true,strength:.8})
  particles('embers','embers',1,1000,'#ff9a35',.27,{additive:true})
  // 2026-10-11：雨量較暴雨版減 20%；落地由 X 形噴濺改為貼地漣漪加彈起水珠（PLAN §9.4）。
  particles('rain','rain',2,11600,'#c1daed',.95,{strength:.8})
  particles('rain-splash','rain',10,1500,'#d4eeff',.75,{strength:.8})
  particles('rain-drops','rain',14,900,'#e6f5ff',.16,{strength:.8})
  particles('rain-mist','rain',4,200,'#859db1',10,{strength:.22,staticEffect:true})
  particles('aura-flow','aura',9,500,'#eeb07b',4,{additive:true,strength:.38})
  // 2026-10-12：格鬥的菱形沙粒改為每一擊揚起的沙塵與彈跳碎石；位置由衝擊點決定，數量只需涵蓋一擊（PLAN §9.4）。
  particles('impact-dust','aura',17,70,'#c9a27a',1.1,{strength:.85})
  particles('impact-rocks','aura',18,40,'#8f8072',.32)
  // 2026-10-12：超能力的小光點與遠方大顆紫霧移除，改為念力浮石；薄紫霧畫在地景材質（weather-surfaces.js）。
  particles('psychic-stones','orbs',16,900,'#9a8f86',.5)
  // 2026-10-12：惡的大顆暗霧與黑色碎影移除，改為樹前與建築右側陰影裡的紅眼（HD-2D 的影子落在建築右邊）；
  // 地面暗影觸手畫在地景材質。眼睛自己發光，夜晚不變暗。
  const eyeSpots=[]
  trees.forEach((t,i)=>{
    if (i%2) return
    const x=t.x+(Math.random()-.5)*.8, z=t.z+.9
    eyeSpots.push({x,y:floorAt(x,z)+.6+Math.random()*.5,z})
  })
  for (const b of surfaces) {
    const x=b.max.x+.45, z=b.max.z-.6-Math.random()*Math.max(0,b.max.z-b.min.z-1.2)
    if (!covered(x,z)) eyeSpots.push({x,y:floorAt(x,z)+.55+Math.random()*.4,z})
  }
  particles('dark-eyes','mist',19,0,'#ff2a3c',.75,{anchors:eyeSpots,nightGlow:true})
  // 2026-10-12：鋼的落下碎片改為屋頂與圍欄上的反光星芒（PLAN §9.4）。
  particles('steel-glints','shards',15,0,'#dfeaff',1.5,{additive:true,anchors:glints})
  particles('petals','petals',6,1800,'#ffc1d5',.7)
  particles('flower-glow','petals',5,700,'#ffd0e4',.3,{additive:true})
  // 2026-10-12：羽毛改為像素羽毛，數量與尺寸都比舊版小；龍的金色鱗光由天空的龍星群取代（sky-weather.js）。
  particles('feathers','feathers',7,500,'#ffffff',.7)

  const planeVertex=`attribute float phase;varying vec2 vUv;varying float vPhase,vDistance;
    void main(){vUv=uv;vPhase=phase;vec4 view=modelViewMatrix*vec4(position,1.);vDistance=-view.z;gl_Position=projectionMatrix*view;}`
  /** header：放在 main 之前的著色器函式。 */
  function planes(key,weightKey,placements,fragment,color,{additive=true,strength=1,staticEffect=false,header=''}={}) {
    const parts=placements.map(([x,y,z,w,h,vertical,angle=0],i) => {
      const g=new PlaneGeometry(w,h)
      if (!vertical) g.rotateX(-Math.PI/2)
      g.rotateY(angle);g.translate(x,y,z)
      g.setAttribute('phase',new Float32BufferAttribute(new Array(g.attributes.position.count).fill(i*.618),1))
      return g
    })
    const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose())
    const material=new ShaderMaterial({vertexShader:planeVertex,
      fragmentShader:`uniform float time,opacity;uniform vec3 color;varying vec2 vUv;varying float vPhase,vDistance;${header}
      void main(){vec3 tint=color;float alpha=0.;${fragment}${effectFragmentEnd}}`,
      uniforms:{time:{value:0},opacity:{value:0},color:{value:new Color(color)}},
      transparent:true,depthWrite:false,depthTest:true,side:DoubleSide,blending:additive?AdditiveBlending:NormalBlending})
    register(key,weightKey,new Mesh(geometry,material),material,color,strength,staticEffect)
  }
  const ring=`float t=fract(time*.42+vPhase);float r=length(vUv-.5)*2.;
    alpha=(1.-smoothstep(.025,.075,abs(r-t)))*(1.-t);
    alpha+=exp(-abs(r-t)*18.)*(1.-t)*.25;`
  // 近地平面（光圈、池塘漣漪、積水、火舌）都抬到所在台地的高度。
  // 2026-10-12：格鬥與超能力原本也用這組光圈（只換顏色），改版後只留給妖精。
  const centers=Array.from({length:18},(_,i)=>{const x=Math.sin(i*3)*3,z=14-i*11;return [x,floorAt(x,z)+.18,z,15,15,false]})
  planes('fairy-rings','petals',centers,ring,'#ffa8d1',{strength:.65,additive:false})
  const pond=[]
  for (const [x,z,w,d,y] of [[-7.2,13.7,5.05,5.85,.225],[-12,-134,5.45,5.95,.225]]) {
    for(let i=0;i<(lowPower?24:48);i++) pond.push([x+(Math.random()-.5)*(w-1.2),floorAt(x,z)+y,z+(Math.random()-.5)*(d-1.2),1.1,1.1,false])
  }
  planes('ripples','rain',pond,ring.replace('time*.42','time*1.2'),'#c0e9ff',{strength:1.1})
  const puddles=Array.from({length:lowPower?75:160},()=>{
    const {x,z}=outdoorPoint(); return [x,floorAt(x,z)+.09,z,1.5+Math.random()*2.5,1.2+Math.random()*2,false]
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
    for (const angle of [0,Math.PI/2]) flames.push([x,floorAt(x,z)+h/2+.07,z,.8+Math.random()*.65,h,true,angle])
  }
  planes('flames','embers',flames,`
    float y=vUv.y;float t=time*2.8+vPhase*8.;
    float bend=sin(y*6.-t)*y*.15+sin(y*14.-t*1.7)*y*.05;
    float width=(1.-y)*(.36+.08*sin(t+y*10.));
    float body=1.-smoothstep(width*.35,width,abs(vUv.x-.5-bend));
    alpha=body*smoothstep(0.,.12,y)*(1.-smoothstep(.65,1.,y));
    tint=mix(vec3(1.,.12,.015),color,pow(body,3.)*(1.-y));
  `,'#ffd784',{strength:.85})
  // 無色的動畫風線：面向鏡頭的直立平面（寬高 4:1）上，一段細白線沿起伏的路徑往東滑過，接近尾端時捲一圈後消失。
  const gusts=Array.from({length:lowPower?18:40},()=>{
    const x=(Math.random()-.5)*28, z=20-Math.random()*210
    return [x,floorAt(x,z)+1.8+Math.random()*2.6,z,8,2,true,(Math.random()-.5)*.5]
  })
  planes('wind-lines','feathers',gusts,`
    vec2 q=vUv*vec2(4.,1.);
    float head=fract(time*.3+vPhase)*1.7-.15, tail=head-.4;
    if(q.x>windPath(max(tail,0.),vPhase).x-.3&&q.x<windPath(clamp(head,0.,1.),vPhase).x+.3){
      float best=1e3,along=0.;
      for(int i=0;i<20;i++){
        float s0=tail+float(i)*.02, s1=s0+.02;
        if(s1<0.||s0>1.) continue;
        s0=max(s0,0.);s1=min(s1,1.);
        vec2 a=windPath(s0,vPhase), ab=windPath(s1,vPhase)-a;
        float h=clamp(dot(q-a,ab)/max(dot(ab,ab),1e-6),0.,1.), d=length(q-a-ab*h);
        if(d<best){best=d;along=mix(s0,s1,h);}
      }
      float k=clamp((along-tail)/.4,0.,1.), width=.035*sin(k*3.14159)+.006;
      alpha=(1.-smoothstep(width*.55,width,best))*.85*smoothstep(0.,.06,along)*(1.-smoothstep(.94,1.,along));
    }
  `,'#ffffff',{additive:false,strength:.8,header:`
    vec2 windPath(float s,float seed){
      float curl=clamp((s-.72)/.28,0.,1.)*6.2832;
      return vec2(.15+min(s,.72)*3.6+max(s-.72,0.)*1.2,.35+.1*sin(s*5.+seed*6.2832))+vec2(sin(curl),1.-cos(curl))*.22;
    }
  `})

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
  // 龍：約每 10 秒飛過一次（3.6 秒），只有地面的龍影。每一輪隨機挑鏡頭前方可見地面上的一個經過點與任意飛行方向，
  // 位置與走向每次都不同；左右範圍依畫面寬高比縮放，直向手機也落在畫面內。angle 為 0 時往 -z（畫面深處）飛。
  const DRAGON_CYCLE=10, DRAGON_PASS=3.6, DRAGON_REACH=25
  const dragon={x:0,z:0,angle:0,shadow:0}
  let dragonClock=0, dragonPath=null
  const facing=new Vector3()
  function flyDragon(step,camera,weight) {
    dragonClock+=step
    if (dragonClock>=DRAGON_CYCLE||!dragonPath) {
      dragonClock%=DRAGON_CYCLE
      camera.getWorldDirection(facing)
      const length=Math.hypot(facing.x,facing.z)||1, fx=facing.x/length, fz=facing.z/length
      const ahead=10+Math.random()*16, side=(Math.random()*2-1)*ahead*Math.tan(camera.fov*Math.PI/360)*camera.aspect*.6
      dragonPath={x:camera.position.x+fx*ahead-fz*side, z:camera.position.z+fz*ahead+fx*side}
      dragon.angle=Math.random()*Math.PI*2
    }
    const age=dragonClock, along=(age/DRAGON_PASS*2-1)*DRAGON_REACH
    dragon.x=dragonPath.x+Math.sin(dragon.angle)*along
    dragon.z=dragonPath.z-Math.cos(dragon.angle)*along
    dragon.shadow=age<DRAGON_PASS ? weight*Math.min(1,age/.5,(DRAGON_PASS-age)/.5) : 0
  }
  // 格鬥：選天氣後約 1.2 秒第一擊，之後每 4 秒一擊。落點在鏡頭前方 9–20 單位的戶外地面，左右偏離畫面中線
  // 30%–75% 的半寬（放大的卡牌蓋在畫面中央）；每一擊重新挑，位置每次都不同。
  let impactClock=IMPACT_CYCLE-IMPACT_FIRST, impactPlaced=false
  function quake(step,camera,weight) {
    impactClock+=step
    if (impactClock>=IMPACT_CYCLE) {
      impactClock%=IMPACT_CYCLE
      camera.getWorldDirection(facing)
      const length=Math.hypot(facing.x,facing.z)||1, fx=facing.x/length, fz=facing.z/length
      const halfWidth=Math.tan(camera.fov*Math.PI/360)*camera.aspect
      let x=0, z=0
      for (let i=0; i<8; i++) {
        const ahead=9+Math.random()*11, side=(Math.random()<.5?-1:1)*(.3+Math.random()*.45)*ahead*halfWidth
        x=camera.position.x+fx*ahead-fz*side; z=camera.position.z+fz*ahead+fx*side
        if (!covered(x,z)) break
      }
      impact.x=x; impact.y=z; impactGround.value=floorAt(x,z); impactPlaced=true
    }
    impact.z=impactPlaced ? impactClock : IMPACT_CYCLE
    impact.w=impactPlaced ? weight : 0
  }
  return {
    group,
    resize(w,h){for(const e of effects) if(e.material.uniforms.viewport) e.material.uniforms.viewport.value=h},
    update(dt,camera,reduced=false) {
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
      if(reduced||weights.rays<.01) {dragonClock=0;dragonPath=null;dragon.shadow=0}
      else flyDragon(step,camera,weights.rays)
      if(reduced||weights.aura<.01) {impactClock=IMPACT_CYCLE-IMPACT_FIRST;impactPlaced=false;impact.z=IMPACT_CYCLE;impact.w=0}
      else quake(step,camera,weights.aura)
    },
    /** 龍影的世界位置 (x, z)、飛行方向 angle 與深淺 shadow（0 為不顯示）。 */
    get dragon(){return dragon},
    /** 格鬥衝擊 (x, z, 經過秒數, 強度)；強度 0 為沒有衝擊（含減少動態）。 */
    get impact(){return impact},
    /** 衝擊點的地面高度。 */
    get impactGround(){return impactGround.value},
    setLook(look){for(const e of effects)if(!e.nightGlow)e.material.uniforms.color.value.copy(e.color).multiplyScalar(1-look.windows*.58)},
    get activeKey(){return state.key},
    get count(){return effects.reduce((n,e)=>n+(e.mesh.isPoints?e.mesh.geometry.attributes.position.count:0),0)},
    dispose(){resources.forEach(r=>r.dispose());scene.remove(group);group.clear()}
  }
}
