import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mapSetId,
  mapNumber,
  mapRarity,
  mapSubtypes,
  toCard,
  sortCards,
  buildQuery,
  parseResponse,
  FOIL_TYPES,
  foilType
} from '../src/config/tcgdex.js'

// 樣本取自 TCGdex 實際回應，期望值取自凍結區 public/data/cards.json（pokemontcg.io 格式）
const pikachuGold = {
  id: 'swsh12.5-160',
  localId: '160',
  name: 'Pikachu',
  image: 'https://assets.tcgdex.net/en/swsh/swsh12.5/160',
  rarity: 'Secret Rare',
  category: 'Pokemon',
  stage: 'Basic',
  suffix: null,
  trainerType: null,
  energyType: null,
  types: ['Lightning'],
  set: { id: 'swsh12.5' }
}

test('set ids and numbers follow pokemontcg.io conventions', () => {
  assert.equal(mapSetId('swsh12.5'), 'swsh12pt5')
  assert.equal(mapSetId('swsh4.5sv'), 'swsh45sv')
  assert.equal(mapSetId('swsh10.5'), 'pgo')
  assert.equal(mapSetId('swsh9tg'), 'swsh9tg')
  assert.equal(mapSetId('2021swsh'), null)
  assert.equal(mapNumber('027'), '27')
  assert.equal(mapNumber('TG01'), 'TG01')
  assert.equal(mapNumber('SV001'), 'SV001')
  assert.equal(mapNumber('SWSH076'), 'SWSH076')
})

test('rarity maps to the vocabulary the frozen CSS and CardProxy expect', () => {
  const r = (patch, set = 'swsh12pt5') => mapRarity({ ...pikachuGold, ...patch }, set)
  assert.equal(r({ rarity: 'Holo Rare' }), 'Rare Holo')
  assert.equal(r({ rarity: 'Holo Rare V', suffix: 'V' }), 'Rare Holo V')
  // TCGdex 標錯時以 stage 為準
  assert.equal(r({ rarity: 'Holo Rare VMAX', stage: 'VSTAR', suffix: 'V' }), 'Rare Holo VSTAR')
  assert.equal(r({ rarity: 'Ultra Rare', suffix: 'V' }), 'Rare Ultra')
  assert.equal(r({ rarity: 'Full Art Trainer', category: 'Trainer', stage: null }), 'Rare Ultra')
  // 秘稀：V 系列與支援者是彩虹，其餘金卡
  assert.equal(r({}), 'Rare Secret')
  assert.equal(r({ stage: 'VMAX' }), 'Rare Rainbow')
  assert.equal(r({ category: 'Trainer', stage: null, trainerType: 'Supporter' }), 'Rare Rainbow')
  assert.equal(r({ category: 'Trainer', stage: null, trainerType: 'Item' }), 'Rare Secret')
  assert.equal(r({ category: 'Energy', stage: null }), 'Rare Secret')
  // 畫廊集
  assert.equal(r({ rarity: 'Rare' }, 'swsh9tg'), 'Trainer Gallery Rare Holo')
  assert.equal(r({ rarity: 'Holo Rare' }, 'swsh12tg'), 'Trainer Gallery Rare Holo')
  assert.equal(r({ rarity: 'Ultra Rare', suffix: 'V' }, 'swsh9tg'), 'Rare Holo V')
  assert.equal(r({ rarity: 'Ultra Rare', stage: 'VMAX' }, 'swsh9tg'), 'Rare Holo VMAX')
  assert.equal(r({ rarity: 'Ultra Rare', category: 'Trainer', stage: null }, 'swsh12.5gg'), 'Rare Ultra')
  assert.equal(r({ rarity: 'Secret Rare', stage: 'VSTAR', suffix: 'V' }, 'swsh11tg'), 'Rare Secret')
  // Shiny Vault
  assert.equal(r({ rarity: 'Shiny rare' }, 'swsh45sv'), 'Rare Shiny')
  assert.equal(r({ rarity: 'Shiny rare V', suffix: 'V' }, 'swsh45sv'), 'Rare Holo V')
  assert.equal(r({ rarity: 'Shiny rare VMAX', stage: 'VMAX' }, 'swsh45sv'), 'Rare Holo VMAX')
  assert.equal(r({ rarity: 'Promo' }, 'swshp'), 'Promo')
  assert.equal(r({ rarity: 'None' }), 'Common')
})

test('subtypes are rebuilt from stage, suffix, trainerType and energyType', () => {
  const s = (patch) => mapSubtypes({ ...pikachuGold, ...patch })
  assert.deepEqual(s({}), ['Basic'])
  assert.deepEqual(s({ stage: 'Stage1' }), ['Stage 1'])
  assert.deepEqual(s({ stage: 'Basic', suffix: 'V' }), ['Basic', 'V'])
  assert.deepEqual(s({ stage: 'VMAX' }), ['VMAX'])
  assert.deepEqual(s({ stage: 'VSTAR', suffix: 'V' }), ['VSTAR'])
  assert.deepEqual(s({ stage: 'V-UNION', suffix: 'V' }), ['V-UNION'])
  assert.deepEqual(s({ name: 'Radiant Charizard' }), ['Basic', 'Radiant'])
  assert.deepEqual(s({ category: 'Trainer', stage: null, trainerType: 'Supporter' }), ['Supporter'])
  assert.deepEqual(s({ category: 'Trainer', stage: null, trainerType: 'Tool' }), ['Pokémon Tool'])
  assert.deepEqual(s({ category: 'Energy', stage: null, energyType: 'Special' }), ['Special'])
})

test('toCard produces pokemontcg.io shaped cards and falls back to pokemontcg.io images', () => {
  const card = toCard(pikachuGold)
  assert.equal(card.id, 'swsh12pt5-160')
  assert.equal(card.set, 'swsh12pt5')
  assert.equal(card.number, '160')
  assert.equal(card.supertype, 'Pokémon')
  assert.equal(card.rarity, 'Rare Secret')
  assert.equal(card.images.large, 'https://assets.tcgdex.net/en/swsh/swsh12.5/160/high.webp')
  assert.equal(card.images.small, 'https://assets.tcgdex.net/en/swsh/swsh12.5/160/low.webp')

  const tg = toCard({
    ...pikachuGold,
    id: 'swsh11tg-TG03',
    localId: 'TG03',
    image: null,
    rarity: 'Rare',
    set: { id: 'swsh11tg' }
  })
  assert.equal(tg.id, 'swsh11tg-TG03')
  assert.equal(tg.rarity, 'Trainer Gallery Rare Holo')
  assert.equal(tg.images.large, 'https://images.pokemontcg.io/swsh11tg/TG03_hires.png')

  assert.equal(toCard({ ...pikachuGold, set: { id: '2021swsh' } }), null)
})

test('results sort newest set first, then highest number, promos last', () => {
  const list = [
    { id: 'a', set: 'swsh1', number: '9' },
    { id: 'b', set: 'swshp', number: 'SWSH286' },
    { id: 'c', set: 'swsh12pt5', number: '27' },
    { id: 'd', set: 'swsh12pt5', number: '160' },
    { id: 'e', set: 'pgo', number: '31' }
  ]
  assert.deepEqual(
    sortCards(list).map((c) => c.id),
    ['d', 'c', 'e', 'a', 'b']
  )
})

test('buildQuery emits one aliased block per name and escapes quotes', () => {
  const q = buildQuery(["Farfetch'd", 'Mr. Mime'], [{}], 36)
  assert.match(q, /q0: cards\(filters: \{ name: "Farfetch'd", id: "swsh" \}, pagination: \{ page: 1, count: 36 \}\)/)
  assert.match(q, /q1: cards\(filters: \{ name: "Mr\. Mime"/)
})

test('buildQuery crosses names with foil type blocks, or uses blocks alone', () => {
  const rainbow = foilType('rainbow')
  const q = buildQuery([], rainbow.blocks)
  assert.match(q, /q0: cards\(filters: \{ id: "swsh", rarity: "Secret Rare", suffix: "V" \}/)
  assert.match(q, /q2: cards\(filters: \{ id: "swsh", rarity: "Secret Rare", trainerType: "Supporter" \}/)
  assert.doesNotMatch(q, /q3:/)
  const gallery = foilType('gallery-holo')
  assert.match(buildQuery(['Pikachu'], gallery.blocks), /q1: cards\(filters: \{ name: "Pikachu", id: "gg", rarity: "Rare" \}/)
})

test('foil type tests pick the right converted cards', () => {
  const ctx = { alt: new Set(['swsh8-245']), cosmos: new Set(['swshp-SWSH012']) }
  const card = (patch) => ({ ...toCard(pikachuGold), ...patch })
  const pass = (id, patch) => foilType(id).test(card(patch), ctx)
  assert.ok(pass('gold', {}))
  assert.ok(!pass('rainbow', {}))
  assert.ok(pass('rainbow', { rarity: 'Rare Rainbow' }))
  assert.ok(pass('v', { rarity: 'Rare Holo V', subtypes: ['Basic', 'V'] }))
  assert.ok(!pass('v', { rarity: 'Rare Holo V', set: 'swsh45sv' }))
  assert.ok(pass('shiny-vault', { rarity: 'Rare Holo V', set: 'swsh45sv' }))
  assert.ok(pass('gallery-v', { rarity: 'Rare Holo VMAX', set: 'swsh9tg' }))
  assert.ok(!pass('vmax', { rarity: 'Rare Holo VMAX', set: 'swsh9tg' }))
  assert.ok(pass('trainer-full-art', { rarity: 'Rare Ultra', supertype: 'Trainer' }))
  assert.ok(pass('v-full-art', { rarity: 'Rare Ultra', subtypes: ['Basic', 'V'] }))
  assert.ok(!pass('v-full-art', { id: 'swsh8-245', rarity: 'Rare Ultra', subtypes: ['Basic', 'V'] }))
  assert.ok(pass('v-alt-art', { id: 'swsh8-245', rarity: 'Rare Ultra', subtypes: ['Basic', 'V'] }))
  assert.ok(pass('vmax-alt', { id: 'swsh8-245', rarity: 'Rare Rainbow', subtypes: ['VMAX'] }))
  assert.ok(!pass('rainbow', { id: 'swsh8-245', rarity: 'Rare Rainbow', subtypes: ['VMAX'] }))
  assert.ok(pass('cosmos', { id: 'swshp-SWSH012', rarity: 'Promo' }))
  assert.ok(!pass('cosmos', { id: 'swshp-SWSH013', rarity: 'Promo' }))
  assert.deepEqual(foilType('cosmos').byId(ctx), ['swshp-SWSH012'])
  assert.ok(pass('common', { rarity: 'Common' }))
  assert.equal(FOIL_TYPES.length, 18)
  assert.ok(FOIL_TYPES.every((t) => t.id && t.name && (t.blocks?.length || t.byId) && typeof t.test === 'function'))
  assert.equal(foilType('nope'), null)
})

test('buildQuery with ids emits card(id) aliases and parseResponse accepts single objects', () => {
  const q = buildQuery(['Pikachu'], [{}], 100, ['swshp-SWSH012', 'swshp-SWSH127'])
  assert.match(q, /q0: card\(id: "swshp-SWSH012"\)/)
  assert.match(q, /q1: card\(id: "swshp-SWSH127"\)/)
  assert.doesNotMatch(q, /Pikachu/)
  const out = parseResponse({ q0: { ...pikachuGold, id: 'swshp-SWSH012', localId: 'SWSH012', rarity: 'Promo', set: { id: 'swshp' } }, q1: null })
  assert.deepEqual(out.map((c) => c.id), ['swshp-SWSH012'])
})

test('parseResponse merges aliases, drops duplicates and unsupported sets', () => {
  const out = parseResponse({
    q0: [pikachuGold, { ...pikachuGold, set: { id: '2021swsh' } }],
    q1: [pikachuGold, { ...pikachuGold, id: 'swsh1-25', localId: '25', rarity: 'Common', set: { id: 'swsh1' } }]
  })
  assert.deepEqual(
    out.map((c) => c.id),
    ['swsh12pt5-160', 'swsh1-25']
  )
})
