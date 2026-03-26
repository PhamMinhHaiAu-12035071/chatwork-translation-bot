import { describe, expect, it } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DeleteRoomConfirmModal } from '~/components/organisms/delete-room-confirm-modal'

const TEST_ROOM = {
  id: 'room-001',
  originalRoomId: 123456789,
  destinationRoomId: 99001,
  destinationRoomName: 'Sakura Desk JP',
  aiProvider: 'openai' as const,
  aiModel: 'gpt-4o',
  translationStyle: 'PROFESSIONAL_BUSINESS' as const,
  enabled: true,
  createdAt: '2026-03-20T09:00:00Z',
  updatedAt: '2026-03-20T09:00:00Z',
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
    expect(html).toContain('Delete (I have confirmed)')
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
    expect(html).toContain('Please check the followings prior to deleting group chats')
    expect(html).toContain('Source-room webhook cleanup is still manual in Chatwork Admin')
  })

  it('renders the destructive checklist, warning panel, and mini room preview', () => {
    const html = renderToStaticMarkup(
      createElement(DeleteRoomConfirmModal, {
        room: TEST_ROOM,
        isOpen: true,
        isDeleting: false,
        onCancel: () => undefined,
        onConfirm: () => undefined,
      }),
    )

    expect(html.match(/type="checkbox"/g)?.length ?? 0).toBe(3)
    expect(html).toContain('applied for everyone else participating in the group chat')
    expect(html).toContain('All messages, tasks, files, and bookmarks will be deleted')
    expect(html).toContain('All deleted data will never be restored')
    expect(html).toContain('Sakura Desk JP')
    expect(html).toContain('123456789')
    expect(html).toContain('OpenAI')
    expect(html).toContain('Professional Business')
    expect(html).toContain('Delete (I have confirmed)')
    expect(html).toContain('disabled')
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
    expect(html).not.toContain('Delete (I have confirmed)')
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
    expect(source).toContain('createPortal')
    expect(source).toContain('document.body')
    expect(source).toContain('type="checkbox"')
    expect(source).toContain('Source-room webhook cleanup is still manual in Chatwork Admin')
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
