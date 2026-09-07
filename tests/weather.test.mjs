import test from 'node:test'
import assert from 'node:assert/strict'
import { Color } from 'three'
import { weatherKeyFor, weatherByType } from '../src/config/weather.js'
import { createWeatherState, weatherLook } from '../src/scene/weather-state.js'
import { createVillage } from '../src/scene/village.js'
import { periods } from '../src/config/dayCycle.js'

test('first type, unknown and absent types resolve explicitly',()=>{
 assert.equal(weatherKeyFor({types:['Fire','Water']}),'embers')
 assert.equal(weatherKeyFor({types:'Water,Fire'}),'rain')
 for(const card of [null,{}, {types:[]},{types:['Unknown']}]) assert.equal(weatherKeyFor(card),null)
 assert.equal(new Set(Object.values(weatherByType)).size,11)
})
test('two second transition starts at current mix, interrupts without jump and returns to baseline',()=>{
 const s=createWeatherState();s.select('rain');s.update(1)
 assert.equal(s.weights.rain,.5);s.select('embers');s.update(0);assert.equal(s.weights.rain,.5)
 s.update(2);assert.equal(s.weights.embers,1);assert.equal(s.weights.rain,0)
 s.update(20);assert.equal(s.key,'embers')
 s.select(null);s.update(2);assert.equal(s.weights.clear,1)
 assert.equal(createWeatherState().key,null)
 s.select('orbs');s.update(0,true);assert.equal(s.weights.orbs,1)
})
test('all weather profiles preserve day/night identity and finite lighting',()=>{
 for(const key of Object.values(weatherByType)){
  const s=createWeatherState();s.select(key);s.update(2);let day,night
  for(const p of periods){
   const base={skyTop:new Color(p.sky[0]),skyBottom:new Color(p.sky[1]),light:new Color(p.light).multiplyScalar(p.intensity),windows:p.windows,stars:p.stars,moon:p.moon}
   const look=weatherLook(base,s.environment());assert.equal(look.windows,p.windows)
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
  const v=createVillage({lowPower});v.resize(1440,900)
  if(!lowPower)desktopCount=v.weather.count;else assert.ok(v.weather.count<desktopCount*.6)
  const rain=v.scene.getObjectByName('rain'),pos=rain.geometry.attributes.position,seeds=rain.geometry.attributes.seed
  let roofDrops=0
  for(let i=0;i<pos.count;i++){
   if(seeds.getW(i)>3)roofDrops++
   if(Math.abs(pos.getX(i)+7)<2&&Math.abs(pos.getZ(i)+8)<1.5)assert.ok(seeds.getW(i)>3)
  }
  assert.ok(roofDrops>0)
  for(const key of Object.values(weatherByType)){
   v.weather.set(key)
   for(let i=0;i<21;i++)v.update({x:0,y:0},i*100,false,.5,.1)
   assert.equal(v.weather.activeKey,key)
   v.weather.group.traverse(o=>{if(o.material){assert.notEqual(o.material.depthTest,false);assert.equal(o.material.depthWrite,false)}})
   v.update({x:0,y:0},2200,true,.5,0)
   for(const o of v.weather.group.children)if(o.isPoints&&!['mist','psychic-fog'].includes(o.name))assert.equal(o.visible,false,o.name)
  }
  v.dispose()
 }
})

test('lightning becomes visible soon, has branched triangles, repeats and stops in reduced mode',()=>{
 const v=createVillage();v.weather.set('sparks');let strikes=0,wasVisible=false
 for(let i=0;i<120;i++){
  v.update({x:0,y:0},i*100,false,0,.1)
  const bolt=v.scene.getObjectByName('cloud-lightning')
  if(bolt.visible&&!wasVisible){strikes++;assert.ok(bolt.geometry.attributes.position.count>=66);assert.ok(bolt.geometry.attributes.position.array.every(Number.isFinite))}
  wasVisible=bolt.visible
  if(i===40)assert.ok(strikes>=1,'first flash appears within four seconds of selecting weather')
 }
 assert.ok(strikes>=2)
 v.update({x:0,y:0},12000,true,0,0)
 assert.equal(v.scene.getObjectByName('cloud-lightning').visible,false)
 v.dispose()
})
