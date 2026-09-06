<script>
  // 路標（PLAN §9.6）：木牌導覽列，桌機換行、手機橫向捲動；目前展示區高亮。
  let { sections } = $props()

  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  let nav = $state()
  // svelte-ignore state_referenced_locally
  let activeId = $state(sections[0]?.id)

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
  $effect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      let current = sections[0]?.id
      for (const s of sections) {
        const el = document.getElementById(s.id)
        if (!el) continue
        const line = (parseFloat(getComputedStyle(el).scrollMarginTop) || 0) + 2
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

  // 量測高度供 scroll-margin 使用
  $effect(() => {
    if (!nav) return
    const ro = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty('--signpost-h', `${Math.round(entry.contentRect.height)}px`)
    })
    ro.observe(nav)
    return () => ro.disconnect()
  })
</script>

<nav class="signpost" aria-label="卡種路標" bind:this={nav}>
  <div class="post" aria-hidden="true"></div>
  <ul class="planks">
    {#each sections as s (s.id)}
      <li>
        <a
          class="plank wood tap-target"
          class:active={s.id === activeId}
          href="#{s.id}"
          aria-current={s.id === activeId ? 'true' : undefined}
          onclick={(e) => go(e, s.id)}
        >
          {s.name}
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  .signpost {
    position: sticky;
    top: var(--topbar-h);
    z-index: 40;
    margin: 8px -16px 0;
    padding: 8px 16px;
    /* 霧面底板：固定在頂端時，避免下方卡牌從木牌間隙透出 */
    background: var(--ui-bg);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--ui-border);
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x proximity;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .signpost::-webkit-scrollbar {
    display: none;
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

  .post {
    display: none;
  }

  @media (min-width: 900px) {
    .signpost {
      margin: 12px 0 0;
      padding: 10px 12px;
      overflow: visible;
      scroll-snap-type: none;
      border: 1px solid var(--ui-border);
      border-radius: 16px;
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
</style>
