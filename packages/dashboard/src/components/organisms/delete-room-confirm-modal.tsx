import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Room } from '~/stores/room-store'
import { PROVIDER_LABELS, TRANSLATION_STYLE_LABELS } from '~/lib/provider-models'
import { StatusPill } from '~/components/atoms/status-pill'
import { StickerLabel } from '~/components/atoms/sticker-label'

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
  const [confirmEveryone, setConfirmEveryone] = useState(false)
  const [confirmContentLoss, setConfirmContentLoss] = useState(false)
  const [confirmIrreversible, setConfirmIrreversible] = useState(false)

  const allConfirmed = confirmEveryone && confirmContentLoss && confirmIrreversible

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

  useEffect(() => {
    if (!isOpen) return

    setConfirmEveryone(false)
    setConfirmContentLoss(false)
    setConfirmIrreversible(false)
  }, [isOpen, room.id])

  if (!isOpen) return null

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
          Delete Check
        </StickerLabel>

        <h2 id="delete-modal-title" className="font-heading mt-4 text-2xl font-bold">
          Delete {room.destinationRoomName}?
        </h2>

        <p
          id="delete-modal-description"
          className="delete-modal-warning font-ui-body mt-2 text-sm leading-relaxed"
        >
          Please check the followings prior to deleting group chats.
        </p>

        <div className="delete-modal-checklist mt-4 space-y-3">
          <label className="delete-modal-checkitem">
            <input
              type="checkbox"
              checked={confirmEveryone}
              onChange={(event) => {
                setConfirmEveryone(event.currentTarget.checked)
              }}
              className="delete-modal-checkbox"
            />
            <span className="font-ui-body text-sm leading-relaxed">
              This will not only delete from your list, but will be applied for everyone else
              participating in the group chat.
            </span>
          </label>

          <label className="delete-modal-checkitem">
            <input
              type="checkbox"
              checked={confirmContentLoss}
              onChange={(event) => {
                setConfirmContentLoss(event.currentTarget.checked)
              }}
              className="delete-modal-checkbox"
            />
            <span className="font-ui-body text-sm leading-relaxed">
              All messages, tasks, files, and bookmarks will be deleted.
            </span>
          </label>

          <label className="delete-modal-checkitem">
            <input
              type="checkbox"
              checked={confirmIrreversible}
              onChange={(event) => {
                setConfirmIrreversible(event.currentTarget.checked)
              }}
              className="delete-modal-checkbox"
            />
            <span className="font-ui-body text-sm leading-relaxed">
              All deleted data will never be restored.
            </span>
          </label>
        </div>

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
            disabled={isDeleting || !allConfirmed}
            className="brutal-button delete-modal-confirm px-5 py-2.5 font-heading text-sm font-bold text-white"
          >
            {isDeleting ? 'Deleting\u2026' : 'Delete (I have confirmed)'}
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
