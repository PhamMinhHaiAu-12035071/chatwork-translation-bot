import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { AiProvider, TranslationStyle } from '~/lib/api-types'
import { PROVIDER_LABELS, TRANSLATION_STYLE_LABELS } from '~/lib/provider-models'
import { StatusPill } from '~/components/atoms/status-pill'
import { StickerLabel } from '~/components/atoms/sticker-label'

interface DeleteRoomPreview {
  id: string
  originalRoomId: number
  destinationRoomId: number
  destinationRoomName: string
  enabled: boolean
  aiProvider?: AiProvider
  aiModel?: string | null
  translationStyle?: TranslationStyle
  kagiStyle?: string
}

interface DeleteRoomConfirmModalProps {
  room: DeleteRoomPreview
  isOpen: boolean
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteRoomConfirmModal({
  room,
  isOpen,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteRoomConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${String(scrollbarWidth)}px`
    }

    cancelRef.current?.focus({ preventScroll: true })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const providerLabel =
    room.kagiStyle !== undefined
      ? 'Kagi Translate Free'
      : room.aiProvider !== undefined
        ? PROVIDER_LABELS[room.aiProvider]
        : 'Unknown'

  const styleLabel =
    room.kagiStyle ??
    (room.translationStyle ? TRANSLATION_STYLE_LABELS[room.translationStyle] : 'Unknown')

  const overlay = (
    <div className="delete-modal-overlay" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-description"
        className="delete-modal-shell"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <StickerLabel tone="warning" tilt="left">
          Danger Zone
        </StickerLabel>

        <h2 id="delete-modal-title" className="font-heading mt-4 text-2xl font-bold">
          Delete {room.destinationRoomName}?
        </h2>

        <p
          id="delete-modal-description"
          className="delete-modal-warning font-ui-body mt-2 text-sm leading-relaxed"
        >
          This action is permanent and cannot be undone.
        </p>

        <ul className="delete-modal-consequences mt-4 space-y-3">
          <li className="delete-modal-consequence-item">
            <span className="delete-modal-warn-dot" aria-hidden="true">
              !
            </span>
            <span className="font-ui-body text-sm leading-relaxed">
              Applies to everyone in the group chat, not just you.
            </span>
          </li>
          <li className="delete-modal-consequence-item">
            <span className="delete-modal-warn-dot" aria-hidden="true">
              !
            </span>
            <span className="font-ui-body text-sm leading-relaxed">
              All messages, tasks, files, and bookmarks will be lost.
            </span>
          </li>
        </ul>

        <div className="delete-modal-warning-panel mt-4">
          <div className="font-heading text-sm font-bold">Manual Cleanup Still Needed</div>
          <p className="font-ui-body mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
            Source-room webhook cleanup is still manual in Chatwork Admin. Deleting this destination
            room does not remove the webhook from the source room.
          </p>
        </div>

        <div className="delete-modal-preview mt-4">
          <div className="flex items-start justify-between gap-2">
            <div className="font-heading text-sm font-bold">{room.destinationRoomName}</div>
            <StatusPill tone={room.enabled ? 'success' : 'neutral'}>
              {room.enabled ? 'Live' : 'Paused'}
            </StatusPill>
          </div>
          <div className="font-ui-body mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
            <div>
              <span className="font-semibold">Room ID: </span>
              {String(room.originalRoomId)}
            </div>
            <div>
              <span className="font-semibold">Provider: </span>
              {providerLabel}
            </div>
            <div>
              <span className="font-semibold">Style: </span>
              {styleLabel}
            </div>
          </div>
        </div>

        <div className="delete-modal-actions mt-5 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="brutal-button px-5 py-2.5 font-heading text-sm font-bold text-[var(--border)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="brutal-button delete-modal-confirm px-5 py-2.5 font-heading text-sm font-bold text-white"
          >
            {isDeleting ? 'Deleting\u2026' : 'Delete Room'}
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(overlay, document.body)
  }

  return overlay
}
