import test from 'node:test'
import assert from 'node:assert/strict'
import { stat } from 'node:fs/promises'
import { tracks, trackFor, CROSSFADE_MS, LOOP_FADE_MS, STOP_FADE_MS, TITLE_FADE_MS, VOLUME, CREDIT } from '../src/config/bgm.js'
import { periodKeys, TRANSITION_MS } from '../src/config/dayCycle.js'

test('every day-cycle period has its own track, and the file is really in public/audio', async () => {
  for (const key of periodKeys) {
    const track = tracks[key]
    assert.ok(track?.title, `${key} names its track`)
    assert.match(track.src, /^\/audio\/bgm-[a-z]+\.mp3$/, `${key} points into public/audio`)
    const { size } = await stat(new URL(`../public${track.src}`, import.meta.url))
    assert.ok(size > 100_000, `${track.src} is a real audio file`)
  }
  assert.equal(new Set(Object.values(tracks).map(t => t.src)).size, periodKeys.length, 'no two periods share a file')
  assert.equal(trackFor('unknown'), tracks.day, 'an unknown period falls back to the daytime track')
  assert.match(CREDIT, /こんとどぅふぇ/, 'the ticker credits the source site')
})

test('the period crossfade matches the scene light transition, and the loop seam fade stays short', () => {
  assert.equal(CROSSFADE_MS, TRANSITION_MS)
  assert.ok(LOOP_FADE_MS > 0 && LOOP_FADE_MS < 1000)
  assert.ok(STOP_FADE_MS > 0 && STOP_FADE_MS <= CROSSFADE_MS)
  assert.ok(TITLE_FADE_MS * 2 <= CROSSFADE_MS, 'the title fades out and back in within the music crossfade')
  assert.ok(VOLUME > 0 && VOLUME <= 1)
})
