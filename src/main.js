import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

// 凍結區 Card.svelte 放大時會呼叫全域 gtag()；本站無 GA，補一個空函式避免拋錯（見 PLAN §3.1）。
window.gtag = window.gtag || (() => {})

const app = mount(App, {
  target: document.getElementById('app')
})

export default app
