import test from 'node:test'
import assert from 'node:assert/strict'
import { Vector3, Color, Matrix4 } from 'three'
import { sampleFlight, progressFromSections } from '../src/scene/journey.js'
import { createVillage } from '../src/scene/village.js'

 test('flight moves north continuously, stays above roofs and looks nearly level', () => {
  let previous = sampleFlight(0).position.clone()
  for (let i = 1; i <= 1000; i++) {
    const { position, target } = sampleFlight(i / 1000)
    assert.ok(position.z < previous.z)
    assert.ok(position.distanceTo(previous) < 0.3)
    assert.ok(position.y >= 5.9 && position.y <= 8.1)
    const direction = target.clone().sub(position)
    assert.ok(Math.abs(Math.atan2(direction.y, Math.hypot(direction.x, direction.z))) < 0.11)
    previous.copy(position)
  }
  assert.equal(sampleFlight(0).position.z, 27)
  assert.equal(sampleFlight(1).position.z, -143)
  let north = sampleFlight(1).position.z
  for (let i = 99; i >= 0; i--) {
    const z = sampleFlight(i / 100).position.z
    assert.ok(z > north)
    north = z
  }
 })

 test('scroll boundaries, search, and distant lazy sections', () => {
  const sections = [{top: 800}, {top: 1800}, {top: 2800}, {top: 3800}]
  assert.equal(progressFromSections(0, 800, 5000, sections), 0)
  assert.equal(progressFromSections(4200, 800, 5000, sections), 1)
  assert.equal(progressFromSections(500, 800, 1600, []), null)
  const before = progressFromSections(1100, 800, 5000, sections)
  const after = progressFromSections(1100, 800, 7000, [...sections.slice(0, 2), {top:4800}, {top:5800}])
  assert.equal(before, after)
  let previous = 0
  for (let y = 0; y <= 4200; y += 5) {
    const progress = progressFromSections(y, 800, 5000, sections)
    assert.ok(progress >= previous && progress <= 1)
    previous = progress
  }
 })

 test('desktop and mobile geometry, camera direction and reduced motion', () => {
  for (const lowPower of [false, true]) {
    const village = createVillage({lowPower})
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      village.resize(w, h)
      for (const progress of [0, 0.25, 0.5, 0.8, 1]) {
        village.update({x: 0, y: 0}, 1000, false, progress)
        assert.ok(village.camera.isPerspectiveCamera)
        assert.ok(village.camera.getWorldDirection(new Vector3()).z < -0.9)
        assert.ok(village.camera.projectionMatrix.elements.every(Number.isFinite))
      }
      village.update({x: 1, y: -1}, 1000, true, 1)
      assert.deepEqual(village.camera.position.toArray(), [0, 7.5, 27])
    }
    village.setLook({light: new Color('#9fb4ff'), skyBottom: new Color('#050912'), windows: 1})
    assert.equal(village.scene.fog.color.getHexString(), '050912')
    let meshes = 0
    village.scene.traverse(object => {
      if (!object.isMesh) return
      meshes++
      assert.ok(object.geometry.attributes.position.array.every(Number.isFinite))
    })
    assert.ok(meshes < 100, `batched draw objects: ${meshes}`)
    village.dispose()
  }
 })

 test('clouds keep world positions while the flight camera changes their apparent position and size', () => {
  const village = createVillage()
  const clouds = village.scene.getObjectByName('world-clouds')
  assert.ok(clouds?.isInstancedMesh)
  village.resize(1440, 900)
  // Project the actual first cloud puff through the same camera used for the terrain.
  const matrix = new Matrix4()
  clouds.getMatrixAt(0, matrix)
  const point = new Vector3().setFromMatrixPosition(matrix)
  const project = progress => {
    village.update({x:0, y:0}, 0, false, progress, 0)
    village.camera.updateMatrixWorld(true)
    return point.clone().project(village.camera)
  }
  const start = project(0)
  const forward = project(0.1)
  assert.ok(start.distanceTo(forward) > 0.05, 'cloud must not stay attached to screen coordinates')
  assert.ok(project(0).distanceTo(start) < 1e-9, 'reverse flight restores the same perspective')
  const initial = clouds.position.clone()
  for (let i=0; i<60; i++) village.update({x:0,y:0}, i*16.7, false, 0, 1/60)
  const drift = clouds.position.distanceTo(initial)
  assert.ok(drift > 0 && drift < 0.06, 'wind must be slow and independent of scroll')
  const still = clouds.position.clone()
  village.update({x:0,y:0}, 2000, true, 1, 0.1)
  assert.deepEqual(clouds.position, still, 'reduced motion stops cloud drift')
  village.dispose()
 })
