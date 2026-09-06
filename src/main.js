import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

// 凍結區 Card.svelte 放大時會呼叫全域 gtag()；本站無 GA，改為轉發成 window 事件，
// 讓 stores/cards.svelte.js 得知目前放大的卡牌 id 與名稱（見 PLAN §3.1、§9.1）。不改凍結區。
window.gtag =
  window.gtag ||
  ((...args) => {
    window.dispatchEvent(new CustomEvent('gtag', { detail: args }))
  })

const app = mount(App, {
  target: document.getElementById('app')
})

export default app
