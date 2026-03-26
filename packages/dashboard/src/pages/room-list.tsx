import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router'
import { BrutalCard } from '~/components/ui/brutal-card'
import { DeleteRoomConfirmModal } from '~/components/ui/delete-room-confirm-modal'
import { PageShell } from '~/components/ui/page-shell'
import { PixelScatterText } from '~/components/ui/pixel-scatter-text'
import { SlideStackNumber } from '~/components/ui/slide-stack-number'
import { StatusPill } from '~/components/ui/status-pill'
import { StickerLabel } from '~/components/ui/sticker-label'
import { useToast } from '~/components/ui/toast-provider'
import { PROVIDER_LABELS, TRANSLATION_STYLE_LABELS } from '~/lib/provider-models'
import { useRoomStore, type Room } from '~/stores/room-store'

const cardThemeByIndex = [
  'theme-card-lilac',
  'theme-card-matcha',
  'theme-card-cream',
  'theme-card-sky',
  'theme-card-peach',
  'theme-card-blush',
] as const

const tiltByIndex = ['left', 'flat', 'right', 'left', 'flat', 'right'] as const

export function getRoomToggleToastMessage(roomName: string, currentlyEnabled: boolean): string {
  return `"${roomName}" is now ${currentlyEnabled ? 'paused' : 'enabled'}`
}

export function RoomListPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const rooms = useRoomStore((state) => state.rooms)
  const toggleRoom = useRoomStore((state) => state.toggleRoom)
  const deleteRoom = useRoomStore((state) => state.deleteRoom)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)

  const activeCount = rooms.filter((room) => room.enabled).length
  const pendingWebhook = rooms.filter((room) => !room.webhookToken).length

  const handleToggle = (id: string, roomName: string, currentlyEnabled: boolean) => {
    toggleRoom(id)
    toast(getRoomToggleToastMessage(roomName, currentlyEnabled), 'info')
  }

  const handleConfirmDelete = () => {
    if (!selectedRoom) return
    deleteRoom(selectedRoom.id)
    toast(`Room "${selectedRoom.destinationRoomName}" deleted`, 'warning')
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
            className="brutal-button theme-button-violet px-5 py-3 font-heading text-sm font-bold text-white"
          >
            + New Room
          </button>
          <button
            type="button"
            onClick={() => {
              void navigate('/guide')
            }}
            className="brutal-button theme-button-warm px-5 py-3 font-heading text-sm font-bold text-white"
          >
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
            label: 'Awaiting Webhook',
            value: pendingWebhook,
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

      {rooms.length === 0 ? (
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
            className="brutal-button theme-button-violet px-5 py-3 font-heading text-sm font-bold text-white"
          >
            + Create First Room
          </button>
        </BrutalCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room, index) => (
            <motion.div
              key={room.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18, delay: index * 0.04 }}
            >
              {(() => {
                const cardTheme =
                  cardThemeByIndex[index % cardThemeByIndex.length] ?? 'theme-card-lilac'
                const tilt = tiltByIndex[index % tiltByIndex.length] ?? 'flat'

                return (
                  <BrutalCard className={[cardTheme, 'space-y-4'].join(' ')} tilt={tilt}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="font-heading text-lg font-bold leading-tight">
                          {room.destinationRoomName}
                        </div>
                        <div className="font-ui-body text-xs text-[var(--text-secondary)]">
                          {`Room ID: ${String(room.originalRoomId)}`}
                        </div>
                      </div>
                      <StatusPill
                        tone={room.enabled ? 'success' : 'neutral'}
                        className="min-w-24 justify-center shrink-0"
                      >
                        <PixelScatterText
                          value={room.enabled ? 'Live' : 'Paused'}
                          reserveText="Paused"
                        />
                      </StatusPill>
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
                      {!room.webhookToken ? (
                        <StatusPill tone="warning">Webhook not configured</StatusPill>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          void navigate(`/rooms/${room.id}`)
                        }}
                        className="brutal-button theme-button-sky px-4 py-1.5 font-heading text-xs font-bold text-[var(--border)]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleToggle(room.id, room.destinationRoomName, room.enabled)
                        }}
                        className={[
                          'brutal-button px-4 py-1.5 font-heading text-xs font-bold',
                          room.enabled
                            ? 'theme-button-gold text-[var(--border)]'
                            : 'theme-button-violet text-white',
                        ].join(' ')}
                      >
                        <PixelScatterText
                          value={room.enabled ? 'Pause' : 'Enable'}
                          reserveText="Enable"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRoom(room)
                        }}
                        className="brutal-button theme-button-pink px-4 py-1.5 font-heading text-xs font-bold text-[#fff7ed]"
                      >
                        Delete
                      </button>
                    </div>
                  </BrutalCard>
                )
              })()}
            </motion.div>
          ))}
        </div>
      )}

      {selectedRoom ? (
        <DeleteRoomConfirmModal
          room={selectedRoom}
          isOpen
          isDeleting={false}
          onCancel={() => {
            setSelectedRoom(null)
          }}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </PageShell>
  )
}
