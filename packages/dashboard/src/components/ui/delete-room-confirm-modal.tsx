import { useEffect, useRef } from 'react'
import type { Room } from '~/stores/room-store'
import { PROVIDER_LABELS, TRANSLATION_STYLE_LABELS } from '~/lib/provider-models'
import { StatusPill } from '~/components/ui/status-pill'
import { StickerLabel } from '~/components/ui/sticker-label'

interface DeleteRoomConfirmModalProps {
  room: Room
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

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    cancelRef.current?.focus({ preventScroll: true })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
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
          Delete Check
        </StickerLabel>

        <h2 id="delete-modal-title" className="font-heading mt-4 text-2xl font-bold">
          Delete {room.destinationRoomName}?
        </h2>

        <p
          id="delete-modal-description"
          className="delete-modal-warning font-ui-body mt-2 text-sm leading-relaxed"
        >
          This removes the room from your dashboard immediately. This action cannot be undone.
        </p>

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
              {PROVIDER_LABELS[room.aiProvider]}
            </div>
            <div>
              <span className="font-semibold">Style: </span>
              {TRANSLATION_STYLE_LABELS[room.translationStyle]}
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
            {isDeleting ? 'Deleting\u2026' : 'Confirm Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
