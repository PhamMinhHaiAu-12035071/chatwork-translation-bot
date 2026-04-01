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
import { useAsyncAction } from '~/hooks/use-async-action'
import type { DeleteRoomResult } from '~/lib/api-types'
import {
  selectDeleteFreeRoom,
  selectDisableFreeRoom,
  selectEnableFreeRoom,
  selectFetchFreeRooms,
  selectFreeListError,
  selectFreeListState,
  selectFreeRooms,
  useFreeRoomStore,
  type FreeRoom,
} from '~/stores/free-room-store'
import {
  getDeleteRoomToastMessage,
  getRoomCardIndex,
  getRoomToggleToastMessage,
} from '~/pages/room-list'

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

interface FreeRoomListLocationState {
  spotlightRoomId?: string
}

export function FreeRoomListPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const { toast } = useToast()
  const rooms = useFreeRoomStore(selectFreeRooms)
  const listState = useFreeRoomStore(selectFreeListState)
  const listError = useFreeRoomStore(selectFreeListError)
  const fetchFreeRooms = useFreeRoomStore(selectFetchFreeRooms)
  const enableFreeRoom = useFreeRoomStore(selectEnableFreeRoom)
  const disableFreeRoom = useFreeRoomStore(selectDisableFreeRoom)
  const deleteFreeRoom = useFreeRoomStore(selectDeleteFreeRoom)
  const [selectedRoom, setSelectedRoom] = useState<FreeRoom | null>(null)
  const [spotlightRoomId, setSpotlightRoomId] = useState<string | null>(null)
  const [spotlightPosition, setSpotlightPosition] = useState({ x: 50, y: 50 })
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
      void fetchFreeRooms()
    }
  }, [fetchFreeRooms, listState])

  useEffect(() => {
    const routeState = (location.state ?? null) as FreeRoomListLocationState | null
    if (!routeState?.spotlightRoomId) {
      return
    }

    setSpotlightRoomId(routeState.spotlightRoomId)
    void navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    if (!spotlightRoomId || reducedMotion) {
      return
    }

    let angle = 0
    const spotlightInterval = window.setInterval(() => {
      angle += 6

      const x = 50 + 40 * Math.cos((angle * Math.PI) / 180)
      const y = 50 + 40 * Math.sin((angle * Math.PI) / 180)
      setSpotlightPosition({ x, y })

      if (angle >= 360) {
        window.clearInterval(spotlightInterval)
      }
    }, 25)

    const timeoutId = window.setTimeout(() => {
      setSpotlightRoomId(null)
      window.clearInterval(spotlightInterval)
    }, SPOTLIGHT_DURATION_MS)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(spotlightInterval)
    }
  }, [reducedMotion, spotlightRoomId])

  const activeCount = rooms.filter((room) => room.enabled).length
  const inactiveCount = rooms.filter((room) => !room.enabled).length

  const handleToggle = async (id: string, roomName: string, currentlyEnabled: boolean) => {
    const targetState = !currentlyEnabled
    useFreeRoomStore.setState((state) => ({
      rooms: state.rooms.map((r) => (r.id === id ? { ...r, enabled: targetState } : r)),
    }))

    const result = await roomToggleAction.execute(async () => {
      if (currentlyEnabled) {
        await disableFreeRoom(id)
      } else {
        await enableFreeRoom(id)
      }

      return undefined
    })

    if (!result.ok) {
      useFreeRoomStore.setState((state) => ({
        rooms: state.rooms.map((r) => (r.id === id ? { ...r, enabled: currentlyEnabled } : r)),
      }))
      toast(result.error, 'error')
      return
    }

    toast(getRoomToggleToastMessage(roomName, targetState), 'info')
  }

  const handleConfirmDelete = async () => {
    if (!selectedRoom) return
    const room = selectedRoom

    const result = await deleteRoomAction.execute(async () => deleteFreeRoom(room.id))

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
      eyebrow="Free Room Dashboard"
      title="Free Translation Rooms"
      description="Manage all Kagi Translate free rooms. Keep the same Chatwork structure with a separate free provider surface."
      actions={
        <div className="flex w-full min-w-[min(100%,17.5rem)] flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              void navigate('/free-rooms/new')
            }}
            className="brutal-button theme-button-violet grid w-full grid-cols-[2.5rem_1fr] items-center gap-x-2 px-4 py-3 text-left font-heading text-sm font-bold text-white whitespace-nowrap"
          >
            <span
              className="flex size-6 items-center justify-center justify-self-center"
              aria-hidden
            >
              <Icon name="plus" variant="clay" size={24} aria-hidden />
            </span>
            <span>New Free Room</span>
          </button>
          <button
            type="button"
            onClick={() => {
              void navigate('/guide')
            }}
            className="brutal-button theme-button-warm grid w-full grid-cols-[2.5rem_1fr] items-center gap-x-2 px-4 py-3 text-left font-heading text-sm font-bold text-white whitespace-nowrap"
          >
            <span
              className="flex size-6 items-center justify-center justify-self-center"
              aria-hidden
            >
              <Icon name="book" variant="clay" size={24} aria-hidden />
            </span>
            <span>Webhook Guide</span>
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
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
            <p className="font-ui-body text-sm leading-7 text-[var(--text-secondary)]">
              {listError}
            </p>
            <button
              type="button"
              onClick={() => {
                void fetchFreeRooms()
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
              <h2 className="font-heading text-3xl font-bold">
                Create your first free translation room
              </h2>
              <p className="font-ui-body max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
                Set up your Chatwork source room, choose the Kagi free translation style, and add
                context or keyword protection if needed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void navigate('/free-rooms/new')
              }}
              className="brutal-button theme-button-violet inline-flex items-center gap-2.5 px-5 py-3 font-heading text-sm font-bold text-white"
            >
              <Icon name="plus" variant="clay" size={24} aria-hidden />
              Create First Room
            </button>
          </BrutalCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room) =>
              (() => {
                const isSpotlighted = room.id === spotlightRoomId

                return (
                  <div
                    key={room.id}
                    className="rounded-[24px] p-1"
                    style={{ position: 'relative' }}
                  >
                    {(() => {
                      const roomIdx = getRoomCardIndex(room.id)
                      const cardTheme = cardThemeByIndex[roomIdx] ?? 'theme-card-lilac'
                      const tilt = tiltByIndex[roomIdx] ?? 'flat'

                      return (
                        <div className="relative">
                          {isSpotlighted && !reducedMotion ? (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.3, delay: 0.5 }}
                              style={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '18px',
                                background: `radial-gradient(circle at ${String(spotlightPosition.x)}% ${String(spotlightPosition.y)}%, rgba(255, 225, 154, 0.9), transparent 40%)`,
                                mixBlendMode: 'overlay',
                                pointerEvents: 'none',
                                zIndex: 1,
                              }}
                            />
                          ) : null}
                          {isSpotlighted ? (
                            <motion.div
                              className="absolute"
                              style={{
                                top: '-10px',
                                right: '20px',
                                zIndex: 10,
                                transformOrigin: 'center center',
                              }}
                              initial={
                                reducedMotion
                                  ? { opacity: 1 }
                                  : {
                                      opacity: 0,
                                      y: 40,
                                      scale: 0.7,
                                    }
                              }
                              animate={
                                reducedMotion
                                  ? { opacity: 1 }
                                  : {
                                      opacity: 1,
                                      y: 0,
                                      scale: 1,
                                    }
                              }
                              exit={
                                reducedMotion
                                  ? { opacity: 0 }
                                  : {
                                      opacity: 0,
                                      y: 40,
                                      scale: 0.7,
                                    }
                              }
                              transition={{
                                duration: reducedMotion ? 0 : 0.6,
                                delay: reducedMotion ? 0 : 0.3,
                                ease: [0.34, 1.56, 0.64, 1],
                              }}
                            >
                              <StickerLabel tone="warning" tilt="right">
                                New
                              </StickerLabel>
                            </motion.div>
                          ) : null}
                          <BrutalCard
                            className={[cardTheme, 'flex flex-col gap-4'].join(' ')}
                            tilt={tilt}
                          >
                            <div className="space-y-2">
                              <div className="flex min-w-0 items-start justify-between gap-4">
                                <StatusRibbon enabled={room.enabled} />
                                <RoomStatusToggle
                                  enabled={room.enabled}
                                  loading={roomToggleAction.loading}
                                  onToggle={() => {
                                    void handleToggle(
                                      room.id,
                                      room.destinationRoomName,
                                      room.enabled,
                                    )
                                  }}
                                />
                              </div>
                              <div className="min-w-0 space-y-1">
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
                                Kagi Translate Free
                              </div>
                              <div>
                                <span className="font-semibold">Style: </span>
                                {room.kagiStyle}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  void navigate(`/free-rooms/${room.id}`)
                                }}
                                className="brutal-button theme-button-sky inline-flex items-center gap-2 px-4 py-1.5 font-heading text-xs font-bold text-[var(--border)]"
                              >
                                <Icon name="pencil" variant="clay" size={20} aria-hidden />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRoom(room)
                                }}
                                className="brutal-button theme-button-pink inline-flex items-center gap-2 px-4 py-1.5 font-heading text-xs font-bold text-[#fff7ed]"
                              >
                                <Icon name="trash" variant="clay" size={20} aria-hidden />
                                Delete
                              </button>
                            </div>
                          </BrutalCard>
                        </div>
                      )
                    })()}
                  </div>
                )
              })(),
            )}
          </div>
        )}
      </div>

      {selectedRoom ? (
        <DeleteRoomConfirmModal
          room={{ ...selectedRoom, kagiStyle: selectedRoom.kagiStyle }}
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
