import test from 'node:test'
import assert from 'node:assert/strict'
import { Scene, Color, Vector3 } from 'three'
import { weatherKeyFor, weatherByType, weatherEffects } from '../src/config/weather.js'
import { createSceneLook } from '../src/scene/look.js'
import { createVillage } from '../src/scene/village.js'
import { createWeather } from '../src/scene/weather.js'
import { terrainAt, groundAt } from '../src/scene/terrain.js'
import { periods, periodByKey } from '../src/config/dayCycle.js'
import { createPostPass } from '../src/scene/post.js'
import { createSkyWeather } from '../src/scene/sky-weather.js'

/** 村莊與場景外觀：天氣由場景外觀推進，再交給村莊更新粒子與村民。 */
function villageWithLook(options = {}) {
 const look=createSceneLook(periodByKey('day')),v=createVillage({...options,sceneLook:look})
 const step=(now,reduced,progress,dt)=>{look.advance(now,dt,reduced);v.update({x:0,y:0},now,reduced,progress,dt)}
 return {look,v,step}
}

test('first type, unknown and absent types resolve explicitly',()=>{
 assert.equal(weatherKeyFor({types:['Fire','Water']}),'embers')
 assert.equal(weatherKeyFor({types:'Water,Fire'}),'rain')
 for(const card of [null,{}, {types:[]},{types:['Unknown']}]) assert.equal(weatherKeyFor(card),null)
 assert.equal(new Set(Object.values(weatherByType)).size,11)
})
test('two second transition starts at current mix, interrupts without jump and returns to baseline',()=>{
 const s=createSceneLook(periodByKey('day')),w=s.weather.weights;s.setWeather('rain');s.advance(0,1)
 assert.equal(w.rain,.5);s.setWeather('embers');s.advance(0,0);assert.equal(w.rain,.5)
 s.advance(0,2);assert.equal(w.embers,1);assert.equal(w.rain,0)
 s.advance(0,20);assert.equal(s.weather.key,'embers')
 s.setWeather(null);s.advance(0,2);assert.equal(w.clear,1)
 assert.equal(createSceneLook(periodByKey('day')).weather.key,null)
 s.setWeather('orbs');s.advance(0,0,true);assert.equal(w.orbs,1)
})
test('all weather profiles preserve day/night identity and finite lighting',()=>{
 for(const key of Object.values(weatherByType)){
  let day,night
  for(const p of periods){
   const s=createSceneLook(p);s.setWeather(key);s.advance(0,2)
   const look=s.look;assert.equal(look.windows,p.windows)
   for(const c of [look.skyTop,look.skyBottom,look.light])assert.ok(c.toArray().every(Number.isFinite))
   const luminance=look.skyBottom.r+look.skyBottom.g+look.skyBottom.b
   if(p.key==='day')day=luminance;if(p.key==='night')night=luminance
  }
  assert.ok(night<day*.3,key)
 }
})
test('world weather follows scene depth, rain stops above roofs, reduced mode hides dynamics, mobile reduces count',()=>{
 let desktopCount
 for(const lowPower of [false,true]){
  const {look,v,step}=villageWithLook({lowPower});v.resize(1440,900)
  if(!lowPower)desktopCount=v.weather.count;else assert.ok(v.weather.count<desktopCount*.6)
  const rain=v.scene.getObjectByName('rain'),pos=rain.geometry.attributes.position,seeds=rain.geometry.attributes.seed
  let roofDrops=0
  for(let i=0;i<pos.count;i++){
   if(seeds.getW(i)>3)roofDrops++
   if(Math.abs(pos.getX(i)+7)<2&&Math.abs(pos.getZ(i)+8)<1.5)assert.ok(seeds.getW(i)>3)
  }
  assert.ok(roofDrops>0)
  for(const key of Object.values(weatherByType)){
   look.setWeather(key)
   for(let i=0;i<21;i++)step(i*100,false,.5,.1)
   assert.equal(v.weather.activeKey,key)
   v.weather.group.traverse(o=>{if(o.material){assert.notEqual(o.material.depthTest,false);assert.equal(o.material.depthWrite,false)}})
   step(2200,true,.5,0)
   for(const o of v.weather.group.children)if(o.isPoints&&o.name!=='rain-mist')assert.equal(o.visible,false,o.name)
  }
  v.dispose()
 }
})

test('lightning becomes visible soon, has branched triangles, repeats and stops in reduced mode',()=>{
 const {look,v,step}=villageWithLook();look.setWeather('sparks');let strikes=0,wasVisible=false
 for(let i=0;i<120;i++){
  step(i*100,false,0,.1)
  const bolt=v.scene.getObjectByName('cloud-lightning')
  if(bolt.visible&&!wasVisible){strikes++;assert.ok(bolt.geometry.attributes.position.count>=66);assert.ok(bolt.geometry.attributes.position.array.every(Number.isFinite))}
  wasVisible=bolt.visible
  if(i===40)assert.ok(strikes>=1,'first flash appears within four seconds of selecting weather')
 }
 assert.ok(strikes>=2)
 step(12000,true,0,0)
 assert.equal(v.scene.getObjectByName('cloud-lightning').visible,false)
 v.dispose()
})


test('enhanced weather stays in world space through travel and clears after interrupted transitions',()=>{
 const {look,v,step}=villageWithLook({lowPower:true});v.resize(390,844)
 const names=['leaf-glow','flames','rain-splash','rain-drops','puddles','psychic-stones','impact-dust','impact-rocks','dark-eyes','fairy-rings','steel-glints','wind-lines']
 const originals=new Map(names.map(name=>[name,v.scene.getObjectByName(name).geometry.attributes.position.array.slice()]))
 for(const key of Object.values(weatherByType)) {
  look.setWeather(key)
  step(100,false,.2,2)
  for(const progress of [0,.45,1,0]) step(200,false,progress,.1)
  for(const name of names) assert.deepEqual(v.scene.getObjectByName(name).geometry.attributes.position.array,originals.get(name))
  look.setWeather('rain');step(300,false,.4,.5)
  look.setWeather(null);step(400,false,.4,2)
  for(const mesh of v.weather.group.children) if(mesh.material) assert.equal(mesh.visible,false,mesh.name)
 }
 // 靜態積水與霧可以保留，但時間不能繼續推進；回到一般模式可重新播放。
 look.setWeather('rain');step(500,true,1,0)
 const puddles=v.scene.getObjectByName('puddles'),fog=v.scene.getObjectByName('rain-mist')
 assert.equal(puddles.visible,true);assert.equal(fog.visible,true)
 step(5000,true,1,5)
 assert.equal(puddles.material.uniforms.time.value,0);assert.equal(fog.material.uniforms.time.value,0)
 step(5100,false,.5,.1)
 assert.equal(v.scene.getObjectByName('rain-splash').visible,true)
 v.dispose()
})

test('dragon shadow crosses the visible ground at a different spot and heading each pass, and reduced mode stops it',()=>{
 const {look,v,step}=villageWithLook();v.resize(1440,900);look.setWeather('rays')
 const passes=[];let current=null
 for(let i=0;i<320;i++){
  step(i*100,false,.1,.1)
  const d=v.weather.dragon,cam=v.camera.position
  assert.ok([d.x,d.z,d.angle,d.shadow].every(Number.isFinite))
  if(d.shadow>0){
   if(!current){current={angle:d.angle,points:[]};passes.push(current)}
   current.points.push({x:d.x-cam.x,z:d.z-cam.z,shadow:d.shadow})
  } else current=null
 }
 assert.ok(passes.length>=3,`passes: ${passes.length}`)
 for(const pass of passes.slice(0,3)){
  // 經過的中點（隨機挑出的經過點）落在鏡頭前方 10–26 單位、左右不超出畫面的地面上。
  const mid=pass.points[Math.floor(pass.points.length/2)]
  assert.ok(-mid.z>8&&-mid.z<28&&Math.abs(mid.x)<20,`crossing at ${mid.x.toFixed(1)},${mid.z.toFixed(1)}`)
 }
 const spots=passes.slice(0,3).map(p=>p.points[Math.floor(p.points.length/2)])
 assert.ok(new Set(passes.slice(0,3).map(p=>p.angle.toFixed(3))).size===3,'heading changes each pass')
 assert.ok(Math.hypot(spots[0].x-spots[1].x,spots[0].z-spots[1].z)>.01&&Math.hypot(spots[1].x-spots[2].x,spots[1].z-spots[2].z)>.01,'crossing point changes each pass')
 step(40000,true,.1,0)
 assert.equal(v.weather.dragon.shadow,0)
 v.dispose()
})

test('steel glints sit on roofs and fence posts instead of the open ground',()=>{
 const v=createVillage({lowPower:false})
 const pos=v.scene.getObjectByName('steel-glints').geometry.attributes.position
 assert.ok(pos.count>100)
 for(let i=0;i<pos.count;i++) assert.ok(pos.getY(i)>.9,`glint at y=${pos.getY(i)}`)
 v.dispose()
})

test('new ground effects avoid buildings and rain splashes share roof stopping heights',()=>{
 const v=createVillage({lowPower:true})
 const flames=v.scene.getObjectByName('flames').geometry.attributes.position
 for(let i=0;i<flames.count;i++) {
  const x=flames.getX(i),z=flames.getZ(i)
  // 容許火舌邊緣延伸，中心不得生成在真新鎮民宅內。
  assert.ok(!(Math.abs(x+7)<2&&Math.abs(z+8)<1.2))
 }
 // 彈起的水珠沿用雨滴的屋頂停止高度；貼地漣漪只在戶外地面，不出現在屋頂。
 for(const [name,onRoofs] of [['rain-drops',true],['rain-splash',false]]) {
  const rain=v.scene.getObjectByName(name).geometry
  let roofs=0
  for(let i=0;i<rain.attributes.seed.count;i++) if(rain.attributes.seed.getW(i)>=1) roofs++
  assert.equal(roofs>0,onRoofs,`${name} on roofs`)
 }
 // 雨量較暴雨版減 20%，手機仍依 lowPower 減量。
 assert.equal(v.scene.getObjectByName('rain').geometry.attributes.position.count,Math.round(11600*.42))
 v.dispose()
})

test('with HD-2D terrain the ground weather sits on each terrace instead of under it',()=>{
 // HD-2D 村莊需要 canvas，這裡直接把地形函式交給天氣；第一層台地高 .8，避開階梯與高地並留出平面半徑的邊距。
 const w=createWeather(new Scene(),{lowPower:true,ground:terrainAt})
 const onTerrace=(x,z)=>z<-38&&z>-58&&x<8&&x>-20
 for(const name of ['rain','rain-splash','rain-drops']){
  const g=w.group.getObjectByName(name).geometry,pos=g.attributes.position,seed=g.attributes.seed
  let checked=0
  for(let i=0;i<pos.count;i++){
   const x=pos.getX(i),z=pos.getZ(i);if(!onTerrace(x,z))continue
   assert.ok(Math.abs(seed.getW(i)-(groundAt(x,z)+.05))<1e-6,`${name} stops at ${seed.getW(i)} over ${x.toFixed(1)},${z.toFixed(1)}`);checked++
  }
  assert.ok(checked>0,name)
 }
 for(const name of ['puddles','flames','embers','psychic-stones']){
  const pos=w.group.getObjectByName(name).geometry.attributes.position
  let checked=0
  for(let i=0;i<pos.count;i++){
   const x=pos.getX(i),z=pos.getZ(i);if(!onTerrace(x,z))continue
   assert.ok(pos.getY(i)>=groundAt(x,z)-1e-6,`${name} vertex y=${pos.getY(i)} under ${x.toFixed(1)},${z.toFixed(1)}`);checked++
  }
  assert.ok(checked>0,name)
 }
 // 現行畫風維持平地：漣漪一律停在 .05。
 const flat=createWeather(new Scene(),{lowPower:true})
 const s=flat.group.getObjectByName('rain-splash').geometry.attributes.seed
 for(let i=0;i<s.count;i++) assert.ok(Math.abs(s.getW(i)-.05)<1e-6)
 w.dispose();flat.dispose()
})

test('fighting impacts land on open ground ahead of the camera, off the card in the middle, and move every hit',()=>{
 const {look,v,step}=villageWithLook();v.resize(1440,900);look.setWeather('aura')
 // 真新鎮兩棟民宅與研究所的範圍（含屋簷），衝擊點不能落在屋內。
 const buildings=[[-7,-8,3.5,2.5],[7,-8,3.5,2.5],[7,4,4.6,3]]
 const hits=[];let lastAge=Infinity
 for(let i=0;i<180;i++){
  step(i*100,false,.1,.1)
  const {x,y:z,z:age,w}=v.weather.impact
  assert.ok([x,z,age,w].every(Number.isFinite))
  if(w>0&&age<lastAge)hits.push({x,z,w})
  lastAge=w>0?age:Infinity
 }
 assert.ok(hits.length>=4,`hits: ${hits.length}`)
 const cam=v.camera,facing=new Vector3();cam.getWorldDirection(facing)
 const len=Math.hypot(facing.x,facing.z),fx=facing.x/len,fz=facing.z/len
 const halfWidth=Math.tan(cam.fov*Math.PI/360)*cam.aspect
 for(const hit of hits){
  const dx=hit.x-cam.position.x,dz=hit.z-cam.position.z
  const ahead=dx*fx+dz*fz,side=dz*fx-dx*fz
  assert.ok(ahead>8.9&&ahead<20.1,`ahead ${ahead.toFixed(2)}`)
  const offCenter=Math.abs(side)/(ahead*halfWidth)
  assert.ok(offCenter>.29&&offCenter<.76,`off center ${offCenter.toFixed(2)}`)
  assert.ok(!buildings.some(([bx,bz,hx,hz])=>Math.abs(hit.x-bx)<hx&&Math.abs(hit.z-bz)<hz),`inside a building at ${hit.x.toFixed(1)},${hit.z.toFixed(1)}`)
 }
 for(let i=1;i<hits.length;i++)assert.ok(Math.hypot(hits[i].x-hits[i-1].x,hits[i].z-hits[i-1].z)>.01,'each hit lands somewhere new')
 // 減少動態：衝擊強度為 0，地景、看板與後製都略過。
 step(20000,true,.1,0)
 assert.equal(v.weather.impact.w,0)
 v.dispose()
})

test('darkness eyes wait beside trees and buildings above the ground and keep glowing at night',()=>{
 const v=createVillage({lowPower:false})
 const eyes=v.scene.getObjectByName('dark-eyes'),pos=eyes.geometry.attributes.position
 assert.ok(pos.count>20,`eyes: ${pos.count}`)
 for(let i=0;i<pos.count;i++)assert.ok(pos.getY(i)>.5&&pos.getY(i)<1.2,`eye at y=${pos.getY(i)}`)
 const stones=v.scene.getObjectByName('psychic-stones')
 const before={eyes:eyes.material.uniforms.color.value.clone(),stones:stones.material.uniforms.color.value.clone()}
 v.setLook({light:new Color('#9fb4ff'),skyBottom:new Color('#050912'),windows:1})
 assert.ok(eyes.material.uniforms.color.value.equals(before.eyes),'eyes are not dimmed at night')
 assert.ok(stones.material.uniforms.color.value.r<before.stones.r*.5,'other effects still dim at night')
 v.dispose()
})

test('darkness swaps the sun for an eclipse and the moon for a red crescent, other weathers keep their moon',()=>{
 for(const p of periods){
  const s=createSceneLook(p);s.setWeather('mist');s.advance(0,2)
  const l=s.look
  assert.equal(l.moon,0,p.key)
  if(p.moon>0){assert.equal(l.bloodMoon,p.moon,`${p.key}: cloud cover does not hide the red moon`);assert.equal(l.eclipse,1-p.moon)}
  else{assert.equal(l.eclipse,1,p.key);assert.equal(l.bloodMoon,0)}
 }
 // 其他天氣：月亮仍依雲量遮蔽，數值與改版前的公式完全相同；沒有日蝕與紅月。
 for(const key of [...Object.values(weatherByType),null]){
  if(key==='mist')continue
  for(const p of periods){
   const s=createSceneLook(p);s.setWeather(key);s.advance(0,2)
   const cover=(weatherEffects[key]??weatherEffects.clear).cover
   assert.equal(s.look.moon,p.moon*Math.max(.1,1-(cover-1)*.7),`${key} ${p.key}`)
   assert.equal(s.look.eclipse,0);assert.equal(s.look.bloodMoon,0)
  }
 }
})

test('classic look only runs the post pass for heat, psychic warp or fighting weather',()=>{
 const classic=createPostPass({hd2d:false}),hd2d=createPostPass({hd2d:true})
 const off={heat:0,warp:0,quake:0,shakeX:0,shakeY:0}
 assert.equal(classic.active(off),false)
 assert.equal(hd2d.active(off),true)
 for(const field of ['heat','warp','quake'])assert.equal(classic.active({...off,[field]:.5}),true,field)
 classic.dispose();hd2d.dispose()
})

test('psychic aurora shows with the psychic weight even when reduced motion holds the meteors back',()=>{
 const sky=createSkyWeather(),[aurora,meteors]=sky.meshes
 sky.update(3,0,0);assert.equal(aurora.visible,false);assert.equal(meteors.visible,false)
 sky.update(3,0,.6);assert.equal(aurora.visible,true);assert.equal(meteors.visible,false)
 assert.equal(aurora.material.uniforms.opacity.value,.6)
 sky.update(3,1,0);assert.equal(aurora.visible,false);assert.equal(meteors.visible,true)
 sky.dispose()
})
