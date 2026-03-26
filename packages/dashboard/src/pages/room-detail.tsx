import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import { BrutalCard } from '~/components/molecules/brutal-card'
import { BrutalInput } from '~/components/atoms/brutal-input'
import { BrutalSelect } from '~/components/atoms/brutal-select'
import { PageShell } from '~/components/layout/page-shell'
import { PixelScatterText } from '~/components/animation/pixel-scatter-text'
import { RoomSkeletonCard } from '~/components/organisms/room-skeleton'
import { StatusPill } from '~/components/atoms/status-pill'
import { StickerLabel } from '~/components/atoms/sticker-label'
import { useToast } from '~/components/organisms/toast-provider'
import { useAsyncAction } from '~/hooks/use-async-action'
import { useCopyClipboard } from '~/hooks/use-copy-clipboard'
import { ApiError } from '~/lib/api-client'
import { PROVIDER_LABELS, PROVIDER_MODELS, TRANSLATION_STYLE_LABELS } from '~/lib/provider-models'
import { AI_PROVIDERS, TRANSLATION_STYLES, roomEditSchema } from '~/lib/room-schema'
import type { RoomEditInput } from '~/lib/room-schema'
import {
  selectDisableRoom,
  selectEnableRoom,
  selectFetchRooms,
  selectListState,
  selectRoomById,
  selectUpdateRoom,
  useRoomStore,
  type Room,
} from '~/stores/room-store'

const providerOptions = AI_PROVIDERS.map((provider) => ({
  value: provider,
  label: PROVIDER_LABELS[provider],
}))

const styleOptions = TRANSLATION_STYLES.map((style) => ({
  value: style,
  label: TRANSLATION_STYLE_LABELS[style],
}))

const roomEditResolver = zodResolver(roomEditSchema as never) as Resolver<RoomEditInput>

function generateWebhookUrl(roomId: string): string {
  const base =
    typeof window !== 'undefined' ? window.location.origin : 'https://your-server.example.com'

  return `${base}/api/webhook?room_id=${roomId}`
}

export function getRoomUpdatedToastMessage(roomName: string): string {
  return `"${roomName}" was updated successfully`
}

export function RoomDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const room = useRoomStore(selectRoomById(id))
  const listState = useRoomStore(selectListState)
  const fetchRooms = useRoomStore(selectFetchRooms)
  const updateRoom = useRoomStore(selectUpdateRoom)
  const enableRoom = useRoomStore(selectEnableRoom)
  const disableRoom = useRoomStore(selectDisableRoom)
  const { copied, copy } = useCopyClipboard()
  const updateRoomAction = useAsyncAction<Room>({
    fallbackErrorMessage: 'Update failed',
    getErrorMessage: (error) => (error instanceof ApiError ? error.message : 'Update failed'),
  })
  const roomStatusAction = useAsyncAction<undefined>({
    fallbackErrorMessage: 'Failed',
    getErrorMessage: (error) => (error instanceof ApiError ? error.message : 'Failed'),
  })

  const editDefaults: RoomEditInput = room
    ? {
        originalRoomId: room.originalRoomId,
        destinationRoomName: room.destinationRoomName,
        aiProvider: room.aiProvider,
        aiModel: room.aiModel ?? '',
        translationStyle: room.translationStyle,
        aiApiToken: '',
        webhookSecret: '',
      }
    : {
        originalRoomId: 0,
        destinationRoomName: '',
        aiProvider: 'openai',
        aiModel: '',
        translationStyle: 'AUTO_CONTEXT',
        aiApiToken: '',
        webhookSecret: '',
      }

  const editForm = useForm<RoomEditInput>({
    resolver: roomEditResolver,
    defaultValues: editDefaults,
  })

  useEffect(() => {
    if (!room && listState === 'idle') {
      void fetchRooms()
    }
  }, [fetchRooms, listState, room])

  useEffect(() => {
    if (!room) {
      return
    }

    editForm.reset({
      originalRoomId: room.originalRoomId,
      destinationRoomName: room.destinationRoomName,
      aiProvider: room.aiProvider,
      aiModel: room.aiModel ?? '',
      translationStyle: room.translationStyle,
      aiApiToken: '',
      webhookSecret: '',
    })
  }, [editForm, room])

  if ((listState === 'loading' || listState === 'idle') && !room) {
    return (
      <PageShell eyebrow="Loading…" title="Room Detail" description="">
        <RoomSkeletonCard />
      </PageShell>
    )
  }

  if (!room) {
    return (
      <PageShell eyebrow="Not Found" title="Room not found" description="">
        <BrutalCard className="theme-card-peach space-y-4">
          <p className="font-ui-body text-sm text-[var(--text-secondary)]">
            No room with ID <code>{id}</code> was found.
          </p>
          <button
            type="button"
            onClick={() => {
              void navigate('/')
            }}
            className="brutal-button theme-button-violet px-5 py-2.5 font-heading text-sm font-bold text-white"
          >
            ← Back to Dashboard
          </button>
        </BrutalCard>
      </PageShell>
    )
  }

  const selectedProvider = editForm.watch('aiProvider')
  const modelOptions = [
    { value: '', label: 'Default model' },
    ...PROVIDER_MODELS[selectedProvider].map((model) => ({
      value: model.value,
      label: model.label,
    })),
  ]

  const aiProviderField = editForm.register('aiProvider', {
    onChange: () => {
      editForm.setValue('aiModel', '')
    },
  })

  const webhookUrl = generateWebhookUrl(String(room.originalRoomId))

  const onEditSubmit = async (data: RoomEditInput) => {
    const normalizedAiModel = data.aiModel === '' ? null : data.aiModel

    const result = await updateRoomAction.execute(() =>
      updateRoom(room.id, {
        destinationRoomName: data.destinationRoomName,
        aiProvider: data.aiProvider,
        aiModel: normalizedAiModel,
        translationStyle: data.translationStyle,
        ...(data.aiApiToken !== '' ? { aiApiToken: data.aiApiToken } : {}),
        ...(data.webhookSecret !== '' ? { webhookSecret: data.webhookSecret } : {}),
      }),
    )

    if (!result.ok) {
      toast(result.error, 'error')
      return
    }

    toast(getRoomUpdatedToastMessage(data.destinationRoomName), 'info')
  }

  const handleRoomStatusToggle = async () => {
    const result = await roomStatusAction.execute(async () => {
      if (room.enabled) {
        await disableRoom(room.id)
      } else {
        await enableRoom(room.id)
      }

      return undefined
    })

    if (!result.ok) {
      toast(result.error, 'error')
      return
    }

    const message = `"${room.destinationRoomName}" is now ${room.enabled ? 'paused' : 'enabled'}`
    toast(message, 'info')
  }

  return (
    <PageShell
      eyebrow="Room Detail"
      title={room.destinationRoomName}
      description="Edit room configuration, update secrets, or manage live translation status."
      actions={
        <StatusPill tone={room.enabled ? 'success' : 'warning'}>
          <PixelScatterText value={room.enabled ? 'Live' : 'Inactive'} reserveText="Inactive" />
        </StatusPill>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <form
          onSubmit={(event) => {
            void editForm.handleSubmit(onEditSubmit)(event)
          }}
          noValidate
        >
          <BrutalCard className="theme-card-sky space-y-5" tilt="left">
            <div className="flex flex-wrap items-center gap-3">
              <StickerLabel tone="accent">Room Config</StickerLabel>
              <span className="inline-flex items-center gap-1.5 rounded-full border-[3px] border-[var(--border)] bg-[var(--warning)] px-4 py-1.5 font-heading text-xs font-bold text-[var(--border)] shadow-[3px_3px_0_var(--border)]">
                <span className="opacity-60">#</span>
                {room.id}
              </span>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <BrutalInput
                label="Original Room ID"
                type="text"
                inputMode="numeric"
                error={editForm.formState.errors.originalRoomId?.message}
                {...editForm.register('originalRoomId', {
                  setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                })}
              />
              <BrutalInput
                label="Destination Room Name"
                type="text"
                error={editForm.formState.errors.destinationRoomName?.message}
                {...editForm.register('destinationRoomName')}
              />
              <BrutalSelect
                label="AI Provider"
                options={providerOptions}
                colorVariant="accent"
                error={editForm.formState.errors.aiProvider?.message}
                {...aiProviderField}
              />
              <BrutalSelect
                label="AI Model"
                options={modelOptions}
                colorVariant="mint"
                error={editForm.formState.errors.aiModel?.message}
                {...editForm.register('aiModel')}
              />
              <BrutalSelect
                label="Translation Style"
                options={styleOptions}
                colorVariant="peach"
                error={editForm.formState.errors.translationStyle?.message}
                {...editForm.register('translationStyle')}
              />
              <BrutalInput
                label="AI API Token"
                type="password"
                hint="Leave unchanged to keep the existing token."
                error={editForm.formState.errors.aiApiToken?.message}
                {...editForm.register('aiApiToken')}
              />
              <BrutalInput
                label="Webhook Secret"
                type="password"
                hint="Leave blank to keep existing. Paste new secret to update."
                error={editForm.formState.errors.webhookSecret?.message}
                {...editForm.register('webhookSecret')}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  void navigate('/')
                }}
                className="brutal-button theme-button-warm px-6 py-3 font-heading text-sm font-bold text-white"
              >
                ← Back
              </button>
              <button
                type="submit"
                className="brutal-button theme-button-violet px-6 py-3 font-heading text-sm font-bold text-white"
              >
                Save Changes
              </button>
            </div>
          </BrutalCard>
        </form>

        <div className="space-y-5">
          <BrutalCard className="theme-card-peach space-y-4" tilt="right">
            <StickerLabel tone={room.enabled ? 'success' : 'warning'} tilt="right">
              <PixelScatterText
                value={room.enabled ? 'Webhook Live' : 'Webhook Ready'}
                reserveText="Webhook Ready"
              />
            </StickerLabel>

            <div className="space-y-2">
              <div className="font-ui-body text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                Webhook URL
              </div>
              <div className="brutal-input flex items-center gap-3 px-4 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                  🔗
                </span>
                <code className="flex-1 truncate font-['Shantell_Sans',cursive] text-xs font-medium text-[var(--text-primary)]">
                  {webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void copy(webhookUrl)
                  }}
                  className={[
                    'brutal-button shrink-0 min-w-[80px] px-4 py-1.5 text-center font-heading text-xs font-bold',
                    copied ? 'theme-button-matcha text-white' : 'theme-button-violet text-white',
                  ].join(' ')}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <p className="font-ui-body text-sm leading-7 text-[var(--text-secondary)]">
              Copy this URL into Chatwork when configuring the webhook, then use the room status
              controls below to pause or resume translation delivery.
            </p>

            <button
              type="button"
              onClick={() => {
                void navigate('/guide')
              }}
              className="brutal-button theme-button-sky px-4 py-2 font-heading text-xs font-bold text-[var(--border)]"
            >
              View Webhook Guide →
            </button>
          </BrutalCard>

          <BrutalCard className="theme-card-cream space-y-4">
            <StickerLabel tone={room.enabled ? 'success' : 'warning'}>Room Status</StickerLabel>
            <p className="font-ui-body text-sm leading-7 text-[var(--text-secondary)]">
              {room.enabled
                ? 'Room is enabled. Translation is active for incoming webhooks.'
                : 'Room is disabled. Enable to start receiving translations.'}
            </p>
            <button
              type="button"
              disabled={roomStatusAction.loading}
              onClick={() => {
                void handleRoomStatusToggle()
              }}
              className={[
                'brutal-button w-full py-3 font-heading text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60',
                room.enabled ? 'theme-button-warm text-white' : 'theme-button-violet text-white',
              ].join(' ')}
            >
              <PixelScatterText
                value={room.enabled ? 'Disable Room' : 'Enable Room'}
                reserveText="Disable Room"
              />
            </button>
          </BrutalCard>
        </div>
      </div>
    </PageShell>
  )
}
