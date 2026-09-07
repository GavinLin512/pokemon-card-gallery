import { Group, BufferGeometry, Float32BufferAttribute, ShaderMaterial, Points, Color,
  AdditiveBlending, NormalBlending, Mesh, PlaneGeometry, DoubleSide, MeshBasicMaterial, PointLight } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createWeatherState, weatherLook } from './weather-state.js'

const VERT = `
attribute vec4 seed;
uniform float time, mode, viewport, size;
varying float fade, turn;
void main(){
 vec3 p=position; float t=time; float life=fract(seed.x+t*(mode==2. ? .5 : .07));
 fade=sin(life*3.14159); turn=seed.y*6.28+t*.4;
 if(mode==2.) { p.y=seed.w+(20.-seed.w)*(1.-life); fade=1.; }
 else if(mode==0. || mode==6. || mode==7.) {
   p.x+=sin(t*.5+seed.y*9.)*1.3+life*3.; p.z+=sin(t*.3+seed.x*8.)*.8;
   p.y+= (1.-life)*4.;
 } else if(mode==1.) {p.y+=life*4.;p.x+=sin(t+seed.y*8.)*.35;}
 else if(mode==3.) {p.y+=sin(t*.6+seed.x*9.)*.35;p.x+=sin(t*.3+seed.y*8.)*.6;fade=.65+.25*sin(t+seed.y*5.);}
 else if(mode==4.) {p.x+=sin(t*.08+seed.y*8.)*1.2;fade=.6;}
 else {p.y+=life*.8;p.x+=sin(t*.5+seed.y*8.)*.7;fade=sin(life*3.14159);}
 vec4 view=modelViewMatrix*vec4(p,1.);
 gl_Position=projectionMatrix*view;
 gl_PointSize=min(240.,size*viewport/max(1.,-view.z));
 fade*=smoothstep(0.,3.,-view.z)*(1.-smoothstep(65.,120.,-view.z));
}`
const FRAG = `
uniform vec3 color; uniform float opacity, mode; varying float fade,turn;
void main(){
 vec2 p=gl_PointCoord-.5; float c=cos(turn),s=sin(turn);p=mat2(c,-s,s,c)*p;
 float a=0.;
 if(mode==2.) {p=gl_PointCoord-.5;a=(1.-smoothstep(.025,.08,abs(p.x)))*(1.-smoothstep(.3,.5,abs(p.y)));}
 else if(mode==0.) {a=1.-smoothstep(.8,1.,length(p*vec2(2.4,4.5)));a*=.75+.25*step(0.,p.x);}
 else if(mode==6.) {a=1.-smoothstep(.7,1.,length(p*vec2(3.,2.5)));}
 else if(mode==7.) {a=1.-smoothstep(.75,1.,length(p*vec2(5.,2.2)));a*=.6+.4*cos(p.y*45.);}
 else if(mode==8.) {a=1.-smoothstep(.17,.23,abs(p.x)+abs(p.y));}
 else {a=exp(-dot(p,p)*(mode==4.?16.:28.));a*=1.-smoothstep(.35,.5,length(p));}
 if(a*opacity*fade<.003) discard;
 gl_FragColor=vec4(color,a*opacity*fade);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`

/** 世界座標天氣；所有可見物都經地景深度測試，無螢幕白閃。 */
export function createWeather(scene, { lowPower = false, trees = [], surfaces = [], flowers = [], clouds } = {}) {
 const group = new Group(); group.name='type-weather'; scene.add(group)
 const state=createWeatherState(), effects=[], resources=[]
 let time=0, nextLightning=.4+Math.random()*.6, flash=0, reduced=false
 const heightAt=(x,z)=>surfaces.reduce((height,b)=>x>=b.min.x&&x<=b.max.x&&z>=b.min.z&&z<=b.max.z?Math.max(height,b.max.y):height, .05)
 function particles(key, mode, count, color, size, additive=false) {
  count=Math.round(count*(lowPower?.45:1))
  const positions=[], seeds=[]
  for(let i=0;i<count;i++){
   let x=(Math.random()-.5)*50,z=22-Math.random()*213,y=.4
   if(mode===0&&trees.length){const tree=trees[i%trees.length];x=tree.x+(Math.random()-.5)*2;z=tree.z+(Math.random()-.5)*2;y=.8}
   if(key==='flower-glow'&&flowers.length){const flower=flowers[i%flowers.length];x=flower.x;z=flower.z;y=.5}
   if(mode===3)y=.6+Math.random()*1.8
   if(mode===4)y=.45+Math.random()*.7
   let height=heightAt(x,z)
   // 近地霧與光球只在戶外生成，避免整團薄霧浮到屋頂上。
   if(mode===3||mode===4)for(let attempt=0;height>1&&attempt<12;attempt++){
    x=(Math.random()-.5)*50;z=22-Math.random()*213;height=heightAt(x,z)
   }
   if(mode!==2&&height>1){y+=height}
   positions.push(x,y,z);seeds.push(Math.random(),Math.random(),Math.random(),height)
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('seed',new Float32BufferAttribute(seeds,4))
  const material=new ShaderMaterial({vertexShader:VERT,fragmentShader:FRAG,transparent:true,depthWrite:false,depthTest:true,
   blending:additive?AdditiveBlending:NormalBlending,uniforms:{time:{value:0},mode:{value:mode},viewport:{value:800},size:{value:size},color:{value:new Color(color)},opacity:{value:0}}})
  const mesh=new Points(geometry,material);mesh.frustumCulled=false;mesh.name=key;group.add(mesh)
  effects.push({key,mesh,material,color:new Color(color)});resources.push(geometry,material)
 }
 particles('leaves',0,1100,'#8fc765',.34)
 particles('embers',1,300,'#ff9a46',.12,true)
 particles('rain',2,3200,'#b9cedb',.38)
 particles('aura-flow',9,200,'#ecad7c',2.5,true)
 particles('orbs',3,180,'#cc9aff',.44,true)
 particles('psychic-fog',4,130,'#ab89c9',8)
 particles('mist',4,130,'#7a818c',9)
 particles('shards',8,300,'#e7efff',.2,true)
 particles('petals',6,650,'#ffd0dc',.26)
 particles('flower-glow',5,250,'#ffc4de',.13,true)
 particles('feathers',7,270,'#ffffff',.36)
 const planeVertex=`attribute float phase;varying vec2 vUv;varying float vPhase;void main(){vUv=uv;vPhase=phase;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
 function planes(key, placements, fragment, color){
  const parts=placements.map(([x,y,z,w,h,vertical],i)=>{
   const g=new PlaneGeometry(w,h);if(!vertical)g.rotateX(-Math.PI/2);g.translate(x,y,z)
   g.setAttribute('phase',new Float32BufferAttribute(new Array(g.attributes.position.count).fill(i*.618),1));return g
  })
  const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose())
  const material=new ShaderMaterial({vertexShader:planeVertex,fragmentShader:`uniform float time,opacity;uniform vec3 color;varying vec2 vUv;varying float vPhase;${fragment}`,uniforms:{time:{value:0},opacity:{value:0},color:{value:new Color(color)}},transparent:true,depthWrite:false,side:DoubleSide,blending:AdditiveBlending})
  const mesh=new Mesh(geometry,material);mesh.name=key;group.add(mesh);effects.push({key,mesh,material,color:new Color(color)});resources.push(geometry,material)
 }
 const rings=`void main(){float t=fract(time*.65+vPhase);float r=length(vUv-.5)*2.;float a=(1.-smoothstep(.025,.065,abs(r-t)))*(1.-t);gl_FragColor=vec4(color,a*opacity);}`
 const pond=[]
 for(const [x,z,w,d,y] of [[-7.2,13.7,5.05,5.85,.225],[-12,-134,5.5,6,.235]])for(let i=0;i<22;i++)pond.push([x+(Math.random()-.5)*(w-1),y,z+(Math.random()-.5)*(d-1),.8,.8,false])
 planes('ripples',pond,rings,'#b6e2ec')
 planes('aura',Array.from({length:18},(_,i)=>[Math.sin(i*3)*3,.18,14-i*11,12,12,false]),rings,'#ee975b')
 planes('rays',Array.from({length:18},(_,i)=>[Math.sin(i*2.7)*16,12,4-i*12,5,24,true]),`void main(){float center=.5+(vUv.y-.5)*.3;float a=exp(-pow((vUv.x-center)*7.,2.))*sin(vUv.y*3.14159);a*=.6+.4*sin(time*.25+vPhase);gl_FragColor=vec4(color,a*opacity*.13);}`,'#ffe4a2')
 const boltGeometry=new BufferGeometry(), boltMaterial=new MeshBasicMaterial({color:'#edf4ff',transparent:true,depthWrite:false,side:DoubleSide,toneMapped:false})
 boltGeometry.setAttribute('position',new Float32BufferAttribute([],3))
 const bolt=new Mesh(boltGeometry,boltMaterial);bolt.name='cloud-lightning';bolt.frustumCulled=false;bolt.visible=false;group.add(bolt)
 const lightningLight=new PointLight('#c8dcff',0,95,1.5);group.add(lightningLight);resources.push(boltGeometry,boltMaterial)
 function strike(camera){
  const origin = clouds?.strikeOrigin(camera)
  if (!origin) return
  const side=Math.random()<.5?-1:1
  const {x,y,z}=origin, points=[]
  const floor=heightAt(x,z)+.15
  const segment=(a,b,width)=>{
   points.push(a[0]-width,a[1],a[2],a[0]+width,a[1],a[2],b[0]-width,b[1],b[2],
    a[0]+width,a[1],a[2],b[0]+width,b[1],b[2],b[0]-width,b[1],b[2])
  }
  let prev=[x,y,z]
  for(let i=1;i<=16;i++){
   const p=[x+(Math.random()-.5)*3.5,y-(y-floor)*i/16,z+(Math.random()-.5)*1.4]
   segment(prev,p,.075)
   if(i===4||i===7)segment(p,[p[0]+side*(2+Math.random()*3),p[1]-2.5,p[2]],.035)
   prev=p
  }
  boltGeometry.setAttribute('position',new Float32BufferAttribute(points,3));boltGeometry.computeBoundingSphere()
  lightningLight.position.set(x,y-2,z);flash=.48
 }
 return {
  state, group,
  set(key){state.select(key)},
  resize(w,h){for(const e of effects)if(e.material.uniforms.viewport)e.material.uniforms.viewport.value=h},
  update(dt,camera,isReduced=false){
   reduced=isReduced; state.update(dt,reduced);if(!reduced)time+=Math.max(0,Math.min(dt,.1))
   const weights=state.weights
   for(const e of effects){
    const key={'aura-flow':'aura','psychic-fog':'orbs','flower-glow':'petals',ripples:'rain'}[e.key]??e.key
    const fog=e.key==='mist'||e.key==='psychic-fog'
    e.material.uniforms.time.value=time
    e.material.uniforms.opacity.value=(reduced&&!fog?0:weights[key]??0)*(fog?.15:e.key==='aura-flow'?.16:e.key==='rain'?.62:1)
    e.mesh.visible=e.material.uniforms.opacity.value>.001
   }
   if(reduced||weights.sparks<.5){flash=0;nextLightning=time+.4+Math.random()*.6}
   else if(time>=nextLightning){strike(camera);nextLightning=time+1+Math.random()*2}
   flash=Math.max(0,flash-dt);bolt.visible=flash>0;boltMaterial.opacity=flash>0 ? Math.min(1,flash/.12)*(.7+.3*Math.cos(flash*38)) : 0
   lightningLight.intensity=flash*270*weights.sparks
  },
  environment(){return state.environment()},
  look(base,env){return weatherLook(base,env)},
  setLook(look){for(const e of effects)e.material.uniforms.color.value.copy(e.color).multiplyScalar(1-look.windows*.5)},
  get activeKey(){return state.key},
  get count(){return effects.reduce((n,e)=>n+(e.mesh.isPoints?e.mesh.geometry.attributes.position.count:0),0)},
  dispose(){resources.forEach(r=>r.dispose());scene.remove(group);group.clear()}
 }
}
