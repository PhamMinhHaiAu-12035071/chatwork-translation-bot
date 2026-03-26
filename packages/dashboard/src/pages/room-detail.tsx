import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import { BrutalCard } from '~/components/ui/brutal-card'
import { BrutalInput } from '~/components/ui/brutal-input'
import { BrutalSelect } from '~/components/ui/brutal-select'
import { PageShell } from '~/components/ui/page-shell'
import { PixelScatterText } from '~/components/ui/pixel-scatter-text'
import { StatusPill } from '~/components/ui/status-pill'
import { StickerLabel } from '~/components/ui/sticker-label'
import { useToast } from '~/components/ui/toast-provider'
import { PROVIDER_LABELS, PROVIDER_MODELS, TRANSLATION_STYLE_LABELS } from '~/lib/provider-models'
import {
  AI_PROVIDERS,
  TRANSLATION_STYLES,
  roomEditSchema,
  webhookActivationSchema,
} from '~/lib/room-schema'
import type { RoomEditInput, WebhookActivationInput } from '~/lib/room-schema'
import { useRoomStore } from '~/stores/room-store'

const providerOptions = AI_PROVIDERS.map((provider) => ({
  value: provider,
  label: PROVIDER_LABELS[provider],
}))

const styleOptions = TRANSLATION_STYLES.map((style) => ({
  value: style,
  label: TRANSLATION_STYLE_LABELS[style],
}))

const roomEditResolver = zodResolver(roomEditSchema as never) as Resolver<RoomEditInput>
const webhookActivationResolver = zodResolver(
  webhookActivationSchema as never,
) as Resolver<WebhookActivationInput>

function generateWebhookUrl(roomId: string): string {
  const base =
    typeof window !== 'undefined' ? window.location.origin : 'https://your-server.example.com'

  return `${base}/api/webhook?room_id=${roomId}`
}

export function getRoomUpdatedToastMessage(roomName: string): string {
  return `"${roomName}" was updated successfully`
}

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const room = useRoomStore((state) => state.rooms.find((candidate) => candidate.id === id))
  const updateRoom = useRoomStore((state) => state.updateRoom)
  const activateWebhook = useRoomStore((state) => state.activateWebhook)
  const editDefaults: RoomEditInput = room
    ? {
        originalRoomId: room.originalRoomId,
        destinationRoomName: room.destinationRoomName,
        aiProvider: room.aiProvider,
        aiModel: room.aiModel ?? '',
        translationStyle: room.translationStyle,
        aiApiToken: room.aiApiToken,
      }
    : {
        originalRoomId: 0,
        destinationRoomName: '',
        aiProvider: 'openai',
        aiModel: '',
        translationStyle: 'AUTO_CONTEXT',
        aiApiToken: '',
      }

  const editForm = useForm<RoomEditInput>({
    resolver: roomEditResolver,
    defaultValues: editDefaults,
  })

  const activationForm = useForm<WebhookActivationInput>({
    resolver: webhookActivationResolver,
    defaultValues: {
      webhookToken: '',
    },
  })

  const [copied, setCopied] = useState(false)

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

  const handleCopyUrl = async () => {
    const clipboard = navigator.clipboard as
      | { writeText?: (value: string) => Promise<void> }
      | undefined

    if (!clipboard?.writeText) {
      return
    }

    await clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  const onEditSubmit = (data: RoomEditInput) => {
    const normalizedAiModel = data.aiModel === '' || data.aiModel == null ? null : data.aiModel

    updateRoom(room.id, {
      ...data,
      aiModel: normalizedAiModel,
    })
    toast(getRoomUpdatedToastMessage(data.destinationRoomName), 'info')
  }

  const onActivateSubmit = (data: WebhookActivationInput) => {
    activateWebhook(room.id, data.webhookToken)
    toast('Webhook activated! Room is now live.')
    activationForm.reset()
  }

  return (
    <PageShell
      eyebrow="Room Detail"
      title={room.destinationRoomName}
      description="Edit room configuration or complete webhook activation to go live."
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
            <StickerLabel tone={room.webhookToken ? 'success' : 'warning'} tilt="right">
              <PixelScatterText
                value={room.webhookToken ? 'Webhook Active' : 'Webhook Activation'}
                reserveText="Webhook Activation"
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
                    void handleCopyUrl()
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
              {room.webhookToken
                ? 'Webhook token is configured. Room is active.'
                : 'Paste the Chatwork webhook token below to activate translation.'}
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

          <form
            onSubmit={(event) => {
              void activationForm.handleSubmit(onActivateSubmit)(event)
            }}
            noValidate
          >
            <BrutalCard className="theme-card-cream space-y-4">
              <BrutalInput
                label="Webhook Token"
                type="password"
                hint="The token shown by Chatwork after saving the webhook."
                error={activationForm.formState.errors.webhookToken?.message}
                {...activationForm.register('webhookToken')}
              />
              <button
                type="submit"
                className="brutal-button theme-button-violet w-full py-3 font-heading text-sm font-bold text-white"
              >
                Activate Webhook
              </button>
            </BrutalCard>
          </form>
        </div>
      </div>
    </PageShell>
  )
}
