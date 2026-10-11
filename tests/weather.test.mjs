import test from 'node:test'
import assert from 'node:assert/strict'
import { Scene } from 'three'
import { weatherKeyFor, weatherByType } from '../src/config/weather.js'
import { createSceneLook } from '../src/scene/look.js'
import { createVillage } from '../src/scene/village.js'
import { createWeather } from '../src/scene/weather.js'
import { terrainAt, groundAt } from '../src/scene/terrain.js'
import { periods, periodByKey } from '../src/config/dayCycle.js'

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
   for(const o of v.weather.group.children)if(o.isPoints&&!['mist','psychic-fog','rain-mist'].includes(o.name))assert.equal(o.visible,false,o.name)
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
 const names=['leaf-glow','flames','rain-splash','rain-drops','puddles','psychic-rings','aura-dust','dark-shadows','fairy-rings','dragon-scales']
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
 for(const name of ['puddles','flames','embers','aura-dust','mist']){
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
