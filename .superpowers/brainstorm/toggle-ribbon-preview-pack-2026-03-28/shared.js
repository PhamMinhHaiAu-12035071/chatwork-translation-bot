;(function () {
  // ─────────────────────────────────────────────────────────
  // TOGGLE + RIBBON PREVIEW PACK — shared.js
  // Config expected at: window.TOGGLE_RIBBON_PREVIEW
  // ─────────────────────────────────────────────────────────
  const DEFAULT_STATE = { live: true, total: 8, active: 5 }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

  // ── Number animation ───────────────────────────────────────
  function animateNum(el, from, to) {
    const dur = 540
    const start = performance.now()
    el.classList.remove('count-pop')
    void el.offsetWidth
    el.classList.add('count-pop')

    ;(function tick(now) {
      const t = clamp((now - start) / dur, 0, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      el.textContent = String(Math.round(from + (to - from) * eased))
      if (t < 1) requestAnimationFrame(tick)
      else el.textContent = String(to)
    })(performance.now())
  }

  // ── Ribbon text update (triggers CSS animation) ────────────
  function updateRibbon(card, live, config) {
    const ribbon = card.querySelector('[data-role="ribbon"]')
    if (!ribbon) return
    ribbon.dataset.live = String(live)

    const textEl = ribbon.querySelector('[data-role="ribbon-text"]')
    if (!textEl) return

    const nextText = live ? (config.liveLabel || '● LIVE') : (config.pausedLabel || '‖ PAUSED')
    textEl.classList.remove('ribbon-change')
    void textEl.offsetWidth
    textEl.classList.add('ribbon-change')
    window.setTimeout(() => {
      textEl.textContent = nextText
      textEl.classList.remove('ribbon-change')
    }, 180)
  }

  // ── Ripple effect ──────────────────────────────────────────
  function fireRipple(card, live) {
    const layer = card.querySelector('[data-role="ripple-layer"]')
    if (!layer) return

    const dot = document.createElement('div')
    dot.className = 'ripple-circle'
    dot.classList.add(live ? 'go-mint' : 'go-gray')
    layer.appendChild(dot)
    window.setTimeout(() => dot.remove(), 680)
  }

  // ── Toggle state ───────────────────────────────────────────
  function applyState(card, live, config) {
    const track = card.querySelector('[data-role="toggle-track"]')
    if (track) {
      track.dataset.live = String(live)
      track.setAttribute('aria-label', live ? 'Pause this room' : 'Enable this room')
    }
    updateRibbon(card, live, config)
    fireRipple(card, live)
  }

  // ── Build ribbon HTML ──────────────────────────────────────
  // Each option may supply buildRibbonHtml(live) on the config
  function buildRibbonHtml(live, config) {
    if (typeof config.buildRibbonHtml === 'function') {
      return config.buildRibbonHtml(live)
    }
    const text = live ? (config.liveLabel || '● LIVE') : (config.pausedLabel || '‖ PAUSED')
    return `<div class="ribbon" data-role="ribbon" data-live="${live}">
      <span class="ribbon-text" data-role="ribbon-text">${esc(text)}</span>
    </div>`
  }

  // ── Room Card ─────────────────────────────────────────────
  function buildRoomCard(live, config, theme) {
    const ribbonHtml = buildRibbonHtml(live, config)
    return `
      <article class="room-card ${esc(theme)}" data-variant="${esc(config.variant)}">
        <div class="ripple-layer" data-role="ripple-layer" aria-hidden="true"></div>
        ${config.ribbonPosition === 'head-inline' ? '' : ribbonHtml}
        <div class="room-head">
          ${config.ribbonPosition === 'head-inline' ? ribbonHtml : ''}
          <div class="room-head-copy">
            <h3 class="room-name">Sakura Desk JP</h3>
            <p class="room-id">Room ID: 123456789</p>
          </div>
          <button
            class="tog-wrap"
            data-action="toggle-room"
            aria-label="${live ? 'Pause this room' : 'Enable this room'}"
          >
            <div class="tog-track" data-role="toggle-track" data-live="${live}">
              <span class="tog-thumb"></span>
            </div>
          </button>
        </div>
        <div class="room-facts">
          <div><strong>Provider:</strong> Google Gemini · default</div>
          <div><strong>Style:</strong> Professional Business</div>
        </div>
        <div class="room-foot">
          <button class="btn-edit">Edit</button>
          <button class="btn-delete">Delete</button>
        </div>
      </article>`
  }

  // ── Hero Section ───────────────────────────────────────────
  function buildHero(config) {
    return `
      <section class="hero-card">
        <div class="hero-top">
          <div class="hero-copy">
            <span class="sticker">Toggle + Ribbon Preview Pack</span>
            <h1>${esc(config.title)}</h1>
            <p>${esc(config.summary)}</p>
          </div>
          <div class="badge-row">
            <span class="badge" data-tone="safe">Option ${esc(config.index)}</span>
            <span class="badge" data-tone="medium">Intensity: ${esc(config.intensity)}</span>
            <span class="badge" data-tone="${esc(config.riskTone)}">Ship Risk: ${esc(config.shipRisk)}</span>
          </div>
        </div>
        <p class="ship-note">${esc(config.translationHint)}</p>
        <div class="nav-row">
          <a class="nav-link" href="./index.html">← Catalog</a>
          <a class="nav-link" href="${esc(config.prev)}">Previous</a>
          <a class="nav-link" href="${esc(config.next)}">Next</a>
        </div>
      </section>`
  }

  // ── Demo Surface ───────────────────────────────────────────
  function buildDemoSurface(config) {
    const themes = ['theme-lilac', 'theme-matcha', 'theme-sky']
    return `
      <section class="demo-surface">
        <div class="controls-row">
          <span class="controls-label">Test it →</span>
          <button class="ctrl-btn enable"  data-ctrl="enable">Enable All</button>
          <button class="ctrl-btn disable" data-ctrl="disable">Pause All</button>
          <button class="ctrl-btn"         data-ctrl="toggle">Toggle Each</button>
        </div>

        <div class="stats-grid">
          <article class="stat-card theme-lilac">
            <div class="stat-label">Total Rooms</div>
            <div class="stat-value" data-stat="total">8</div>
          </article>
          <article class="stat-card theme-matcha">
            <div class="stat-label">Active</div>
            <div class="stat-value" data-stat="active">5</div>
          </article>
          <article class="stat-card theme-butter">
            <div class="stat-label">Paused</div>
            <div class="stat-value" data-stat="paused">3</div>
          </article>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
          ${themes.map((t, i) => buildRoomCard(i < 2, config, t)).join('\n')}
        </div>

        ${config.previewNote ? `<p style="font-size:13px;color:var(--muted);padding:10px 14px;border:2px dashed var(--ink);border-radius:12px;background:rgba(255,255,255,0.5)">${esc(config.previewNote)}</p>` : ''}
      </section>`
  }

  // ── Mount ──────────────────────────────────────────────────
  function mount(config) {
    const root = document.getElementById('app')
    if (!root) return
    root.className = 'preview-shell'
    root.innerHTML = buildHero(config) + buildDemoSurface(config)

    const state = { live: [true, true, false] }

    function getCards() {
      return Array.from(root.querySelectorAll('.room-card'))
    }

    function updateStats() {
      const activeN = state.live.filter(Boolean).length
      const pausedN = state.live.length - activeN
      const totalEl = root.querySelector('[data-stat="total"]')
      const activeEl = root.querySelector('[data-stat="active"]')
      const pausedEl = root.querySelector('[data-stat="paused"]')
      if (activeEl) animateNum(activeEl, Number(activeEl.textContent), activeN)
      if (pausedEl) animateNum(pausedEl, Number(pausedEl.textContent), pausedN)
      if (totalEl && totalEl.textContent === '8') totalEl.textContent = '8'
    }

    // Card-level toggle click
    getCards().forEach((card, i) => {
      const btn = card.querySelector('[data-action="toggle-room"]')
      if (!btn) return
      btn.addEventListener('click', () => {
        state.live[i] = !state.live[i]
        applyState(card, state.live[i], config)
        updateStats()
      })
    })

    // Control buttons
    root.querySelector('[data-ctrl="enable"]')?.addEventListener('click', () => {
      state.live = state.live.map(() => true)
      getCards().forEach((card, i) => applyState(card, state.live[i], config))
      updateStats()
    })

    root.querySelector('[data-ctrl="disable"]')?.addEventListener('click', () => {
      state.live = state.live.map(() => false)
      getCards().forEach((card, i) => applyState(card, state.live[i], config))
      updateStats()
    })

    root.querySelector('[data-ctrl="toggle"]')?.addEventListener('click', () => {
      state.live = state.live.map(v => !v)
      getCards().forEach((card, i) => applyState(card, state.live[i], config))
      updateStats()
    })
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.TOGGLE_RIBBON_PREVIEW) return
    mount(window.TOGGLE_RIBBON_PREVIEW)
  })
})()
