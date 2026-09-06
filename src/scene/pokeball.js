// 精靈球捕捉動畫（PLAN §9.1）。
// 與 PLAN 原設計不同，這裡用 DOM + Web Animations API 而非 three.js：
// 場景 canvas 在頁面底下，若在場景裡畫精靈球會被放大的卡牌遮住；DOM 元素可以疊在卡牌之上。
// 時間軸：拋物線飛行 600ms → 吸入放大縮小 400ms → 晃動三下各 350ms → 閃星 800ms。

const FLIGHT_MS = 600
const ABSORB_MS = 400
const SHAKE_MS = 350
const SHAKES = 3
const STARS_MS = 800
const STAR_COUNT = 12

const POKEBALL_SVG = `
<svg viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="29" fill="#fff" stroke="#2b2f36" stroke-width="4"/>
  <path d="M3 32a29 29 0 0 1 58 0z" fill="#e63946"/>
  <path d="M3 32h58" stroke="#2b2f36" stroke-width="5"/>
  <circle cx="32" cy="32" r="9" fill="#fff" stroke="#2b2f36" stroke-width="5"/>
  <circle cx="32" cy="32" r="4" fill="#2b2f36"/>
</svg>`

let assetChecked = false
let assetOk = false
function ballMarkup() {
  return assetOk ? `<img src="/town/pokeball.png" alt="" />` : POKEBALL_SVG
}
/** 檢查是否有使用者提供的精靈球素材（只查一次，避免每次 404） */
export function preloadPokeballAsset() {
  if (assetChecked) return
  assetChecked = true
  const img = new Image()
  img.onload = () => (assetOk = true)
  img.src = '/town/pokeball.png'
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function finished(animation) {
  return animation.finished.catch(() => {})
}

/**
 * 從 from 飛到 to 並播完整套捕捉動畫。回傳 Promise，動畫結束後元素自動移除。
 * @param {{x:number,y:number}} from 視窗座標（按鈕中心）
 * @param {{x:number,y:number}} to   視窗座標（卡牌中心）
 * @param {number} size 精靈球直徑（px）
 */
export async function throwPokeball(from, to, size = 56) {
  const root = document.createElement('div')
  root.className = 'pokeball-fx'
  root.setAttribute('aria-hidden', 'true')
  root.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;z-index:1000;pointer-events:none;will-change:transform;`
  const ball = document.createElement('div')
  ball.style.cssText = 'width:100%;height:100%;filter:drop-shadow(0 4px 8px rgba(0,0,0,.35));'
  ball.innerHTML = ballMarkup()
  root.appendChild(ball)
  document.body.appendChild(root)

  if (reducedMotion()) {
    // 不播動畫：短暫顯示在卡牌中心即結束
    root.style.transform = `translate(${to.x}px, ${to.y}px)`
    await new Promise((r) => setTimeout(r, 250))
    root.remove()
    return
  }

  // 1. 拋物線飛行：以多段 keyframe 近似，同時旋轉
  const arc = Math.max(120, Math.abs(to.y - from.y) * 0.45)
  const steps = 12
  const flight = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = from.x + (to.x - from.x) * t
    const y = from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * arc
    flight.push({ transform: `translate(${x}px, ${y}px) rotate(${t * 720}deg)`, offset: t })
  }
  await finished(root.animate(flight, { duration: FLIGHT_MS, easing: 'ease-out', fill: 'forwards' }))

  // 2. 吸入：放大再縮小
  const at = `translate(${to.x}px, ${to.y}px)`
  await finished(
    root.animate(
      [
        { transform: `${at} scale(1)` },
        { transform: `${at} scale(1.6)`, offset: 0.45 },
        { transform: `${at} scale(0.9)`, offset: 0.8 },
        { transform: `${at} scale(1)` }
      ],
      { duration: ABSORB_MS, easing: 'ease-in-out', fill: 'forwards' }
    )
  )

  // 3. 晃動三下
  await finished(
    root.animate(
      [
        { transform: `${at} rotate(0deg)` },
        { transform: `${at} translateX(-8px) rotate(-22deg)`, offset: 0.25 },
        { transform: `${at} translateX(8px) rotate(22deg)`, offset: 0.75 },
        { transform: `${at} rotate(0deg)` }
      ],
      { duration: SHAKE_MS, iterations: SHAKES, easing: 'ease-in-out', fill: 'forwards' }
    )
  )

  // 4. 閃星
  const burst = []
  for (let i = 0; i < STAR_COUNT; i++) {
    const star = document.createElement('span')
    const angle = (i / STAR_COUNT) * Math.PI * 2 + Math.random() * 0.4
    const dist = size * (1.2 + Math.random() * 1.2)
    star.textContent = '✦'
    star.style.cssText = `position:absolute;left:50%;top:50%;margin:-10px 0 0 -10px;width:20px;height:20px;line-height:20px;text-align:center;font-size:${14 + Math.random() * 10}px;color:${i % 2 ? '#ffd35c' : '#fff'};text-shadow:0 0 6px rgba(255,211,92,.9);`
    root.appendChild(star)
    burst.push(
      finished(
        star.animate(
          [
            { transform: 'translate(0,0) scale(0.4)', opacity: 1 },
            { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(1.1)`, opacity: 0 }
          ],
          { duration: STARS_MS, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }
        )
      )
    )
  }
  burst.push(
    finished(
      ball.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.3)' }], {
        duration: STARS_MS * 0.6,
        delay: STARS_MS * 0.2,
        easing: 'ease-in',
        fill: 'forwards'
      })
    )
  )
  await Promise.all(burst)
  root.remove()
}
