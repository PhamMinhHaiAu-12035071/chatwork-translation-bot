import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router'
import { Icon } from '~/components/atoms/icons'
import { BrutalCard } from '~/components/molecules/brutal-card'
import { DeleteRoomConfirmModal } from '~/components/organisms/delete-room-confirm-modal'
import { PageShell } from '~/components/layout/page-shell'
import { RoomStatusToggle } from '~/components/atoms/room-status-toggle'
import { StatusRibbon } from '~/components/atoms/status-ribbon'
import { RoomSkeletonList } from '~/components/organisms/room-skeleton'
import { SlideStackNumber } from '~/components/animation/slide-stack-number'
import { StatusPill } from '~/components/atoms/status-pill'
import { StickerLabel } from '~/components/atoms/sticker-label'
import { useToast } from '~/components/organisms/toast-provider'
import { ApiError } from '~/lib/api-client'
import type { DeleteRoomResult } from '~/lib/api-types'
import { useAsyncAction } from '~/hooks/use-async-action'
import { PROVIDER_LABELS, TRANSLATION_STYLE_LABELS } from '~/lib/provider-models'
import {
  selectDeleteRoom,
  selectDisableRoom,
  selectEnableRoom,
  selectFetchRooms,
  selectListError,
  selectListState,
  selectRooms,
  useRoomStore,
  type Room,
} from '~/stores/room-store'

const cardThemeByIndex = [
  'theme-card-lilac',
  'theme-card-matcha',
  'theme-card-cream',
  'theme-card-sky',
  'theme-card-peach',
  'theme-card-blush',
] as const

const tiltByIndex = ['left', 'flat', 'right', 'left', 'flat', 'right'] as const
const SPOTLIGHT_DURATION_MS = 2400

interface RoomListLocationState {
  spotlightRoomId?: string
}

export function getRoomToggleToastMessage(roomName: string, currentlyEnabled: boolean): string {
  return `"${roomName}" is now ${currentlyEnabled ? 'paused' : 'enabled'}`
}

export function getDeleteRoomToastMessage(
  roomName: string,
  outcome: DeleteRoomResult['outcome'],
): string {
  if (outcome === 'already_deleted') {
    return `Room "${roomName}" was already gone on Chatwork. Dashboard cleanup is complete`
  }

  return `Room "${roomName}" deleted from Chatwork and dashboard`
}

export function RoomListPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const { toast } = useToast()
  const rooms = useRoomStore(selectRooms)
  const listState = useRoomStore(selectListState)
  const listError = useRoomStore(selectListError)
  const fetchRooms = useRoomStore(selectFetchRooms)
  const enableRoom = useRoomStore(selectEnableRoom)
  const disableRoom = useRoomStore(selectDisableRoom)
  const deleteRoom = useRoomStore(selectDeleteRoom)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [spotlightRoomId, setSpotlightRoomId] = useState<string | null>(null)
  const roomToggleAction = useAsyncAction<undefined>({
    fallbackErrorMessage: 'Toggle failed',
    getErrorMessage: (error) => (error instanceof ApiError ? error.message : 'Toggle failed'),
  })
  const deleteRoomAction = useAsyncAction<DeleteRoomResult>({
    fallbackErrorMessage: 'Delete failed',
    getErrorMessage: (error) => (error instanceof ApiError ? error.message : 'Delete failed'),
  })

  useEffect(() => {
    if (listState === 'idle') {
      void fetchRooms()
    }
  }, [fetchRooms, listState])

  useEffect(() => {
    const routeState = (location.state ?? null) as RoomListLocationState | null
    if (!routeState?.spotlightRoomId) {
      return
    }

    setSpotlightRoomId(routeState.spotlightRoomId)
    void navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    if (!spotlightRoomId) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSpotlightRoomId(null)
    }, SPOTLIGHT_DURATION_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [reducedMotion, spotlightRoomId])

  const activeCount = rooms.filter((room) => room.enabled).length
  const inactiveCount = rooms.filter((room) => !room.enabled).length

  const handleToggle = async (id: string, roomName: string, currentlyEnabled: boolean) => {
    const result = await roomToggleAction.execute(async () => {
      if (currentlyEnabled) {
        await disableRoom(id)
      } else {
        await enableRoom(id)
      }

      return undefined
    })

    if (!result.ok) {
      toast(result.error, 'error')
      return
    }

    toast(getRoomToggleToastMessage(roomName, currentlyEnabled), 'info')
  }

  const handleConfirmDelete = async () => {
    if (!selectedRoom) return
    const room = selectedRoom

    const result = await deleteRoomAction.execute(async () => {
      return deleteRoom(room.id)
    })

    if (!result.ok) {
      toast(result.error, 'error')
      setSelectedRoom(null)
      return
    }

    toast(getDeleteRoomToastMessage(room.destinationRoomName, result.data.outcome), 'warning')
    setSelectedRoom(null)
  }

  return (
    <PageShell
      eyebrow="Room Dashboard"
      title="Translation Rooms"
      description="Manage all your Chatwork translation rooms. Toggle to pause, or set up a new webhook from the guide."
      actions={
        <>
          <button
            type="button"
            onClick={() => {
              void navigate('/rooms/new')
            }}
            className="brutal-button theme-button-violet inline-flex items-center gap-2 w-[10.5rem] py-3 font-heading text-sm font-bold text-white"
          >
            <Icon name="plus" variant="clay" size={20} aria-hidden />
            New Room
          </button>
          <button
            type="button"
            onClick={() => {
              void navigate('/guide')
            }}
            className="brutal-button theme-button-warm inline-flex items-center gap-2 w-[10.5rem] py-3 font-heading text-sm font-bold text-white"
          >
            <Icon name="book" variant="clay" size={20} aria-hidden />
            Webhook Guide
          </button>
        </>
      }
    >
      <div className="grid gap-4 xl:grid-cols-3">
        {[
          {
            label: 'Total Rooms',
            value: rooms.length,
            tone: 'accent' as const,
            theme: 'theme-card-lilac',
            tilt: 'left' as const,
          },
          {
            label: 'Active',
            value: activeCount,
            tone: 'success' as const,
            theme: 'theme-card-mint',
            tilt: 'flat' as const,
          },
          {
            label: 'Inactive',
            value: inactiveCount,
            tone: 'warning' as const,
            theme: 'theme-card-butter',
            tilt: 'right' as const,
          },
        ].map((stat) => (
          <BrutalCard
            key={stat.label}
            tilt={stat.tilt}
            className={[stat.theme, 'space-y-3'].join(' ')}
          >
            <StickerLabel tone={stat.tone}>{stat.label}</StickerLabel>
            <div className="text-4xl font-extrabold">
              <SlideStackNumber value={stat.value} minimumDigits={2} className="font-metric" />
            </div>
          </BrutalCard>
        ))}
      </div>

      {listState === 'loading' || listState === 'idle' ? <RoomSkeletonList count={6} /> : null}

      {listState === 'error' ? (
        <BrutalCard className="theme-card-blush space-y-3">
          <StickerLabel tone="warning">Error</StickerLabel>
          <p className="font-ui-body text-sm leading-7 text-[var(--text-secondary)]">{listError}</p>
          <button
            type="button"
            onClick={() => {
              void fetchRooms()
            }}
            className="brutal-button theme-button-warm px-4 py-2 font-heading text-sm font-bold text-white"
          >
            Retry
          </button>
        </BrutalCard>
      ) : null}

      {listState === 'success' && rooms.length === 0 ? (
        <BrutalCard className="theme-card-sky space-y-5">
          <StatusPill tone="warning">Empty State</StatusPill>
          <div className="space-y-3">
            <h2 className="font-heading text-3xl font-bold">Create your first translation room</h2>
            <p className="font-ui-body max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
              Set up your Chatwork source room, choose an AI provider, and configure translation
              preferences to get started.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigate('/rooms/new')
            }}
            className="brutal-button theme-button-violet inline-flex items-center gap-2 px-5 py-3 font-heading text-sm font-bold text-white"
          >
            <Icon name="plus" variant="clay" size={20} aria-hidden />
            Create First Room
          </button>
        </BrutalCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room, index) =>
            (() => {
              const isSpotlighted = room.id === spotlightRoomId
              const spotlightAnimate = isSpotlighted
                ? reducedMotion
                  ? {
                      backgroundColor: 'rgba(255, 225, 154, 0.92)',
                      boxShadow: '8px 8px 0 rgba(212, 68, 112, 0.92)',
                    }
                  : {
                      backgroundColor: [
                        'rgba(255, 225, 154, 0)',
                        'rgba(255, 225, 154, 0.96)',
                        'rgba(255, 225, 154, 0.28)',
                      ],
                      boxShadow: [
                        '0px 0px 0 rgba(212, 68, 112, 0)',
                        '8px 8px 0 rgba(212, 68, 112, 0.96)',
                        '4px 4px 0 rgba(212, 68, 112, 0.34)',
                      ],
                    }
                : {
                    backgroundColor: 'rgba(255, 225, 154, 0)',
                    boxShadow: '0px 0px 0 rgba(212, 68, 112, 0)',
                  }

              return (
                <motion.div
                  key={room.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    ...spotlightAnimate,
                  }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    duration: reducedMotion ? 0 : isSpotlighted ? 2.2 : 0.18,
                    delay: index * 0.04,
                    ease: 'easeOut',
                  }}
                  className="rounded-[24px] p-1"
                >
                  {(() => {
                    const cardTheme =
                      cardThemeByIndex[index % cardThemeByIndex.length] ?? 'theme-card-lilac'
                    const tilt = tiltByIndex[index % tiltByIndex.length] ?? 'flat'
                    const spotlightTheme = isSpotlighted
                      ? 'theme-card-butter border-[var(--pink-accent)] shadow-[8px_8px_0_var(--pink-accent)]'
                      : cardTheme

                    return (
                      <BrutalCard className={[spotlightTheme, 'space-y-4'].join(' ')} tilt={tilt}>
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <StatusRibbon enabled={room.enabled} />
                            <RoomStatusToggle
                              enabled={room.enabled}
                              loading={roomToggleAction.loading}
                              onToggle={() => {
                                void handleToggle(room.id, room.destinationRoomName, room.enabled)
                              }}
                            />
                          </div>
                          <div className="min-w-0 space-y-1">
                            {isSpotlighted ? (
                              <StickerLabel tone="warning" tilt="right">
                                New
                              </StickerLabel>
                            ) : null}
                            <div className="font-heading text-lg font-bold leading-tight">
                              {room.destinationRoomName}
                            </div>
                            <div className="font-ui-body text-xs text-[var(--text-secondary)]">
                              {`Room ID: ${String(room.originalRoomId)}`}
                            </div>
                          </div>
                        </div>

                        <div className="font-ui-body space-y-1.5 text-xs text-[var(--text-secondary)]">
                          <div>
                            <span className="font-semibold">Provider: </span>
                            {PROVIDER_LABELS[room.aiProvider]}
                            {room.aiModel ? ` · ${room.aiModel}` : ' · default model'}
                          </div>
                          <div>
                            <span className="font-semibold">Style: </span>
                            {TRANSLATION_STYLE_LABELS[room.translationStyle]}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              void navigate(`/rooms/${room.id}`)
                            }}
                            className="brutal-button theme-button-sky inline-flex items-center gap-2 px-4 py-1.5 font-heading text-xs font-bold text-[var(--border)]"
                          >
                            <Icon name="pencil" variant="clay" size={16} aria-hidden />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRoom(room)
                            }}
                            className="brutal-button theme-button-pink inline-flex items-center gap-2 px-4 py-1.5 font-heading text-xs font-bold text-[#fff7ed]"
                          >
                            <Icon name="trash" variant="clay" size={16} aria-hidden />
                            Delete
                          </button>
                        </div>
                      </BrutalCard>
                    )
                  })()}
                </motion.div>
              )
            })(),
          )}
        </div>
      )}

      {selectedRoom ? (
        <DeleteRoomConfirmModal
          room={selectedRoom}
          isOpen
          isDeleting={deleteRoomAction.loading}
          onCancel={() => {
            setSelectedRoom(null)
          }}
          onConfirm={() => {
            void handleConfirmDelete()
          }}
        />
      ) : null}
    </PageShell>
  )
}
