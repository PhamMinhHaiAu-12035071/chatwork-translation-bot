import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { BrutalCard } from '~/components/ui/brutal-card'
import { BrutalInput } from '~/components/ui/brutal-input'
import { BrutalSelect } from '~/components/ui/brutal-select'
import { PageShell } from '~/components/ui/page-shell'
import { StickerLabel } from '~/components/ui/sticker-label'
import { useToast } from '~/components/ui/toast-provider'
import { PROVIDER_LABELS, PROVIDER_MODELS, TRANSLATION_STYLE_LABELS } from '~/lib/provider-models'
import { AI_PROVIDERS, TRANSLATION_STYLES, roomCreateSchema } from '~/lib/room-schema'
import type { RoomCreateInput } from '~/lib/room-schema'
import { useRoomStore } from '~/stores/room-store'

const providerOptions = AI_PROVIDERS.map((provider) => ({
  value: provider,
  label: PROVIDER_LABELS[provider],
}))

const styleOptions = TRANSLATION_STYLES.map((style) => ({
  value: style,
  label: TRANSLATION_STYLE_LABELS[style],
}))

const roomCreateResolver = zodResolver(roomCreateSchema as never) as Resolver<RoomCreateInput>

export function RoomCreatePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const addRoom = useRoomStore((state) => state.addRoom)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RoomCreateInput>({
    resolver: roomCreateResolver,
    defaultValues: {
      aiProvider: 'openai',
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiModel: '',
      destinationRoomName: '',
      aiApiToken: '',
    },
  })

  const selectedProvider = watch('aiProvider')
  const modelOptions = [
    { value: '', label: 'Default model' },
    ...PROVIDER_MODELS[selectedProvider].map((model) => ({
      value: model.value,
      label: model.label,
    })),
  ]

  const aiProviderField = register('aiProvider', {
    onChange: () => {
      setValue('aiModel', '')
    },
  })

  const onSubmit = (data: RoomCreateInput) => {
    const normalizedAiModel = data.aiModel === '' || data.aiModel == null ? null : data.aiModel

    const newId = addRoom({
      ...data,
      aiModel: normalizedAiModel,
    })

    toast('Room created successfully!')
    void navigate(`/rooms/${newId}`)
  }

  return (
    <PageShell
      eyebrow="New Room"
      title="Set up a translation room"
      description="Configure the Chatwork source room, AI provider, and translation preferences. Webhook activation happens after saving."
    >
      <form
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event)
        }}
        noValidate
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.8fr)]">
          <BrutalCard className="theme-card-cream space-y-5">
            <StickerLabel tone="accent">Room Configuration</StickerLabel>
            <div className="grid gap-5 md:grid-cols-2">
              <BrutalInput
                label="Original Room ID"
                type="number"
                hint="The numeric ID of the source Chatwork room."
                error={errors.originalRoomId?.message}
                {...register('originalRoomId', { valueAsNumber: true })}
              />
              <BrutalInput
                label="Destination Room Name"
                type="text"
                hint="Internal name for the translated output room."
                error={errors.destinationRoomName?.message}
                {...register('destinationRoomName')}
              />
              <BrutalSelect
                label="AI Provider"
                options={providerOptions}
                hint="Choose which AI service handles translations."
                error={errors.aiProvider?.message}
                {...aiProviderField}
              />
              <BrutalSelect
                label="AI Model"
                options={modelOptions}
                hint="Leave blank to use the provider default."
                error={errors.aiModel?.message}
                {...register('aiModel')}
              />
              <BrutalSelect
                label="Translation Style"
                options={styleOptions}
                hint="Controls the tone and formality of output."
                error={errors.translationStyle?.message}
                {...register('translationStyle')}
              />
              <BrutalInput
                label="AI API Token"
                type="password"
                hint="Your provider API key. Stored in memory only."
                error={errors.aiApiToken?.message}
                {...register('aiApiToken')}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="brutal-button theme-button-violet px-6 py-3 font-heading text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Creating…' : 'Create Room'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void navigate('/')
                }}
                className="brutal-button theme-button-warm px-6 py-3 font-heading text-sm font-bold text-white"
              >
                Cancel
              </button>
            </div>
          </BrutalCard>

          <div className="space-y-6">
            <BrutalCard className="theme-card-matcha space-y-3" tilt="left">
              <StickerLabel tone="warning">Manual Step Required</StickerLabel>
              <p className="text-sm leading-7 text-[var(--text-secondary)]">
                After creating the room you will need to configure a Chatwork webhook and paste the
                token into the dashboard to go live.
              </p>
              <button
                type="button"
                onClick={() => {
                  void navigate('/guide')
                }}
                className="brutal-button theme-button-sky px-4 py-2 font-heading text-xs font-bold text-[var(--border)]"
              >
                Open Webhook Guide →
              </button>
            </BrutalCard>

            <BrutalCard className="theme-card-lilac space-y-3" tilt="right">
              <StickerLabel tone="success" tilt="right">
                Tip
              </StickerLabel>
              <p className="text-sm leading-7 text-[var(--text-secondary)]">
                The AI API token is kept in browser memory only. No data leaves your browser until
                the API integration is wired up in Phase 5.
              </p>
            </BrutalCard>
          </div>
        </div>
      </form>
    </PageShell>
  )
}
