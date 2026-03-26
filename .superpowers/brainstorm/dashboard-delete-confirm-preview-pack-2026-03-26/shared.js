const DeleteConfirmPreview = (() => {
  const ROOT_DATASET_VALUE = 'dashboard-delete-confirm-preview'

  const ROOM_DATA = {
    name: 'Northline Ops',
    summary: 'Weekly room for launch triage, shipping notes, and customer escalations.',
    tags: ['#launch-squad', '14 members', 'Updated 2 minutes ago'],
    history: [
      'Mina: I moved the handoff doc into the shared drive.',
      'Jae: The checkout bug is still waiting on QA.',
      "Priya: Keep the guest list tight for tomorrow's launch.",
    ],
  }

  const VARIANT_CONFIG = {
    'safety-slider': {
      id: 'safety-slider',
      option: '01',
      title: 'Safety Slider',
      family: 'lever',
      accent: '#8de6b0',
      accentSoft: '#def9e6',
      prompt: 'Slide the safety rail all the way to the red stop to arm deletion.',
      actionHint: 'Drag to arm',
      helper: 'Three short nudges move the thumb from safe to delete.',
      result: 'The rail lands on the red stop and the room deletes with the calmest motion in the pack.',
      mechanic: {
        type: 'stepper',
        step: 34,
        buttonLabel: 'Slide rail',
      },
    },
    'sticker-lever': {
      id: 'sticker-lever',
      option: '02',
      title: 'Sticker Lever',
      family: 'lever',
      accent: '#ffcf5c',
      accentSoft: '#fff1bf',
      prompt: 'Pull the sticker lever out of the frame to confirm the delete.',
      actionHint: 'Pull to delete',
      helper: 'Two pulls peel the sticker shell back and pop the lever free.',
      result: 'The sticker shell peels back and the delete lever clicks home.',
      mechanic: {
        type: 'stepper',
        step: 50,
        buttonLabel: 'Pull lever',
      },
    },
    'dual-lock-lever': {
      id: 'dual-lock-lever',
      option: '03',
      title: 'Dual Lock Lever',
      family: 'lever',
      accent: '#8cc8ff',
      accentSoft: '#dff0ff',
      prompt: 'Unlock both sides before the delete latch will release.',
      actionHint: 'Both sides must release',
      helper: 'Flip both locks, then release the lever.',
      result: 'Both lock zones clear and the lever drops with a mechanical finality.',
      mechanic: {
        type: 'dual-lock',
      },
    },
    'hold-to-melt': {
      id: 'hold-to-melt',
      option: '04',
      title: 'Hold To Melt',
      family: 'hold',
      accent: '#ff9d7b',
      accentSoft: '#ffe4d8',
      prompt: 'Hold the button until it melts through the confirmation ring.',
      actionHint: 'Press and hold',
      helper: 'Keep pressure on the button until the fill melts all the way through.',
      result: 'The button softens, melts through the ring, and the preview room disappears.',
      mechanic: {
        type: 'hold',
        step: 25,
        buttonLabel: 'Hold to melt',
      },
    },
    'trash-gate': {
      id: 'trash-gate',
      option: '05',
      title: 'Trash Gate',
      family: 'lever',
      accent: '#b7e6a1',
      accentSoft: '#e2f8d9',
      prompt: 'Drag the room chip through the gate and drop it in the bin.',
      actionHint: 'Drag to delete',
      helper: 'Two pushes send the room chip into the bright trash gate.',
      result: 'The room chip slides through the gate and drops cleanly into the bin.',
      mechanic: {
        type: 'stepper',
        step: 50,
        buttonLabel: 'Push chip forward',
      },
    },
    'fuse-pull': {
      id: 'fuse-pull',
      option: '06',
      title: 'Fuse Pull',
      family: 'lever',
      accent: '#ffe36b',
      accentSoft: '#fff5b3',
      prompt: 'Pull the fuse until the room is armed for deletion.',
      actionHint: 'Pull to arm',
      helper: 'Two pulls arm the fuse and trigger the destructive state.',
      result: 'The fuse line clears, the knot snaps free, and the room deletes with a bright pop.',
      mechanic: {
        type: 'stepper',
        step: 50,
        buttonLabel: 'Pull fuse',
      },
    },
    'stamp-crush': {
      id: 'stamp-crush',
      option: '07',
      title: 'Stamp Crush',
      family: 'stamp',
      accent: '#ff6f9f',
      accentSoft: '#ffd9e8',
      prompt: 'Press the stamp down until the delete mark lands.',
      actionHint: 'Press to confirm',
      helper: 'One heavy press lands the delete stamp.',
      result: 'The rubber stamp thumps down and leaves a loud DELETE mark behind.',
      mechanic: {
        type: 'single',
        buttonLabel: 'Crush stamp',
      },
    },
    'card-shred': {
      id: 'card-shred',
      option: '08',
      title: 'Card Shred',
      family: 'shred',
      accent: '#c6b8ff',
      accentSoft: '#ece5ff',
      prompt: 'Drag the blade across the card edge to shred the room.',
      actionHint: 'Drag to shred',
      helper: 'Three passes take the blade from edge nick to full shred.',
      result: 'The blade cuts through the room card edge and the preview room tears away.',
      mechanic: {
        type: 'stepper',
        step: 34,
        buttonLabel: 'Shred edge',
      },
    },
    'warning-dial': {
      id: 'warning-dial',
      option: '09',
      title: 'Warning Dial',
      family: 'dial',
      accent: '#f4c44d',
      accentSoft: '#fff2b5',
      prompt: 'Rotate the dial from Safe to Delete and stop on the red notch.',
      actionHint: 'Rotate to delete',
      helper: 'Quarter turns move the pointer from green through yellow into red.',
      result: 'The pointer swings to delete and locks on the red notch.',
      mechanic: {
        type: 'stepper',
        step: 25,
        buttonLabel: 'Turn dial',
      },
    },
    'slam-confirm': {
      id: 'slam-confirm',
      option: '10',
      title: 'Slam Confirm',
      family: 'slam',
      accent: '#ff8ab1',
      accentSoft: '#ffddea',
      prompt: 'Drop the slab into the slot and let it slam shut.',
      actionHint: 'Drop to delete',
      helper: 'One loud drop commits the delete instantly.',
      result: 'The slab slams home, the slot seals, and the delete reads as fully committed.',
      mechanic: {
        type: 'single',
        buttonLabel: 'Slam confirm',
      },
    },
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value))
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }

  function getVariantConfig(variantId) {
    const variant = VARIANT_CONFIG[variantId]

    if (!variant) {
      throw new Error(`Unknown preview variant: ${variantId}`)
    }

    return variant
  }

  function createInitialState(variantId) {
    const variant = getVariantConfig(variantId)

    return {
      variantId,
      isOpen: false,
      isDeleted: false,
      isHolding: false,
      progress: 0,
      lockStatus:
        variant.mechanic.type === 'dual-lock'
          ? {
              cancel: false,
              delete: false,
            }
          : null,
    }
  }

  function snapshotState(state) {
    return {
      ...state,
      lockStatus: state.lockStatus ? { ...state.lockStatus } : null,
    }
  }

  function openModal(state) {
    if (state.isDeleted) {
      return snapshotState(state)
    }

    state.isOpen = true
    return snapshotState(state)
  }

  function closeModal(state) {
    state.isHolding = false
    state.isOpen = false
    return snapshotState(state)
  }

  function confirmDelete(state) {
    state.progress = 100
    state.isDeleted = true
    state.isHolding = false
    state.isOpen = false
    return snapshotState(state)
  }

  function resetState(state) {
    const nextState = createInitialState(state.variantId)
    Object.assign(state, nextState)
    return snapshotState(state)
  }

  function advanceStepper(state, variant) {
    state.progress = clamp(state.progress + variant.mechanic.step, 0, 100)

    if (state.progress >= 100) {
      return confirmDelete(state)
    }

    return snapshotState(state)
  }

  function advanceDualLock(state, action) {
    if (!state.lockStatus) {
      return snapshotState(state)
    }

    if (action === 'cancel' || action === 'delete') {
      state.lockStatus[action] = !state.lockStatus[action]
      state.progress = state.lockStatus.cancel && state.lockStatus.delete ? 80 : 40
      return snapshotState(state)
    }

    if (action === 'release' && state.lockStatus.cancel && state.lockStatus.delete) {
      return confirmDelete(state)
    }

    return snapshotState(state)
  }

  function beginHold(state) {
    if (!state.isOpen || state.isDeleted) {
      return snapshotState(state)
    }

    state.isHolding = true
    return snapshotState(state)
  }

  function endHold(state) {
    state.isHolding = false
    return snapshotState(state)
  }

  function advanceHold(state, amount = 25) {
    if (!state.isHolding || state.isDeleted) {
      return snapshotState(state)
    }

    state.progress = clamp(state.progress + amount, 0, 100)

    if (state.progress >= 100) {
      return confirmDelete(state)
    }

    return snapshotState(state)
  }

  function advanceVariant(state, variant, action = 'advance') {
    if (!state.isOpen || state.isDeleted) {
      return snapshotState(state)
    }

    if (variant.mechanic.type === 'stepper') {
      return advanceStepper(state, variant)
    }

    if (variant.mechanic.type === 'single') {
      return confirmDelete(state)
    }

    if (variant.mechanic.type === 'dual-lock') {
      return advanceDualLock(state, action)
    }

    if (variant.mechanic.type === 'hold') {
      return advanceHold(state, variant.mechanic.step)
    }

    return snapshotState(state)
  }

  function createPreviewController(variantId) {
    const variant = getVariantConfig(variantId)
    const state = createInitialState(variantId)

    return {
      getState() {
        return snapshotState(state)
      },
      getVariant() {
        return variant
      },
      openModal() {
        return openModal(state)
      },
      closeModal() {
        return closeModal(state)
      },
      reset() {
        return resetState(state)
      },
      advance(action) {
        return advanceVariant(state, variant, action)
      },
      beginHold() {
        return beginHold(state)
      },
      advanceHold(amount) {
        return advanceHold(state, amount ?? variant.mechanic.step)
      },
      endHold() {
        return endHold(state)
      },
    }
  }

  function renderRoomCard(state) {
    return `
      <section class="room-card surface${state.isDeleted ? ' is-deleted' : ''}">
        <div class="room-top">
          <div class="room-copy">
            <span class="sticker">Shared room context</span>
            <h2 class="room-title">${escapeHtml(ROOM_DATA.name)}</h2>
            <p class="room-summary">${escapeHtml(ROOM_DATA.summary)}</p>
          </div>
          <div class="room-meta">
            ${ROOM_DATA.tags
              .map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`)
              .join('')}
            ${state.isDeleted ? '<span class="chip chip--danger">Deleted in preview</span>' : ''}
          </div>
        </div>
        <div class="room-history">
          ${ROOM_DATA.history
            .map((item) => `<div class="history-item">${escapeHtml(item)}</div>`)
            .join('')}
        </div>
        <div class="room-actions">
          <button class="action-button action-button--danger" type="button" data-action="open-modal"${
            state.isDeleted ? ' disabled' : ''
          }>
            ${state.isDeleted ? 'Preview deleted' : `Delete ${escapeHtml(ROOM_DATA.name)}`}
          </button>
          <button class="nav-link" type="button" data-action="reset"${
            state.isDeleted ? '' : ' hidden'
          }>
            Replay preview
          </button>
        </div>
      </section>
    `
  }

  function renderResultCard(state, variant) {
    const detail = state.isDeleted
      ? variant.result
      : `Run ${variant.title} and the deleted preview state will appear here.`

    return `
      <section class="result-card surface${state.isDeleted ? ' is-visible' : ''}">
        <div class="result-top">
          <div class="result-copy">
            <span class="sticker">${state.isDeleted ? 'Preview result' : 'Ready state'}</span>
            <h2 class="result-title">${
              state.isDeleted ? `${escapeHtml(ROOM_DATA.name)} deleted` : 'Preview still armed'
            }</h2>
            <p class="note">${escapeHtml(detail)}</p>
          </div>
          <div class="badge-row">
            <span class="badge" data-tone="${state.isDeleted ? 'bold' : 'safe'}">${
              state.isDeleted ? 'Deleted' : 'Not deleted'
            }</span>
            <span class="badge" data-tone="medium">${escapeHtml(variant.title)}</span>
          </div>
        </div>
      </section>
    `
  }

  function renderMeter(state) {
    return `
      <div class="progress-meter" aria-hidden="true">
        <div class="progress-meter__fill" style="width: ${state.progress}%"></div>
      </div>
    `
  }

  function renderVariantControl(state, variant) {
    const progress = `${state.progress}%`

    if (variant.id === 'safety-slider') {
      return `
        <div class="variant-stage slider-stage">
          <div class="slider-track">
            <div class="slider-fill" style="width: ${progress}"></div>
            <button class="mechanic-button slider-thumb" type="button" data-action="advance">
              ${escapeHtml(variant.mechanic.buttonLabel)}
            </button>
          </div>
          <div class="slider-ends"><span>Safe</span><span>Delete</span></div>
          ${renderMeter(state)}
        </div>
      `
    }

    if (variant.id === 'sticker-lever') {
      return `
        <div class="variant-stage sticker-stage">
          <div class="lever-slot">
            <div class="helper-copy">Peek under the sticker and tug the lever straight down.</div>
            <button class="mechanic-button lever-handle" type="button" data-action="advance">
              ${escapeHtml(variant.mechanic.buttonLabel)}
            </button>
          </div>
          ${renderMeter(state)}
        </div>
      `
    }

    if (variant.id === 'dual-lock-lever') {
      const cancelClass = state.lockStatus?.cancel ? ' is-active' : ''
      const deleteClass = state.lockStatus?.delete ? ' is-active' : ''

      return `
        <div class="variant-stage dual-lock-stage">
          <div class="lock-row">
            <button class="lock-zone${cancelClass}" type="button" data-action="toggle-cancel">
              Cancel lock
            </button>
            <button class="lock-zone lock-zone--danger${deleteClass}" type="button" data-action="toggle-delete">
              Delete lock
            </button>
          </div>
          <button class="mechanic-button lever-handle" type="button" data-action="release">
            Release lever
          </button>
          ${renderMeter(state)}
        </div>
      `
    }

    if (variant.id === 'hold-to-melt') {
      return `
        <div class="variant-stage hold-stage">
          <button class="mechanic-button melt-button" type="button" data-action="hold-start">
            ${state.isHolding ? 'Keep holding' : escapeHtml(variant.mechanic.buttonLabel)}
          </button>
          <div class="melt-meter" aria-hidden="true">
            <div class="melt-meter__fill" style="width: ${progress}"></div>
          </div>
          <p class="helper-copy">Press and hold to keep the fill moving.</p>
        </div>
      `
    }

    if (variant.id === 'trash-gate') {
      return `
        <div class="variant-stage gate-stage">
          <div class="trash-chip" style="transform: translateX(${state.progress * 1.4}px);">
            ${escapeHtml(ROOM_DATA.name)}
          </div>
          <div class="gate-track">
            <div class="gate-bin">Trash</div>
          </div>
          <button class="mechanic-button gate-push" type="button" data-action="advance">
            ${escapeHtml(variant.mechanic.buttonLabel)}
          </button>
          ${renderMeter(state)}
        </div>
      `
    }

    if (variant.id === 'fuse-pull') {
      return `
        <div class="variant-stage fuse-stage">
          <div class="fuse-line">
            <div class="fuse-line__burn" style="width: ${progress}"></div>
          </div>
          <button class="mechanic-button fuse-knot" type="button" data-action="advance">
            ${escapeHtml(variant.mechanic.buttonLabel)}
          </button>
          ${renderMeter(state)}
        </div>
      `
    }

    if (variant.id === 'stamp-crush') {
      return `
        <div class="variant-stage stamp-stage">
          <div class="stamp-pad${state.isDeleted ? ' is-stamped' : ''}">DELETE</div>
          <button class="mechanic-button stamp-block" type="button" data-action="advance">
            ${escapeHtml(variant.mechanic.buttonLabel)}
          </button>
        </div>
      `
    }

    if (variant.id === 'card-shred') {
      return `
        <div class="variant-stage shred-stage">
          <article class="shred-card">
            <div class="badge-row badge-row--compact">
              <span class="badge" data-tone="safe">${escapeHtml(ROOM_DATA.name)}</span>
              <span class="badge" data-tone="safe">Room card</span>
            </div>
            <div class="shred-line">
              <div class="shred-line__fill" style="width: ${progress}"></div>
            </div>
          </article>
          <button class="mechanic-button shred-blade" type="button" data-action="advance">
            ${escapeHtml(variant.mechanic.buttonLabel)}
          </button>
          ${renderMeter(state)}
        </div>
      `
    }

    if (variant.id === 'warning-dial') {
      return `
        <div class="variant-stage dial-stage">
          <div class="dial-face">
            <span>Safe</span>
            <span>Delete</span>
            <div class="dial-pointer" style="transform: rotate(${state.progress * 1.8 - 90}deg);"></div>
          </div>
          <button class="mechanic-button dial-knob" type="button" data-action="advance">
            ${escapeHtml(variant.mechanic.buttonLabel)}
          </button>
          ${renderMeter(state)}
        </div>
      `
    }

    return `
      <div class="variant-stage slam-stage">
        <div class="slam-slot">Slot</div>
        <button class="mechanic-button slam-block" type="button" data-action="advance">
          ${escapeHtml(variant.mechanic.buttonLabel)}
        </button>
      </div>
    `
  }

  function renderModal(state, variant) {
    if (!state.isOpen) {
      return ''
    }

    return `
      <div class="modal-backdrop is-open" data-backdrop>
        <section
          class="modal-card surface variant-family-${escapeHtml(variant.family)}"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div class="modal-top">
            <div class="modal-copy">
              <span class="sticker">Destructive confirm</span>
              <h2 class="modal-title" id="delete-confirm-title">Delete this room?</h2>
              <p class="note">${escapeHtml(variant.prompt)}</p>
            </div>
            <div class="badge-row">
              <span class="badge" data-tone="safe">Cancel stays visible</span>
              <span class="badge" data-tone="bold">Preview only</span>
            </div>
          </div>

          <div
            class="control-shell modal-control modal-control--${escapeHtml(variant.family)}"
            style="--accent: ${variant.accent}; --accent-soft: ${variant.accentSoft}; --progress: ${state.progress}%"
          >
            <div class="control-head">
              <span class="control-label">${escapeHtml(variant.option)} / ${escapeHtml(
                variant.title,
              )}</span>
              <span class="control-label">${escapeHtml(variant.actionHint)}</span>
            </div>
            ${renderVariantControl(state, variant)}
            <p class="helper-note">${escapeHtml(variant.helper)}</p>
            <div class="control-row">
              <button class="nav-link" type="button" data-action="close-modal">Cancel</button>
              <button class="nav-link nav-link--ghost" type="button" data-action="reset">
                Reset preview
              </button>
            </div>
          </div>
        </section>
      </div>
    `
  }

  function renderPreview(state, variant) {
    return `
      <div class="preview-stack">
        ${renderRoomCard(state)}
        ${renderResultCard(state, variant)}
        ${renderModal(state, variant)}
      </div>
    `
  }

  function initPreviewPage(doc = document) {
    const root = doc?.documentElement

    if (!root) {
      return null
    }

    root.dataset.previewPack = ROOT_DATASET_VALUE

    const body = doc.body
    const variantId = body?.dataset?.variant
    const mount = doc.querySelector('[data-demo-root]')

    if (!variantId || !mount) {
      return null
    }

    const controller = createPreviewController(variantId)
    let holdTimer = null

    function stopHold() {
      if (holdTimer) {
        clearInterval(holdTimer)
        holdTimer = null
      }

      controller.endHold()
    }

    function render(focusSelectors = []) {
      const state = controller.getState()
      const variant = controller.getVariant()
      mount.innerHTML = renderPreview(state, variant)

      for (const selector of focusSelectors) {
        const candidate = mount.querySelector(selector)

        if (candidate instanceof HTMLElement) {
          candidate.focus({ preventScroll: true })
          break
        }
      }
    }

    function startHold(focusSelectors = ['[data-action="hold-start"]', '[data-action="reset"]']) {
      stopHold()
      controller.beginHold()
      render(focusSelectors)

      holdTimer = setInterval(() => {
        controller.advanceHold()
        render(focusSelectors)

        if (controller.getState().isDeleted) {
          stopHold()
          render(['[data-action="reset"]'])
        }
      }, 150)
    }

    mount.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]')

      if (!target) {
        if (event.target === mount.querySelector('[data-backdrop]')) {
          stopHold()
          controller.closeModal()
          render()
        }
        return
      }

      const action = target.dataset.action

      stopHold()

      if (action === 'open-modal') {
        controller.openModal()
        render(['[data-action="close-modal"]', '[data-action="advance"]', '[data-action="hold-start"]'])
      } else if (action === 'close-modal') {
        controller.closeModal()
        render(['[data-action="open-modal"]'])
      } else if (action === 'advance') {
        controller.advance()
        render(['[data-action="advance"]', '[data-action="reset"]'])
      } else if (action === 'toggle-cancel') {
        controller.advance('cancel')
        render(['[data-action="toggle-cancel"]', '[data-action="release"]'])
      } else if (action === 'toggle-delete') {
        controller.advance('delete')
        render(['[data-action="toggle-delete"]', '[data-action="release"]'])
      } else if (action === 'release') {
        controller.advance('release')
        render(['[data-action="release"]', '[data-action="reset"]'])
      } else if (action === 'hold-start') {
        render(['[data-action="hold-start"]', '[data-action="reset"]'])
      } else if (action === 'reset') {
        controller.reset()
        render(['[data-action="open-modal"]'])
      } else {
        render()
      }
    })

    mount.addEventListener('pointerdown', (event) => {
      const target = event.target.closest('[data-action="hold-start"]')

      if (!target) {
        return
      }

      startHold()
    })

    doc.addEventListener('pointerup', () => {
      if (!holdTimer && !controller.getState().isHolding) {
        return
      }

      stopHold()
      render(['[data-action="hold-start"]', '[data-action="reset"]'])
    })

    doc.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        stopHold()
        controller.closeModal()
        render(['[data-action="open-modal"]'])
        return
      }

      const isHoldKey = event.key === ' ' || event.key === 'Enter'
      const isHoldTarget =
        doc.activeElement instanceof HTMLElement &&
        doc.activeElement.dataset.action === 'hold-start'

      if (isHoldKey && isHoldTarget && !event.repeat) {
        event.preventDefault()
        startHold()
      }
    })

    doc.addEventListener('keyup', (event) => {
      const isHoldKey = event.key === ' ' || event.key === 'Enter'

      if (!isHoldKey || (!holdTimer && !controller.getState().isHolding)) {
        return
      }

      stopHold()
      render(['[data-action="hold-start"]', '[data-action="reset"]'])
    })

    render()

    return controller
  }

  return {
    ROOM_DATA,
    VARIANT_CONFIG,
    closeModal,
    createPreviewController,
    initPreviewPage,
    openModal,
  }
})()

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DeleteConfirmPreview
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.DeleteConfirmPreview = DeleteConfirmPreview

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      DeleteConfirmPreview.initPreviewPage(document)
    })
  } else {
    DeleteConfirmPreview.initPreviewPage(document)
  }
}
