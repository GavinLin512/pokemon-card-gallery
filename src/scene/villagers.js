import { Group, Scene, Sprite, SpriteMaterial, CanvasTexture, LinearFilter, SRGBColorSpace, Vector3, CircleGeometry, InstancedMesh, MeshBasicMaterial, Matrix4 } from 'three'
import { drawBubble } from './pixel-art.js'
import { drawVillagerAtlas, VILLAGER_VARIANTS, VILLAGER_FRAME } from './villager-art.js'
import { createBillboards } from './billboards.js'
import { walkNodes, walkNeighbors } from './walkways.js'
import { createRouteNav, MOVE } from './route-nav.js'
import { VILLAGER_COUNTS, VILLAGER_COUNTS_LOW, VILLAGER_SPEED, CHAT_LINE_SECONDS, chatLines } from '../config/villagers.js'

const WIDTH = 1.1, HEIGHT = 1.65
/** 每跨一步的距離；走路動畫依實際移動距離推進，快慢一致。 */
const STRIDE = 0.3
const WALK = {
  front: ['frontL', 'front', 'frontR', 'front'],
  back: ['backL', 'back', 'backR', 'back'],
  side: ['sideStride', 'side', 'sideStride', 'side']
}
/** 超過此距離的對話框不顯示，避免遠處的小人頭上浮著大字。 */
const BUBBLE_RANGE = 34
/** 視線深度 8 以內完全隱去、13 以外完整顯示；鏡頭飛過頭頂時不會出現巨大人物。 */
const NEAR_FADE = [8, 13]
/** 從擋土牆跳下：滯空秒數與弧線高度。 */
const JUMP = { seconds: .42, lift: .35 }
const pick = list => list[Math.floor(Math.random() * list.length)]

/**
 * 村民：隨機走動、停下張望，同區兩人相遇時有機會停下聊天。heightAt 提供含階梯的地面高度。
 * 真新鎮與常磐市沿路網走；一號道路依原作的格子邏輯在路面與草地間自由走動，擋土牆與土坡只能往下跳。
 * 人物與影子畫在村莊場景；對話框放在 overlay，於後製之後繪製，不受移軸模糊影響。
 */
export function createVillagers({ lowPower = false, heightAt = () => 0 } = {}) {
  const counts = lowPower ? VILLAGER_COUNTS_LOW : VILLAGER_COUNTS
  const nav = createRouteNav()
  const people = []
  for (const [region, count] of Object.entries(counts)) {
    const pool = walkNodes.flatMap((node, i) => (node.region === region && walkNeighbors[i].length ? [i] : []))
    for (let k = 0; k < count; k++) {
      const person = {
        region, variant: people.length % VILLAGER_VARIANTS,
        speed: VILLAGER_SPEED[0] + Math.random() * (VILLAGER_SPEED[1] - VILLAGER_SPEED[0]),
        state: 'walk', timer: 0, dirX: 0, dirZ: 1, phase: Math.random() * 4, cooldown: 3 + Math.random() * 8, jump: null
      }
      if (region === 'route') {
        // 一號道路：隨機站在任一可走的格子，稍停後出發。
        Object.assign(person, nav.center(pick(nav.cells)), { steps: [], state: 'idle', timer: Math.random() * 2 })
      } else {
        // 散佈在路段中間，一開始就在走，不會全部擠在節點上。
        const from = pick(pool), to = pick(walkNeighbors[from]), t = Math.random()
        Object.assign(person, {
          node: from, target: to,
          x: walkNodes[from].x + (walkNodes[to].x - walkNodes[from].x) * t,
          z: walkNodes[from].z + (walkNodes[to].z - walkNodes[from].z) * t
        })
      }
      people.push(person)
    }
  }

  const group = new Group()
  const sprites = createBillboards({ canvas: drawVillagerAtlas(), columns: Object.keys(VILLAGER_FRAME).length, rows: VILLAGER_VARIANTS, count: people.length, width: WIDTH, height: HEIGHT, nearFade: NEAR_FADE })
  group.add(sprites.mesh)
  const shadowGeometry = new CircleGeometry(0.4, 12).rotateX(-Math.PI / 2)
  const shadowMaterial = new MeshBasicMaterial({ color: '#1b2a22', transparent: true, opacity: 0.28, depthWrite: false })
  const shadows = new InstancedMesh(shadowGeometry, shadowMaterial, people.length)
  shadows.frustumCulled = false
  group.add(shadows)

  const overlay = new Scene()
  const bubbleTextures = new Map()
  const conversations = []
  let night = false
  let screenScale = 0.001
  let pixelScale = 2
  /** 每個對話框像素佔的裝置像素數；貼圖與螢幕一比一，文字才銳利。 */
  let unit = 2
  let viewWidth = 1

  function bubbleFor(text, tailRight) {
    const key = `${tailRight ? 'R' : 'L'}${text}`
    if (!bubbleTextures.has(key)) {
      const { canvas, tailX } = drawBubble(text, unit, tailRight)
      const texture = new CanvasTexture(canvas)
      texture.colorSpace = SRGBColorSpace
      texture.magFilter = texture.minFilter = LinearFilter
      texture.generateMipmaps = false
      bubbleTextures.set(key, { texture, tailX, width: canvas.width / unit, height: canvas.height / unit })
    }
    return bubbleTextures.get(key)
  }

  function nextTarget(p) {
    const options = walkNeighbors[p.target]
    const onward = options.filter(n => n !== p.node) // 盡量不立刻折返
    p.node = p.target
    p.target = pick(onward.length ? onward : options)
  }

  function face(p, x, z) {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz) || 1
    p.dirX = dx / d
    p.dirZ = dz / d
  }

  /** 停下一會兒，偶爾轉頭張望。 */
  function pause(p, seconds = 1 + Math.random() * 2.5) {
    p.state = 'idle'
    p.timer = seconds
    if (Math.random() < 0.5) { const a = Math.floor(Math.random() * 4) * Math.PI / 2; p.dirX = Math.cos(a); p.dirZ = Math.sin(a) }
  }

  /** 往 (x, z) 走一步；到達時回傳 true。 */
  function walkTo(p, x, z, dt) {
    const dist = Math.hypot(x - p.x, z - p.z), move = p.speed * dt
    p.phase += Math.min(dist, move) / STRIDE
    if (dist <= move) { p.x = x; p.z = z; return true }
    face(p, x, z)
    p.x += p.dirX * move
    p.z += p.dirZ * move
    return false
  }

  /** 真新鎮與常磐市：沿路網走，到節點時有機會停下。 */
  function follow(p, dt) {
    const target = walkNodes[p.target]
    if (!walkTo(p, target.x, target.z, dt)) return
    nextTarget(p)
    if (Math.random() < 0.3) pause(p)
  }

  /** 一號道路：依格網路點走，遇到擋土牆時跳下；走完一段就停下，再挑下一個目的地。 */
  function roam(p, dt) {
    const j = p.jump
    if (j) {
      j.t = Math.min(1, j.t + dt / j.seconds)
      p.x = j.x0 + (j.x1 - j.x0) * j.t
      p.z = j.z0 + (j.z1 - j.z0) * j.t
      if (j.t >= 1) p.jump = null
      return
    }
    const next = p.steps[0]
    if (!next) { pause(p, 1.5 + Math.random() * 3.5); return }
    if (next.kind === MOVE.walk) {
      if (walkTo(p, next.x, next.z, dt)) p.steps.shift()
      return
    }
    face(p, next.x, next.z)
    p.jump = { ...JUMP, x0: p.x, z0: p.z, x1: next.x, z1: next.z, h0: heightAt(p.x, p.z), h1: heightAt(next.x, next.z), t: 0 }
    p.steps.shift()
  }

  function step(p, dt) {
    p.cooldown -= dt
    if (p.state === 'idle') {
      p.timer -= dt
      if (p.timer > 0) return
      p.state = 'walk'
      if (p.steps && !p.steps.length) p.steps = nav.wander(nav.cellAt(p.x, p.z))
    } else if (p.state === 'walk') {
      if (p.steps) roam(p, dt)
      else follow(p, dt)
    }
  }

  /** 人物腳底高度：跳躍時沿拋物線，其餘貼著地面。 */
  function heightOf(p) {
    const j = p.jump
    if (!j) return heightAt(p.x, p.z)
    return j.h0 + (j.h1 - j.h0) * j.t + 4 * j.t * (1 - j.t) * j.lift
  }

  function startChats() {
    for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {
      const a = people[i], b = people[j]
      if (a.region !== b.region || a.state === 'chat' || b.state === 'chat' || a.cooldown > 0 || b.cooldown > 0 || a.jump || b.jump) continue
      const d = Math.hypot(a.x - b.x, a.z - b.z)
      // 隔著擋土牆一高一低的兩人不會搭話。
      if (d > 1.9 || d < 0.7 || Math.abs(heightAt(a.x, a.z) - heightAt(b.x, b.z)) > .3) continue
      if (Math.random() > 0.45) { a.cooldown = b.cooldown = 3; continue } // 擦身而過
      const { lines } = pick(chatLines.filter(c => c.when === 'any' || c.when === (night ? 'night' : 'day')))
      a.state = b.state = 'chat'
      face(a, b.x, b.z)
      face(b, a.x, a.z)
      const material = new SpriteMaterial({ depthTest: false, depthWrite: false, sizeAttenuation: false })
      const sprite = new Sprite(material)
      overlay.add(sprite)
      conversations.push({ a, b, lines, elapsed: 0, sprite })
    }
  }

  function updateConversations(dt, camera) {
    for (let i = conversations.length - 1; i >= 0; i--) {
      const talk = conversations[i]
      talk.elapsed += dt
      const index = Math.floor(talk.elapsed / CHAT_LINE_SECONDS)
      if (index >= talk.lines.length) {
        for (const p of [talk.a, talk.b]) { p.state = 'walk'; p.cooldown = 18 + Math.random() * 20 }
        overlay.remove(talk.sprite)
        talk.sprite.material.dispose()
        conversations.splice(i, 1)
        continue
      }
      const speaker = index % 2 ? talk.b : talk.a
      const { sprite } = talk
      sprite.position.set(speaker.x, heightAt(speaker.x, speaker.z) + HEIGHT + 0.15, speaker.z)
      // 說話者靠近右緣時改用右側尾巴，對話框往左長，不會超出畫面。
      const left = bubbleFor(talk.lines[index], false)
      const headX = projected.copy(sprite.position).project(camera).x
      const bubble = headX + left.width * pixelScale * 2 / viewWidth > 0.97 ? bubbleFor(talk.lines[index], true) : left
      if (sprite.material.map !== bubble.texture) {
        sprite.material.map = bubble.texture
        sprite.material.needsUpdate = true
      }
      sprite.center.set(bubble.tailX / bubble.width, 0)
      sprite.scale.set(bubble.width * pixelScale * screenScale, bubble.height * pixelScale * screenScale, 1)
      // 換句之間留一小段空白，看得出是另一人接話。
      const gap = talk.elapsed % CHAT_LINE_SECONDS > CHAT_LINE_SECONDS - 0.25
      sprite.visible = !gap && camera.position.distanceTo(sprite.position) < BUBBLE_RANGE
    }
  }

  const forward = new Vector3()
  const projected = new Vector3()
  const matrix = new Matrix4()
  return {
    group,
    overlay,
    update(dt, camera, reduced) {
      if (!reduced) {
        for (const p of people) step(p, dt)
        startChats()
      }
      updateConversations(reduced ? 0 : dt, camera)
      for (const talk of conversations) talk.sprite.visible &&= !reduced
      camera.getWorldDirection(forward)
      const fx = forward.x, fz = forward.z, rx = -fz, rz = fx
      people.forEach((p, i) => {
        const along = p.dirX * fx + p.dirZ * fz, across = p.dirX * rx + p.dirZ * rz
        const walking = p.state === 'walk' && !reduced
        // 跳躍時固定跨步姿勢。
        const beat = p.jump ? 0 : Math.floor(p.phase) % 4
        let frame, flip = false
        if (Math.abs(along) >= Math.abs(across)) {
          const facing = along > 0 ? 'back' : 'front'
          frame = walking ? WALK[facing][beat] : facing
        } else {
          frame = walking ? WALK.side[beat] : 'side'
          flip = across < 0
        }
        // 地面高度含台地與階梯，走上樓梯時連續升降；影子留在地面，跳躍時看得出離地。
        const ground = heightAt(p.x, p.z)
        sprites.set(i, p.x, heightOf(p), p.z, VILLAGER_FRAME[frame], p.variant, flip)
        matrix.makeScale(1, 1, 0.6).setPosition(p.x, ground + 0.07, p.z)
        shadows.setMatrixAt(i, matrix)
      })
      sprites.commit()
      shadows.instanceMatrix.needsUpdate = true
    },
    /** 對話框維持固定螢幕大小：窄螢幕每個像素一個 CSS px，其餘兩個。 */
    resize(width, height, camera) {
      screenScale = 2 * Math.tan(camera.fov * Math.PI / 360) / height
      pixelScale = width < 600 ? 1 : 2
      viewWidth = width
      const nextUnit = Math.max(1, Math.round(pixelScale * Math.min(window.devicePixelRatio || 1, 3)))
      if (nextUnit !== unit) {
        unit = nextUnit
        bubbleTextures.forEach(b => b.texture.dispose())
        bubbleTextures.clear()
      }
    },
    /** 測試與除錯用 */
    get people() {
      return people
    },
    get conversations() {
      return conversations
    },
    /** floor 是夜晚的最低亮度（見 billboards.js 的 setFloor）；isNight 決定聊天用的句子。 */
    setLook(floor, isNight) {
      sprites.setFloor(floor)
      night = isNight
    },
    dispose() {
      sprites.dispose()
      shadowGeometry.dispose()
      shadowMaterial.dispose()
      shadows.dispose()
      conversations.forEach(talk => talk.sprite.material.dispose())
      bubbleTextures.forEach(b => b.texture.dispose())
      overlay.clear()
    }
  }
}
