import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { compileModule } from 'svelte/compiler'
import { flush as flushSync } from 'svelte/internal/client'

test('all four manual periods remain reachable alongside auto at every local period', async t => {
  const source = await readFile(new URL('../src/stores/dayCycle.svelte.js', import.meta.url), 'utf8')
  const compiled = compileModule(source, { filename: 'dayCycle.svelte.js', generate: 'client' }).js.code
    .replaceAll('svelte/internal/client', import.meta.resolve('svelte/internal/client'))
    .replaceAll('../config/dayCycle.js', new URL('../src/config/dayCycle.js', import.meta.url).href)
  const storage = new Map()
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  t.after(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
    else delete globalThis.document
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
    else delete globalThis.localStorage
  })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    documentElement: { dataset: {} }, addEventListener() {}, hidden: false
  } })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key)
  } })
  t.mock.method(globalThis, 'setInterval', () => 0)
  let hour = 6
  t.mock.method(Date.prototype, 'getHours', () => hour)
  t.mock.method(Date.prototype, 'getMinutes', () => 0)
  for (const [localHour, autoKey] of [[6, 'dawn'], [12, 'day'], [18, 'dusk'], [22, 'night']]) {
    hour = localHour
    storage.clear()
    const { dayCycle } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}#${hour}`)
    flushSync()
    assert.equal(dayCycle.isAuto, true)
    assert.equal(dayCycle.key, autoKey)
    for (const expected of ['dawn', 'day', 'dusk', 'night', null]) {
      dayCycle.cycle()
      flushSync()
      assert.equal(dayCycle.isAuto, expected === null, `auto state at ${hour}:00, selecting ${expected}`)
      assert.equal(dayCycle.key, expected ?? autoKey, `period at ${hour}:00`)
      assert.equal(storage.get('dayCycle.override') ?? null, expected)
      assert.equal(document.documentElement.dataset.daycycle, expected ?? autoKey)
    }
  }
})
