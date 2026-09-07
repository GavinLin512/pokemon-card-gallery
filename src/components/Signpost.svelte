<script>
  // 路標（PLAN §9.6）：木牌導覽列，桌機換行、手機橫向捲動；目前展示區高亮。
  // 原位捲出視窗頂端後改為停靠在畫面底部（離底一小段距離）；卡牌放大時停靠列先收起，讓位給精靈球按鈕。
  import { activeCard } from '../lib/stores/activeCard.js'

  let { sections } = $props()

  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  let slot = $state()
  let nav = $state()
  /** 原位高度，停靠時由佔位撐住，避免版面跳動 */
  let navH = $state(0)
  let docked = $state(false)
  // svelte-ignore state_referenced_locally
  let activeId = $state(sections[0]?.id)

  const hidden = $derived(docked && !!$activeCard)

  function go(event, id) {
    event.preventDefault()
    const target = document.getElementById(id)
    if (!target) return
    history.replaceState(null, '', `#${id}`)
    if (reduced) return target.scrollIntoView({ block: 'start' })
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // 捲動途中沿路展示區會掛載卡牌而改變高度，結束後再瞬間校正一次
    const settle = () => {
      window.removeEventListener('scrollend', settle)
      clearTimeout(fallback)
      const top = target.getBoundingClientRect().top
      const want = parseFloat(getComputedStyle(target).scrollMarginTop) || 0
      if (Math.abs(top - want) > 4) target.scrollIntoView({ block: 'start' })
    }
    const fallback = setTimeout(settle, 1200)
    window.addEventListener('scrollend', settle, { once: true })
  }

  // 追蹤目前展示區：取最後一個頂端已到達停靠線（scroll-margin-top）的展示區。
  // 用捲動事件而非 IntersectionObserver，是因為落點時上一區尾端也會與判定帶相交，IO 會選錯。
  // 同一趟也判斷路標原位頂端是否已碰到 TopBar 底緣，是則停靠到畫面底部，不讓木牌半截被 TopBar 蓋住。
  $effect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      if (slot) {
        const topbar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 0
        docked = slot.getBoundingClientRect().top < topbar
      }
      let current = sections[0]?.id
      for (const s of sections) {
        const el = document.getElementById(s.id)
        if (!el) continue
        // 容差與 go() 的落點校正一致（4px 內不校正）
        const line = (parseFloat(getComputedStyle(el).scrollMarginTop) || 0) + 6
        if (el.getBoundingClientRect().top <= line) current = s.id
        else break
      }
      if (current) activeId = current
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  })

  // 手機橫向捲動時，讓目前木牌置中
  $effect(() => {
    if (!nav) return
    const el = nav.querySelector('[aria-current="true"]')
    if (!el || nav.scrollWidth <= nav.clientWidth) return
    nav.scrollTo({
      left: el.offsetLeft - nav.clientWidth / 2 + el.offsetWidth / 2,
      behavior: reduced ? 'auto' : 'smooth'
    })
  })

  // 量測原位高度：供佔位與頁尾預留空間使用。停靠時寬度不同、換行數可能改變，不更新以免佔位高度來回跳。
  $effect(() => {
    if (!nav) return
    const ro = new ResizeObserver(([entry]) => {
      if (docked) return
      navH = Math.round(entry.borderBoxSize?.[0]?.blockSize ?? entry.target.offsetHeight)
      document.documentElement.style.setProperty('--signpost-h', `${navH}px`)
    })
    ro.observe(nav)
    return () => ro.disconnect()
  })
</script>

<div class="slot" bind:this={slot} style:height={docked ? `${navH}px` : null}>
  <nav class="signpost" class:docked class:hidden aria-label="卡種路標" bind:this={nav}>
    <ul class="planks">
      {#each sections as s (s.id)}
        <li>
          <a
            class="plank wood tap-target"
            class:active={s.id === activeId}
            href="#{s.id}"
            aria-current={s.id === activeId ? 'true' : undefined}
            tabindex={hidden ? -1 : undefined}
            onclick={(e) => go(e, s.id)}
          >
            {s.name}
          </a>
        </li>
      {/each}
    </ul>
  </nav>
</div>

<style>
  .slot {
    margin: 8px -16px 0;
  }

  .signpost {
    padding: 8px 16px;
    /* 霧面底板：停靠時避免下方卡牌從木牌間隙透出 */
    background: var(--ui-bg);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--ui-border);
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x proximity;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.3, 1), opacity 0.25s ease;
  }
  .signpost::-webkit-scrollbar {
    display: none;
  }

  /* 原位捲出視窗後停靠在底部，離底一小段距離 */
  .signpost.docked {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    z-index: 100;
    border: 1px solid var(--ui-border);
    border-radius: 16px;
    box-shadow: var(--ui-shadow);
    animation: dock-in 0.3s cubic-bezier(0.2, 0.8, 0.3, 1);
  }
  /* 卡牌放大時收起，讓位給精靈球按鈕 */
  .signpost.docked.hidden {
    transform: translateY(calc(100% + 32px));
    opacity: 0;
    pointer-events: none;
  }
  @keyframes dock-in {
    from {
      transform: translateY(calc(100% + 32px));
      opacity: 0;
    }
  }

  .planks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    gap: 8px;
    width: max-content;
  }
  li {
    scroll-snap-align: center;
  }

  .plank {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 14px;
    height: 44px;
    font-family: var(--font-display);
    font-size: 15px;
    white-space: nowrap;
    text-decoration: none;
    box-shadow: 0 3px 0 rgba(0, 0, 0, 0.2), 0 6px 14px rgba(0, 0, 0, 0.18);
    transition: transform 0.15s ease, filter 0.15s ease;
  }
  .plank:hover {
    filter: brightness(1.08);
  }
  .plank.active {
    border-color: var(--accent);
    box-shadow:
      0 0 0 2px var(--accent-dark),
      0 3px 0 rgba(0, 0, 0, 0.2),
      0 6px 14px rgba(0, 0, 0, 0.18);
    transform: translateY(-2px);
  }
  .plank:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }

  @media (min-width: 900px) {
    .slot {
      margin: 12px 0 0;
    }
    .signpost {
      padding: 10px 12px;
      overflow: visible;
      scroll-snap-type: none;
      border: 1px solid var(--ui-border);
      border-radius: 16px;
    }
    .signpost.docked {
      left: 0;
      right: 0;
      width: min(var(--page-max), calc(100% - 48px));
      margin: 0 auto;
      bottom: 16px;
    }
    .planks {
      flex-wrap: wrap;
      width: auto;
      gap: 10px;
    }
    .plank {
      font-size: 16px;
      padding: 0 16px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .signpost {
      transition: none;
    }
    .signpost.docked {
      animation: none;
    }
  }
</style>
