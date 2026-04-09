import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import type { ProtectedKeyword } from '~/lib/api-types'
import { Icon } from '~/components/atoms/icons'
import { BrutalCard } from '~/components/molecules/brutal-card'
import { BrutalInput } from '~/components/atoms/brutal-input'
import { BrutalSelect } from '~/components/atoms/brutal-select'
import { ContextField } from '~/components/molecules/context-field'
import { KeywordProtectionField } from '~/components/molecules/keyword-protection-field'
import { PageShell } from '~/components/layout/page-shell'
import { PixelScatterText } from '~/components/animation/pixel-scatter-text'
import { RoomSkeletonCard } from '~/components/organisms/room-skeleton'
import { StatusPill } from '~/components/atoms/status-pill'
import { StickerLabel } from '~/components/atoms/sticker-label'
import { useToast } from '~/components/organisms/toast-provider'
import { useAsyncAction } from '~/hooks/use-async-action'
import { ApiError } from '~/lib/api-client'
import { toastMessages } from '~/lib/toast-messages'
import {
  BEST_MODEL_BY_PROVIDER,
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  TRANSLATION_STYLE_LABELS,
  isModelValidForProvider,
} from '~/lib/provider-models'
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
        originalRoomName: room.originalRoomName,
        destinationRoomName: room.destinationRoomName,
        aiProvider: room.aiProvider,
        aiModel: room.aiModel ?? BEST_MODEL_BY_PROVIDER[room.aiProvider],
        translationStyle: room.translationStyle,
        aiApiToken: '',
        context: room.context ?? '',
        protectedKeywords: room.protectedKeywords ?? [],
      }
    : {
        originalRoomId: 0,
        originalRoomName: '',
        destinationRoomName: '',
        aiProvider: 'openai',
        aiModel: BEST_MODEL_BY_PROVIDER.openai,
        translationStyle: 'PROFESSIONAL_BUSINESS',
        aiApiToken: '',
        context: '',
        protectedKeywords: [],
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
      originalRoomName: room.originalRoomName,
      destinationRoomName: room.destinationRoomName,
      aiProvider: room.aiProvider,
      aiModel: room.aiModel ?? BEST_MODEL_BY_PROVIDER[room.aiProvider],
      translationStyle: room.translationStyle,
      aiApiToken: '',
      context: room.context ?? '',
      protectedKeywords: room.protectedKeywords ?? [],
    })
  }, [editForm, room])

  const selectedProvider = editForm.watch('aiProvider')
  const aiModel = editForm.watch('aiModel')
  const destinationRoomNameWatch = editForm.watch('destinationRoomName')

  useEffect(() => {
    if (!room) {
      return
    }

    if (!isModelValidForProvider(aiModel, selectedProvider)) {
      editForm.setValue('aiModel', BEST_MODEL_BY_PROVIDER[selectedProvider], {
        shouldValidate: true,
      })
    }
  }, [room, editForm, selectedProvider, aiModel])

  const modelOptions = PROVIDER_MODELS[selectedProvider].map((model) => ({
    value: model.value,
    label: model.label,
  }))

  const aiProviderField = editForm.register('aiProvider', {
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newProvider = e.target.value as typeof selectedProvider
      editForm.setValue('aiModel', BEST_MODEL_BY_PROVIDER[newProvider])
    },
  })

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
            className="brutal-button theme-button-violet inline-flex items-center gap-2 px-5 py-2.5 font-heading text-sm font-bold text-white"
          >
            <Icon name="arrow-left" variant="stroke" size={16} aria-hidden />
            Back to Dashboard
          </button>
        </BrutalCard>
      </PageShell>
    )
  }

  const headerRoomTitle =
    destinationRoomNameWatch.trim() !== ''
      ? destinationRoomNameWatch.trim()
      : room.destinationRoomName

  const onEditSubmit = async (data: RoomEditInput) => {
    const keywords: ProtectedKeyword[] = data.protectedKeywords.map((k) => {
      const item: ProtectedKeyword = {
        keyword: k.keyword,
        category: k.category,
      }
      if (k.placeholder) {
        item.placeholder = k.placeholder
      }
      return item
    })

    const result = await updateRoomAction.execute(() =>
      updateRoom(room.id, {
        destinationRoomName: data.destinationRoomName,
        aiProvider: data.aiProvider,
        aiModel: data.aiModel,
        translationStyle: data.translationStyle,
        ...(data.aiApiToken !== '' ? { aiApiToken: data.aiApiToken } : {}),
        context: data.context.trim() || null,
        protectedKeywords: keywords,
      }),
    )

    if (!result.ok) {
      toast(result.error, 'error')
      return
    }

    toast(toastMessages.roomUpdated(data.destinationRoomName), 'info')
    void navigate('/', {
      state: {
        spotlightRoomId: result.data.id,
      },
    })
  }

  const handleRoomStatusToggle = async () => {
    // Optimistic UI update: Toggle immediately in local state
    const targetState = !room.enabled
    useRoomStore.setState((state) => ({
      rooms: state.rooms.map((r) => (r.id === room.id ? { ...r, enabled: targetState } : r)),
    }))

    const result = await roomStatusAction.execute(async () => {
      if (!targetState) {
        await disableRoom(room.id)
      } else {
        await enableRoom(room.id)
      }

      return undefined
    })

    if (!result.ok) {
      // Revert optimistic update on failure
      useRoomStore.setState((state) => ({
        rooms: state.rooms.map((r) => (r.id === room.id ? { ...r, enabled: !targetState } : r)),
      }))
      toast(result.error, 'error')
      return
    }

    const message = `"${room.destinationRoomName}" is now ${targetState ? 'enabled' : 'paused'}`
    toast(message, 'info')
  }

  return (
    <PageShell
      eyebrow="Room Detail"
      title={headerRoomTitle}
      description="Edit room configuration and manage live translation status."
      actions={
        <StatusPill tone={room.enabled ? 'success' : 'warning'}>
          <PixelScatterText value={room.enabled ? 'Live' : 'Inactive'} reserveText="Inactive" />
        </StatusPill>
      }
    >
      <form
        onSubmit={(event) => {
          void editForm.handleSubmit(onEditSubmit)(event)
        }}
        noValidate
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div id="tour-field-roomid">
                <BrutalInput
                  label="Original Room ID"
                  type="text"
                  inputMode="numeric"
                  readOnly
                  hint="This ID cannot be changed after room creation."
                  error={editForm.formState.errors.originalRoomId?.message}
                  {...editForm.register('originalRoomId', {
                    setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                  })}
                />
              </div>
              <div id="tour-field-roomname-orig">
                <BrutalInput
                  label="Original Room Name"
                  type="text"
                  readOnly
                  hint="Cannot be changed after creation."
                  error={editForm.formState.errors.originalRoomName?.message}
                  {...editForm.register('originalRoomName')}
                />
              </div>
            </div>
            <div id="tour-field-roomname">
              <BrutalInput
                label="Destination Room Name"
                type="text"
                error={editForm.formState.errors.destinationRoomName?.message}
                {...editForm.register('destinationRoomName')}
              />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div id="tour-field-provider">
                <BrutalSelect
                  label="AI Provider"
                  options={providerOptions}
                  colorVariant="accent"
                  error={editForm.formState.errors.aiProvider?.message}
                  {...aiProviderField}
                />
              </div>
              <div id="tour-field-model">
                <BrutalSelect
                  label="AI Model"
                  options={modelOptions}
                  colorVariant="mint"
                  error={editForm.formState.errors.aiModel?.message}
                  value={aiModel}
                  {...editForm.register('aiModel')}
                />
              </div>
              <div id="tour-field-style">
                <BrutalSelect
                  label="Translation Style"
                  options={styleOptions}
                  colorVariant="peach"
                  error={editForm.formState.errors.translationStyle?.message}
                  {...editForm.register('translationStyle')}
                />
              </div>
              <div id="tour-field-token">
                <BrutalInput
                  label="AI API Token"
                  type="password"
                  placeholder={selectedProvider === 'openai' ? 'sk-...' : 'AIza...'}
                  hint="Leave unchanged to keep the existing token."
                  error={editForm.formState.errors.aiApiToken?.message}
                  {...editForm.register('aiApiToken')}
                />
              </div>
            </div>
          </div>

          <div className="space-y-5 self-start">
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

          <div className="xl:col-span-2">
            <div className="page-divider-brutal my-6" />
            <div id="tour-field-context">
              <ContextField
                value={editForm.watch('context')}
                onChange={(v) => {
                  editForm.setValue('context', v, { shouldValidate: true })
                }}
                error={editForm.formState.errors.context?.message}
              />
            </div>

            <div className="page-divider-brutal my-4" />
            <div id="tour-field-keywords">
              <KeywordProtectionField
                value={editForm.watch('protectedKeywords')}
                onChange={(v) => {
                  editForm.setValue('protectedKeywords', v, { shouldValidate: true })
                }}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  void navigate('/')
                }}
                className="brutal-button theme-button-warm inline-flex items-center gap-2 px-6 py-3 font-heading text-sm font-bold text-white"
              >
                <Icon name="arrow-left" variant="stroke" size={16} aria-hidden />
                Back
              </button>
              <button
                id="tour-save-btn"
                type="submit"
                className="brutal-button theme-button-violet px-6 py-3 font-heading text-sm font-bold text-white"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </form>
    </PageShell>
  )
}
