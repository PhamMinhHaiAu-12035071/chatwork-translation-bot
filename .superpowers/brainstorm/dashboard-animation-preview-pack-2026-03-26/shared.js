(function () {
  const DEFAULT_STATE = {
    live: true,
    total: 12,
    active: 7,
    pending: 4,
  }

  const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-'

  const COUNT_MODE_BY_VARIANT = {
    'soft-fade-swap': 'count-soft',
    'slide-stack': 'count-slide',
    'sticker-pop': 'count-pop',
    'flip-pill': 'count-flip',
    'scramble-relay': 'count-digital',
    'dust-swap': 'count-dust',
    'pixel-scatter': 'count-pixel',
    'ink-smear': 'count-ink',
    'ribbon-peel': 'count-peel',
    'comet-burst': 'count-comet',
  }

  function escapeHtml(value) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }

  function randomBetween(min, max) {
    return Math.random() * (max - min) + min
  }

  function animateValue(from, to, duration, onUpdate, onComplete) {
    const start = performance.now()

    function frame(now) {
      const progress = clamp((now - start) / duration, 0, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const value = from + (to - from) * eased
      onUpdate(value)

      if (progress < 1) {
        requestAnimationFrame(frame)
        return
      }

      onUpdate(to)
      if (onComplete) {
        onComplete()
      }
    }

    requestAnimationFrame(frame)
  }

  function restartClass(node, className) {
    node.classList.remove(className)
    void node.offsetWidth
    node.classList.add(className)
  }

  function buildSplitLayer(text, effectClass, direction) {
    const layer = document.createElement('span')
    layer.className = `swap-layer split ${effectClass} ${direction}`

    for (const [index, rawChar] of [...text].entries()) {
      const char = document.createElement('span')
      char.className = 'swap-char'
      char.textContent = rawChar === ' ' ? '\u00a0' : rawChar
      char.style.setProperty('--i', String(index))
      char.style.setProperty('--x', `${randomBetween(-28, 28).toFixed(2)}px`)
      char.style.setProperty('--y', `${randomBetween(-22, 22).toFixed(2)}px`)
      char.style.setProperty('--r', `${randomBetween(-44, 44).toFixed(2)}deg`)
      layer.append(char)
    }

    return layer
  }

  function finalizeStage(stage, nextText) {
    stage.textContent = ''
    const stable = document.createElement('span')
    stable.className = 'swap-stable'
    stable.textContent = nextText
    stage.append(stable)
    stage.dataset.text = nextText
  }

  function runSimpleSwap(stage, currentText, nextText, effectClass) {
    stage.textContent = ''

    const outgoing = document.createElement('span')
    outgoing.className = `swap-layer ${effectClass} out`
    outgoing.textContent = currentText

    const incoming = document.createElement('span')
    incoming.className = `swap-layer ${effectClass} in`
    incoming.textContent = nextText

    stage.append(outgoing, incoming)
    window.setTimeout(() => finalizeStage(stage, nextText), 640)
  }

  function runSplitSwap(stage, nextText, effectClass) {
    const currentText = stage.dataset.text ?? stage.textContent ?? ''
    stage.textContent = ''
    stage.append(buildSplitLayer(currentText, effectClass, 'out'))
    stage.append(buildSplitLayer(nextText, effectClass, 'in'))
    window.setTimeout(() => finalizeStage(stage, nextText), 760)
  }

  function runScramble(stage, nextText) {
    const startText = stage.dataset.text ?? stage.textContent ?? ''
    stage.textContent = startText
    stage.classList.add('scramble-stage', 'is-scrambling')

    const length = Math.max(startText.length, nextText.length)
    let frame = 0
    const totalFrames = 14

    function tick() {
      const progress = frame / totalFrames
      const output = Array.from({ length }, (_, index) => {
        if (progress > index / Math.max(length, 1)) {
          return nextText[index] ?? ''
        }

        const randomIndex = Math.floor(Math.random() * SCRAMBLE_CHARS.length)
        return SCRAMBLE_CHARS[randomIndex] ?? ''
      }).join('')

      stage.textContent = output

      if (frame < totalFrames) {
        frame += 1
        window.setTimeout(tick, 28)
        return
      }

      stage.classList.remove('is-scrambling')
      finalizeStage(stage, nextText)
    }

    tick()
  }

  function animateText(stage, nextText, variant) {
    const currentText = stage.dataset.text ?? stage.textContent ?? ''

    if (currentText === nextText) {
      return
    }

    switch (variant) {
      case 'soft-fade-swap':
        runSimpleSwap(stage, currentText, nextText, 'fx-soft-fade')
        return
      case 'slide-stack':
        runSimpleSwap(stage, currentText, nextText, 'fx-slide-stack')
        return
      case 'sticker-pop':
        runSimpleSwap(stage, currentText, nextText, 'fx-sticker-pop')
        return
      case 'flip-pill':
        runSimpleSwap(stage, currentText, nextText, 'fx-flip-pill')
        return
      case 'scramble-relay':
        runScramble(stage, nextText)
        return
      case 'dust-swap':
        runSplitSwap(stage, nextText, 'fx-dust-swap')
        return
      case 'pixel-scatter':
        runSplitSwap(stage, nextText, 'fx-pixel-scatter')
        return
      case 'ink-smear':
        runSimpleSwap(stage, currentText, nextText, 'fx-ink-smear')
        return
      case 'ribbon-peel':
        runSimpleSwap(stage, currentText, nextText, 'fx-ribbon-peel')
        return
      case 'comet-burst':
        stage.classList.add('comet-burst', 'is-bursting')
        runSplitSwap(stage, nextText, 'fx-comet-split')
        window.setTimeout(() => stage.classList.remove('is-bursting'), 580)
        return
      default:
        finalizeStage(stage, nextText)
    }
  }

  function animateNumber(node, nextValue, variant) {
    const countClass = COUNT_MODE_BY_VARIANT[variant] ?? 'count-soft'
    const previous = Number(node.dataset.value ?? node.textContent ?? '0')
    node.dataset.value = String(nextValue)
    restartClass(node, countClass)

    animateValue(previous, nextValue, 620, (value) => {
      node.textContent = String(Math.round(value))
    })
  }

  function updateStat(root, key, nextValue, variant) {
    const node = root.querySelector(`[data-stat-value="${key}"]`)
    if (!node) {
      return
    }

    animateNumber(node, nextValue, variant)
  }

  function applyState(root, state, config) {
    const statusStage = root.querySelector('[data-role="status-stage"]')
    const actionStage = root.querySelector('[data-role="action-stage"]')
    const statusPill = root.querySelector('[data-role="status-pill"]')
    const actionButton = root.querySelector('[data-action="toggle-room"]')

    if (statusStage) {
      animateText(statusStage, state.live ? 'Live' : 'Paused', config.variant)
    }

    if (actionStage) {
      animateText(actionStage, state.live ? 'Pause' : 'Enable', config.variant)
    }

    if (statusPill) {
      statusPill.dataset.live = String(state.live)
    }

    if (actionButton) {
      actionButton.dataset.live = String(state.live)
    }
  }

  function buildHero(config) {
    return `
      <section class="hero-card">
        <div class="hero-top">
          <div class="hero-copy">
            <span class="sticker">Dashboard Motion Preview Pack</span>
            <h1>${escapeHtml(config.title)}</h1>
            <p class="lede">${escapeHtml(config.summary)}</p>
          </div>
          <div class="badge-row">
            <span class="badge" data-tone="safe">Option ${escapeHtml(config.index)}</span>
            <span class="badge" data-tone="medium">Intensity: ${escapeHtml(config.intensity)}</span>
            <span class="badge" data-tone="${escapeHtml(config.riskTone)}">Ship Risk: ${escapeHtml(config.shipRisk)}</span>
          </div>
        </div>
        <p class="ship-note">${escapeHtml(config.translationHint)}</p>
        <div class="nav-row">
          <a class="nav-link" href="./index.html">Back to Catalog</a>
          <a class="nav-link" href="${escapeHtml(config.prev)}">Previous</a>
          <a class="nav-link" href="${escapeHtml(config.next)}">Next</a>
        </div>
      </section>
    `
  }

  function buildDemoSurface(config) {
    return `
      <section class="surface demo-grid">
        <div class="controls-row">
          <button class="demo-button primary" type="button" data-action="toggle-room">Toggle Room State</button>
          <button class="demo-button secondary" type="button" data-action="add-room">+ Room</button>
          <button class="demo-button warning" type="button" data-action="remove-room">- Room</button>
          <button class="demo-button danger" type="button" data-action="toggle-pending">Toggle Pending</button>
        </div>

        <div class="stats-grid">
          <article class="stat-card theme-lilac" data-stat="total">
            <div class="stat-label">Total Rooms</div>
            <div class="stat-value" data-stat-value="total" data-value="12">12</div>
            <div class="stat-sub">Use + Room or - Room to test count motion.</div>
          </article>
          <article class="stat-card theme-matcha" data-stat="active">
            <div class="stat-label">Active</div>
            <div class="stat-value" data-stat-value="active" data-value="7">7</div>
            <div class="stat-sub">Toggling the room state should push this number up or down.</div>
          </article>
          <article class="stat-card theme-butter" data-stat="pending">
            <div class="stat-label">Awaiting Webhook</div>
            <div class="stat-value" data-stat-value="pending" data-value="4">4</div>
            <div class="stat-sub">Toggle pending to preview decrement and increment behavior.</div>
          </article>
        </div>

        <article class="surface room-card theme-paper">
          <div class="room-head">
            <div class="room-head-copy">
              <h2 class="room-name">Sakura Desk JP</h2>
              <div class="room-meta">Room ID: 123456789</div>
            </div>
            <div class="status-pill" data-role="status-pill" data-live="true">
              <span class="swap-stage" data-role="status-stage" data-text="Live">
                <span class="swap-stable">Live</span>
              </span>
            </div>
          </div>

          <div class="room-facts">
            <div><strong>Provider:</strong> Google Gemini · default model</div>
            <div><strong>Style:</strong> Professional Business</div>
            <div><strong>Preview Note:</strong> ${escapeHtml(config.previewNote)}</div>
          </div>

          <div class="room-actions">
            <div class="action-static">Edit</div>
            <button class="action-button" type="button" data-action="toggle-room" data-live="true">
              <span class="swap-stage" data-role="action-stage" data-text="Pause">
                <span class="swap-stable">Pause</span>
              </span>
            </button>
            <div class="action-static delete">Delete</div>
          </div>
        </article>
      </section>
    `
  }

  function mountPreview(config) {
    const root = document.getElementById('app')
    if (!root) {
      return
    }

    root.className = 'preview-shell'
    root.innerHTML = `
      ${buildHero(config)}
      ${buildDemoSurface(config)}
    `

    const state = { ...DEFAULT_STATE }

    function renderAll() {
      applyState(root, state, config)
      updateStat(root, 'total', state.total, config.variant)
      updateStat(root, 'active', state.active, config.variant)
      updateStat(root, 'pending', state.pending, config.variant)
    }

    function setLive(nextLive) {
      if (state.live === nextLive) {
        return
      }

      state.live = nextLive
      state.active = clamp(state.active + (nextLive ? 1 : -1), 0, state.total)
      applyState(root, state, config)
      updateStat(root, 'active', state.active, config.variant)
    }

    function addRoom() {
      state.total += 1
      state.pending = clamp(state.pending + 1, 0, state.total)
      updateStat(root, 'total', state.total, config.variant)
      updateStat(root, 'pending', state.pending, config.variant)
    }

    function removeRoom() {
      if (state.total <= 1) {
        return
      }

      state.total -= 1
      state.active = clamp(state.active, 0, state.total)
      state.pending = clamp(state.pending - 1, 0, state.total)
      updateStat(root, 'total', state.total, config.variant)
      updateStat(root, 'active', state.active, config.variant)
      updateStat(root, 'pending', state.pending, config.variant)
    }

    function togglePending() {
      const nextValue =
        state.pending >= state.total ? clamp(state.pending - 2, 0, state.total) : state.pending + 1
      state.pending = clamp(nextValue, 0, state.total)
      updateStat(root, 'pending', state.pending, config.variant)
    }

    for (const button of root.querySelectorAll('[data-action="toggle-room"]')) {
      button.addEventListener('click', () => {
        setLive(!state.live)
      })
    }

    root.querySelector('[data-action="add-room"]').addEventListener('click', addRoom)
    root.querySelector('[data-action="remove-room"]').addEventListener('click', removeRoom)
    root.querySelector('[data-action="toggle-pending"]').addEventListener('click', togglePending)

    renderAll()
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.DASHBOARD_ANIMATION_PREVIEW) {
      return
    }

    mountPreview(window.DASHBOARD_ANIMATION_PREVIEW)
  })
})()
