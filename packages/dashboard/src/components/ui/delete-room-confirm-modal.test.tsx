import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DeleteRoomConfirmModal } from '~/components/ui/delete-room-confirm-modal'

const TEST_ROOM = {
  id: 'room-001',
  originalRoomId: 123456789,
  destinationRoomName: 'Sakura Desk JP',
  aiProvider: 'openai' as const,
  aiModel: 'gpt-4o',
  translationStyle: 'PROFESSIONAL_BUSINESS' as const,
  aiApiToken: 'sk-test-001',
  webhookToken: 'cw-token-abc123',
  enabled: true,
  createdAt: '2026-03-20T09:00:00Z',
}

describe('DeleteRoomConfirmModal', () => {
  it('renders the dialog contract for the delete confirmation state', () => {
    const html = renderToStaticMarkup(
      createElement(DeleteRoomConfirmModal, {
        room: TEST_ROOM,
        isOpen: true,
        isDeleting: false,
        onCancel: () => undefined,
        onConfirm: () => undefined,
      }),
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('Cancel')
    expect(html).toContain('Confirm Delete')
    expect(html).toContain('Room ID')
    expect(html).toContain('Provider')
    expect(html).toContain('Style')
  })

  it('renders the sticker label, destructive title, and warning copy', () => {
    const html = renderToStaticMarkup(
      createElement(DeleteRoomConfirmModal, {
        room: TEST_ROOM,
        isOpen: true,
        isDeleting: false,
        onCancel: () => undefined,
        onConfirm: () => undefined,
      }),
    )

    expect(html).toContain('Delete Check')
    expect(html).toContain('Delete Sakura Desk JP?')
    expect(html).toContain('This removes the room from your dashboard immediately')
    expect(html).toContain('This action cannot be undone')
  })

  it('renders the mini room preview with room metadata', () => {
    const html = renderToStaticMarkup(
      createElement(DeleteRoomConfirmModal, {
        room: TEST_ROOM,
        isOpen: true,
        isDeleting: false,
        onCancel: () => undefined,
        onConfirm: () => undefined,
      }),
    )

    expect(html).toContain('Sakura Desk JP')
    expect(html).toContain('123456789')
    expect(html).toContain('OpenAI')
    expect(html).toContain('Professional Business')
  })

  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      createElement(DeleteRoomConfirmModal, {
        room: TEST_ROOM,
        isOpen: false,
        isDeleting: false,
        onCancel: () => undefined,
        onConfirm: () => undefined,
      }),
    )

    expect(html).toBe('')
  })

  it('shows deleting state on the confirm button', () => {
    const html = renderToStaticMarkup(
      createElement(DeleteRoomConfirmModal, {
        room: TEST_ROOM,
        isOpen: true,
        isDeleting: true,
        onCancel: () => undefined,
        onConfirm: () => undefined,
      }),
    )

    expect(html).toContain('Deleting')
    expect(html).not.toContain('Confirm Delete')
  })

  it('wires dialog accessibility semantics and close behavior in the source', async () => {
    const source = await Bun.file(
      new URL('./delete-room-confirm-modal.tsx', import.meta.url),
    ).text()

    expect(source).toContain('aria-labelledby')
    expect(source).toContain('aria-describedby')
    expect(source).toContain('onCancel')
    expect(source).toContain('useEffect')
    expect(source).toContain('Escape')
    expect(source).toContain('useRef')
  })

  it('applies the modal visual class hooks for overlay, shell, warning, preview, and actions', () => {
    const html = renderToStaticMarkup(
      createElement(DeleteRoomConfirmModal, {
        room: TEST_ROOM,
        isOpen: true,
        isDeleting: false,
        onCancel: () => undefined,
        onConfirm: () => undefined,
      }),
    )

    expect(html).toContain('delete-modal-overlay')
    expect(html).toContain('delete-modal-shell')
    expect(html).toContain('delete-modal-warning')
    expect(html).toContain('delete-modal-preview')
    expect(html).toContain('delete-modal-actions')
  })
})
