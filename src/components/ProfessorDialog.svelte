<script>
  // 博士對話框（PLAN §9.5）：第一次進入視窗時逐字顯示，點擊立即全文，已播完不重播。
  let { text, instant = false } = $props()

  const CHAR_MS = 40
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  // 文字為每個展示區固定內容，只取初始值
  // svelte-ignore state_referenced_locally
  const chars = [...text]

  let root = $state()
  let shown = $state('')
  let started = false
  let done = $state(false)
  let avatarOk = $state(true)
  let timer

  function finish() {
    clearInterval(timer)
    shown = text
    done = true
  }

  function start() {
    if (started) return
    started = true
    if (reduced || instant) return finish()
    let i = 0
    timer = setInterval(() => {
      i += 1
      shown = chars.slice(0, i).join('')
      if (i >= chars.length) finish()
    }, CHAR_MS)
  }

  $effect(() => {
    if (!root) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          start()
          io.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    io.observe(root)
    return () => {
      io.disconnect()
      clearInterval(timer)
    }
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  role="button"
  tabindex="0"
  aria-label="顯示博士完整說明"
  class="dialog panel"
  class:done
  bind:this={root}
  onclick={finish}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && finish()}
>
  <div class="avatar" aria-hidden="true">
    {#if avatarOk}
      <img src="/town/professor.png" alt="" onerror={() => (avatarOk = false)} />
    {:else}
      <svg viewBox="0 0 64 64" class="silhouette">
        <circle cx="32" cy="22" r="14" />
        <path d="M8 62c2-16 12-24 24-24s22 8 24 24z" />
      </svg>
    {/if}
  </div>
  <div class="bubble">
    <p class="speaker">大木博士</p>
    <p class="sr-only">{text}</p>
    <p class="text" aria-hidden="true">
      <span class="sizer">{text}</span>
      <span class="typed">{shown}</span>
    </p>
  </div>
</div>

<style>
  .dialog {
    display: grid;
    grid-template-columns: 56px 1fr;
    gap: 12px;
    align-items: start;
    padding: 12px 14px;
    margin: 12px 0 8px;
    cursor: pointer;
    user-select: none;
    position: relative;
  }
  .dialog.done {
    cursor: default;
  }

  .avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    overflow: hidden;
    background: #e8eef5;
    border: 2px solid var(--wood);
    display: grid;
    place-items: center;
  }
  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .silhouette {
    width: 70%;
    fill: #9aa7b8;
  }

  .speaker {
    font-family: var(--font-display);
    font-size: 14px;
    color: var(--wood-dark);
    margin-bottom: 2px;
  }

  .text {
    position: relative;
    font-size: 16px;
    line-height: 1.7;
    color: var(--ink);
  }
  .sizer {
    visibility: hidden;
  }
  .typed {
    position: absolute;
    inset: 0;
  }
  .dialog:not(.done) .typed::after {
    content: '▍';
    color: var(--wood);
    animation: blink 0.8s steps(1) infinite;
  }
  @keyframes blink {
    50% { opacity: 0; }
  }

  @media (min-width: 900px) {
    .dialog {
      grid-template-columns: 72px 1fr;
      padding: 16px 20px;
      max-width: 720px;
    }
    .avatar {
      width: 72px;
      height: 72px;
    }
    .text {
      font-size: 17px;
    }
  }
</style>
