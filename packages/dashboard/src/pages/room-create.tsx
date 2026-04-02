import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { useNavigate, useLocation } from 'react-router'
import type { ProtectedKeyword } from '~/lib/api-types'
import { Icon } from '~/components/atoms/icons'
import { BrutalCard } from '~/components/molecules/brutal-card'
import { BrutalInput } from '~/components/atoms/brutal-input'
import { BrutalSelect } from '~/components/atoms/brutal-select'
import { ContextField } from '~/components/molecules/context-field'
import { KeywordProtectionField } from '~/components/molecules/keyword-protection-field'
import { PageShell } from '~/components/layout/page-shell'
import { StickerLabel } from '~/components/atoms/sticker-label'
import { useToast } from '~/components/organisms/toast-provider'
import { ApiError } from '~/lib/api-client'
import {
  BEST_MODEL_BY_PROVIDER,
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  TRANSLATION_STYLE_LABELS,
  isModelValidForProvider,
} from '~/lib/provider-models'
import { AI_PROVIDERS, TRANSLATION_STYLES, roomCreateSchema } from '~/lib/room-schema'
import type { RoomCreateInput } from '~/lib/room-schema'
import { useAsyncAction } from '~/hooks/use-async-action'
import { selectCreateRoom, useRoomStore, type Room } from '~/stores/room-store'

const providerOptions = AI_PROVIDERS.map((provider) => ({
  value: provider,
  label: PROVIDER_LABELS[provider],
}))

const styleOptions = TRANSLATION_STYLES.map((style) => ({
  value: style,
  label: TRANSLATION_STYLE_LABELS[style],
}))

const roomCreateResolver = zodResolver(roomCreateSchema as never) as Resolver<RoomCreateInput>

export function getRoomCreatedToastMessage(roomName: string): string {
  return `"${roomName}" was created successfully`
}

export function RoomCreatePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const location = useLocation()
  const prefillRoomId = (location.state as { originalRoomId?: string } | null)?.originalRoomId
  const createRoom = useRoomStore(selectCreateRoom)
  const createRoomAction = useAsyncAction<Room>({
    fallbackErrorMessage: 'Failed to create room',
    getErrorMessage: (error) =>
      error instanceof ApiError ? error.message : 'Failed to create room',
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RoomCreateInput>({
    resolver: roomCreateResolver,
    defaultValues: {
      ...(prefillRoomId !== undefined ? { originalRoomId: Number(prefillRoomId) } : {}),
      aiProvider: 'openai',
      translationStyle: 'PROFESSIONAL_BUSINESS',
      aiModel: 'gpt-5.4',
      destinationRoomName: '',
      aiApiToken: '',
      context: '',
      protectedKeywords: [],
    } as RoomCreateInput,
  })

  const selectedProvider = watch('aiProvider')
  const aiModel = watch('aiModel')
  const modelOptions = PROVIDER_MODELS[selectedProvider].map((model) => ({
    value: model.value,
    label: model.label,
  }))

  useEffect(() => {
    const current = getValues('aiModel')
    if (!isModelValidForProvider(current, selectedProvider)) {
      setValue('aiModel', BEST_MODEL_BY_PROVIDER[selectedProvider], { shouldValidate: true })
    }
  }, [getValues, selectedProvider, setValue])

  const aiProviderField = register('aiProvider', {
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newProvider = e.target.value as typeof selectedProvider
      setValue('aiModel', BEST_MODEL_BY_PROVIDER[newProvider])
    },
  })

  const onSubmit = async (data: RoomCreateInput) => {
    const result = await createRoomAction.execute(() => {
      const keywordData: {
        originalRoomId: number
        destinationRoomName: string
        aiProvider: 'openai' | 'gemini'
        aiModel: string | null
        translationStyle: 'NATURAL_CASUAL' | 'PROFESSIONAL_BUSINESS' | 'TECHNICAL'
        aiApiToken: string
        context: string | null
        protectedKeywords?: ProtectedKeyword[]
      } = {
        originalRoomId: data.originalRoomId,
        destinationRoomName: data.destinationRoomName,
        aiProvider: data.aiProvider,
        aiModel: data.aiModel,
        translationStyle: data.translationStyle,
        aiApiToken: data.aiApiToken,
        context: data.context.trim() || null,
      }

      if (data.protectedKeywords.length > 0) {
        keywordData.protectedKeywords = data.protectedKeywords.map((k) => {
          const item: ProtectedKeyword = {
            keyword: k.keyword,
            category: k.category,
          }
          if (k.placeholder) {
            item.placeholder = k.placeholder
          }
          return item
        })
      }

      return createRoom(keywordData)
    })

    if (!result.ok) {
      if (result.cause instanceof ApiError && result.cause.status === 409) {
        setError('originalRoomId', {
          message: 'A room config for this Chatwork room already exists.',
        })
        return
      }

      toast(result.error, 'error')
      return
    }

    toast(getRoomCreatedToastMessage(data.destinationRoomName))
    void navigate('/', {
      state: {
        spotlightRoomId: result.data.id,
      },
    })
  }

  return (
    <PageShell
      eyebrow="New Room"
      title="Set up a translation room"
      description="Configure the Chatwork source room, AI provider, and translation preferences."
    >
      <form
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event)
        }}
        noValidate
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.8fr)]">
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div id="tour-field-roomid">
                <BrutalInput
                  label="Original Room ID"
                  type="text"
                  inputMode="numeric"
                  hint="The numeric ID of the source Chatwork room."
                  error={errors.originalRoomId?.message}
                  {...register('originalRoomId', {
                    setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                  })}
                />
              </div>
              <div id="tour-field-roomname">
                <BrutalInput
                  label="Destination Room Name"
                  type="text"
                  hint="Internal name for the translated output room."
                  error={errors.destinationRoomName?.message}
                  {...register('destinationRoomName')}
                />
              </div>
              <div id="tour-field-provider">
                <BrutalSelect
                  label="AI Provider"
                  options={providerOptions}
                  colorVariant="accent"
                  hint="Choose which AI service handles translations."
                  error={errors.aiProvider?.message}
                  {...aiProviderField}
                />
              </div>
              <div id="tour-field-model">
                <BrutalSelect
                  label="AI Model"
                  options={modelOptions}
                  colorVariant="mint"
                  hint="Select the model for translation quality and cost balance."
                  error={errors.aiModel?.message}
                  value={aiModel}
                  {...register('aiModel')}
                />
              </div>
              <div id="tour-field-style">
                <BrutalSelect
                  label="Translation Style"
                  options={styleOptions}
                  colorVariant="peach"
                  hint="Controls the tone and formality of output."
                  error={errors.translationStyle?.message}
                  {...register('translationStyle')}
                />
              </div>
              <div id="tour-field-token">
                <BrutalInput
                  label="AI API Token"
                  type="password"
                  placeholder={selectedProvider === 'openai' ? 'sk-...' : 'AIza...'}
                  hint="Your provider API key for the selected translation service."
                  error={errors.aiApiToken?.message}
                  {...register('aiApiToken')}
                />
              </div>
            </div>
          </div>

          <div className="space-y-6 self-start">
            <BrutalCard className="theme-card-matcha space-y-3" tilt="left">
              <StickerLabel tone="warning">Before You Start</StickerLabel>
              <p className="font-ui-body text-sm leading-7 text-[var(--text-secondary)]">
                Before creating a room, set up a Chatwork webhook with this server&#39;s URL. Follow
                the Webhook Guide for step-by-step instructions.
              </p>
              <button
                type="button"
                onClick={() => {
                  void navigate('/guide')
                }}
                className="brutal-button theme-button-sky inline-flex items-center gap-2 px-4 py-2 font-heading text-xs font-bold text-[var(--border)]"
              >
                <Icon name="bookSky" variant="clay" size={20} aria-hidden />
                Open Webhook Guide
              </button>
            </BrutalCard>
          </div>

          <div className="xl:col-span-2">
            <div className="page-divider-brutal my-6" />
            <div id="tour-field-context">
              {(() => {
                const contextFieldProps: {
                  value: string
                  onChange: (v: string) => void
                  error?: string
                } = {
                  value: watch('context'),
                  onChange: (v: string) => {
                    setValue('context', v, { shouldValidate: true })
                  },
                }
                if (errors.context?.message) {
                  contextFieldProps.error = errors.context.message
                }
                return <ContextField {...contextFieldProps} />
              })()}
            </div>

            <div className="page-divider-brutal my-4" />
            <div id="tour-field-keywords">
              <KeywordProtectionField
                value={watch('protectedKeywords')}
                onChange={(v) => {
                  setValue('protectedKeywords', v, { shouldValidate: true })
                }}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  void navigate('/')
                }}
                className="brutal-button theme-button-warm px-6 py-3 font-heading text-sm font-bold text-white"
              >
                Cancel
              </button>
              <button
                id="tour-save-btn"
                type="submit"
                disabled={isSubmitting}
                className="brutal-button theme-button-violet px-6 py-3 font-heading text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Creating…' : 'Create Room'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </PageShell>
  )
}
