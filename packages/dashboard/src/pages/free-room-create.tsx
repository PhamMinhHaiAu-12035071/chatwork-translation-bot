import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router'
import type { ProtectedKeyword } from '~/lib/api-types'
import { Icon } from '~/components/atoms/icons'
import { BrutalInput } from '~/components/atoms/brutal-input'
import { BrutalSelect } from '~/components/atoms/brutal-select'
import { ContextField } from '~/components/molecules/context-field'
import { KeywordProtectionField } from '~/components/molecules/keyword-protection-field'
import { BrutalCard } from '~/components/molecules/brutal-card'
import { PageShell } from '~/components/layout/page-shell'
import { StickerLabel } from '~/components/atoms/sticker-label'
import { useToast } from '~/components/organisms/toast-provider'
import { useAsyncAction } from '~/hooks/use-async-action'
import { toastMessages } from '~/lib/toast-messages'
import { ApiError } from '~/lib/api-client'
import {
  FREE_ROOM_KAGI_STYLE_LABELS,
  FREE_ROOM_KAGI_STYLES,
  getFreeRoomKagiStyleDescription,
  freeRoomCreateSchema,
} from '~/lib/free-room-schemas'
import type { FreeRoomCreateInput } from '~/lib/free-room-schemas'
import { selectCreateFreeRoom, useFreeRoomStore, type FreeRoom } from '~/stores/free-room-store'

const providerOptions = [{ value: 'kagi-free', label: 'Translate Free' }] as const

const kagiStyleOptions = FREE_ROOM_KAGI_STYLES.map((style) => ({
  value: style,
  label: FREE_ROOM_KAGI_STYLE_LABELS[style],
}))

const freeRoomCreateResolver = zodResolver(
  freeRoomCreateSchema as never,
) as Resolver<FreeRoomCreateInput>

export function FreeRoomCreatePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const location = useLocation()
  const prefillRoomId = (location.state as { originalRoomId?: string } | null)?.originalRoomId
  const createFreeRoom = useFreeRoomStore(selectCreateFreeRoom)
  const createFreeRoomAction = useAsyncAction<FreeRoom>({
    fallbackErrorMessage: 'Failed to create free room',
    getErrorMessage: (error) =>
      error instanceof ApiError ? error.message : 'Failed to create free room',
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FreeRoomCreateInput>({
    resolver: freeRoomCreateResolver,
    defaultValues: {
      ...(prefillRoomId !== undefined ? { originalRoomId: Number(prefillRoomId) } : {}),
      originalRoomName: '',
      destinationRoomName: '',
      kagiStyle: 'Clear',
      context: '',
      protectedKeywords: [],
    } as FreeRoomCreateInput,
  })
  const selectedKagiStyle = watch('kagiStyle')

  const onSubmit = async (data: FreeRoomCreateInput) => {
    const result = await createFreeRoomAction.execute(() => {
      const keywordData: {
        originalRoomId: number
        originalRoomName: string
        destinationRoomName: string
        kagiStyle: typeof data.kagiStyle
        context: string | null
        protectedKeywords?: ProtectedKeyword[]
      } = {
        originalRoomId: data.originalRoomId,
        originalRoomName: data.originalRoomName,
        destinationRoomName: data.destinationRoomName,
        kagiStyle: data.kagiStyle,
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

      return createFreeRoom(keywordData)
    })

    if (!result.ok) {
      if (result.cause instanceof ApiError && result.cause.status === 409) {
        setError('originalRoomId', {
          message: 'A free room config for this Chatwork room already exists.',
        })
        return
      }

      toast(result.error, 'error')
      return
    }

    toast(toastMessages.roomCreated(data.destinationRoomName))
    void navigate('/free-rooms', {
      state: {
        spotlightRoomId: result.data.id,
      },
    })
  }

  return (
    <PageShell
      eyebrow="New Free Room"
      title="Set up a free translation room"
      description="Configure a free translation room while keeping the same Chatwork structure and safeguards."
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
              <BrutalInput
                label="Original Room Name"
                type="text"
                hint="The name of the source Chatwork room (for description)."
                placeholder="e.g., JP Project Demo"
                error={errors.originalRoomName?.message}
                {...register('originalRoomName')}
              />
            </div>

            <div>
              <BrutalInput
                label="Destination Room Name"
                type="text"
                hint="Internal name for the translated output room."
                error={errors.destinationRoomName?.message}
                {...register('destinationRoomName')}
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <BrutalSelect
                label="Provider"
                options={[...providerOptions]}
                colorVariant="accent"
                hint="Free rooms use the free translation provider."
                disabled
                value="kagi-free"
                onChange={() => undefined}
              />
              <BrutalSelect
                label="Translation Style"
                options={kagiStyleOptions}
                colorVariant="mint"
                hint={getFreeRoomKagiStyleDescription(selectedKagiStyle)}
                error={errors.kagiStyle?.message}
                value={selectedKagiStyle}
                {...register('kagiStyle')}
              />
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
            <ContextField
              value={watch('context')}
              onChange={(v) => {
                setValue('context', v, { shouldValidate: true })
              }}
              error={errors.context?.message}
              maxLength={100}
              note="This context helps guide the translation output."
            />

            <div className="page-divider-brutal my-4" />
            <KeywordProtectionField
              value={watch('protectedKeywords')}
              onChange={(v) => {
                setValue('protectedKeywords', v, { shouldValidate: true })
              }}
            />

            <div className="flex flex-wrap gap-3 pt-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  void navigate('/free-rooms')
                }}
                className="brutal-button theme-button-warm inline-flex items-center gap-2 px-6 py-3 font-heading text-sm font-bold text-white"
              >
                <Icon name="arrow-left" variant="stroke" size={16} aria-hidden />
                Cancel
              </button>
              <button
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
