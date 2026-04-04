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
import {
  FREE_ROOM_KAGI_STYLE_LABELS,
  FREE_ROOM_KAGI_STYLES,
  getFreeRoomKagiStyleDescription,
  freeRoomEditSchema,
} from '~/lib/free-room-schemas'
import type { FreeRoomEditInput } from '~/lib/free-room-schemas'
import {
  selectDisableFreeRoom,
  selectEnableFreeRoom,
  selectFetchFreeRooms,
  selectFreeListState,
  selectFreeRoomById,
  selectUpdateFreeRoom,
  useFreeRoomStore,
  type FreeRoom,
} from '~/stores/free-room-store'

const providerOptions = [{ value: 'kagi-free', label: 'Translate Free' }] as const

const kagiStyleOptions = FREE_ROOM_KAGI_STYLES.map((style) => ({
  value: style,
  label: FREE_ROOM_KAGI_STYLE_LABELS[style],
}))

const freeRoomEditResolver = zodResolver(freeRoomEditSchema as never) as Resolver<FreeRoomEditInput>

export function getFreeRoomUpdatedToastMessage(roomName: string): string {
  return `"${roomName}" was updated successfully`
}

export function FreeRoomDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const room = useFreeRoomStore(selectFreeRoomById(id))
  const listState = useFreeRoomStore(selectFreeListState)
  const fetchFreeRooms = useFreeRoomStore(selectFetchFreeRooms)
  const updateFreeRoom = useFreeRoomStore(selectUpdateFreeRoom)
  const enableFreeRoom = useFreeRoomStore(selectEnableFreeRoom)
  const disableFreeRoom = useFreeRoomStore(selectDisableFreeRoom)
  const updateRoomAction = useAsyncAction<FreeRoom>({
    fallbackErrorMessage: 'Update failed',
    getErrorMessage: (error) => (error instanceof ApiError ? error.message : 'Update failed'),
  })
  const roomStatusAction = useAsyncAction<undefined>({
    fallbackErrorMessage: 'Failed',
    getErrorMessage: (error) => (error instanceof ApiError ? error.message : 'Failed'),
  })

  const editDefaults: FreeRoomEditInput = room
    ? {
        originalRoomId: room.originalRoomId,
        originalRoomName: room.originalRoomName,
        destinationRoomName: room.destinationRoomName,
        kagiStyle: room.kagiStyle,
        context: room.context ?? '',
        protectedKeywords: room.protectedKeywords ?? [],
      }
    : {
        originalRoomId: 0,
        originalRoomName: '',
        destinationRoomName: '',
        kagiStyle: 'Clear',
        context: '',
        protectedKeywords: [],
      }

  const editForm = useForm<FreeRoomEditInput>({
    resolver: freeRoomEditResolver,
    defaultValues: editDefaults,
  })

  useEffect(() => {
    if (!room && listState === 'idle') {
      void fetchFreeRooms()
    }
  }, [fetchFreeRooms, listState, room])

  useEffect(() => {
    if (!room) {
      return
    }

    editForm.reset({
      originalRoomId: room.originalRoomId,
      originalRoomName: room.originalRoomName,
      destinationRoomName: room.destinationRoomName,
      kagiStyle: room.kagiStyle,
      context: room.context ?? '',
      protectedKeywords: room.protectedKeywords ?? [],
    })
  }, [editForm, room])

  const destinationRoomNameWatch = editForm.watch('destinationRoomName')
  const selectedKagiStyle = editForm.watch('kagiStyle')

  if ((listState === 'loading' || listState === 'idle') && !room) {
    return (
      <PageShell eyebrow="Loading…" title="Free Room Detail" description="">
        <RoomSkeletonCard />
      </PageShell>
    )
  }

  if (!room) {
    return (
      <PageShell eyebrow="Not Found" title="Free room not found" description="">
        <BrutalCard className="theme-card-peach space-y-4">
          <p className="font-ui-body text-sm text-[var(--text-secondary)]">
            No free room with ID <code>{id}</code> was found.
          </p>
          <button
            type="button"
            onClick={() => {
              void navigate('/free-rooms')
            }}
            className="brutal-button theme-button-violet inline-flex items-center gap-2 px-5 py-2.5 font-heading text-sm font-bold text-white"
          >
            <Icon name="arrow-left" variant="stroke" size={16} aria-hidden />
            Back to Free Rooms
          </button>
        </BrutalCard>
      </PageShell>
    )
  }

  const headerRoomTitle =
    destinationRoomNameWatch.trim() !== ''
      ? destinationRoomNameWatch.trim()
      : room.destinationRoomName

  const onEditSubmit = async (data: FreeRoomEditInput) => {
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
      updateFreeRoom(room.id, {
        destinationRoomName: data.destinationRoomName,
        kagiStyle: data.kagiStyle,
        context: data.context.trim() || null,
        protectedKeywords: keywords,
      }),
    )

    if (!result.ok) {
      toast(result.error, 'error')
      return
    }

    toast(getFreeRoomUpdatedToastMessage(data.destinationRoomName), 'info')
    void navigate('/free-rooms', {
      state: {
        spotlightRoomId: result.data.id,
      },
    })
  }

  const handleRoomStatusToggle = async () => {
    const targetState = !room.enabled
    useFreeRoomStore.setState((state) => ({
      rooms: state.rooms.map((r) => (r.id === room.id ? { ...r, enabled: targetState } : r)),
    }))

    const result = await roomStatusAction.execute(async () => {
      if (!targetState) {
        await disableFreeRoom(room.id)
      } else {
        await enableFreeRoom(room.id)
      }

      return undefined
    })

    if (!result.ok) {
      useFreeRoomStore.setState((state) => ({
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
      eyebrow="Free Room Detail"
      title={headerRoomTitle}
      description="Edit free room configuration and manage live translation status."
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
              <BrutalInput
                label="Original Room ID"
                type="text"
                inputMode="numeric"
                readOnly
                hint="Cannot be changed after creation."
                error={editForm.formState.errors.originalRoomId?.message}
                {...editForm.register('originalRoomId', {
                  setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                })}
              />
              <BrutalInput
                label="Original Room Name"
                type="text"
                readOnly
                hint="Cannot be changed after creation."
                error={editForm.formState.errors.originalRoomName?.message}
                {...editForm.register('originalRoomName')}
              />
              <BrutalInput
                label="Destination Room Name"
                type="text"
                error={editForm.formState.errors.destinationRoomName?.message}
                {...editForm.register('destinationRoomName')}
              />
              <BrutalSelect
                label="Provider"
                options={[...providerOptions]}
                colorVariant="accent"
                disabled
                value="kagi-free"
                onChange={() => undefined}
              />
              <BrutalSelect
                label="Translation Style"
                options={kagiStyleOptions}
                colorVariant="mint"
                hint={getFreeRoomKagiStyleDescription(selectedKagiStyle)}
                error={editForm.formState.errors.kagiStyle?.message}
                value={selectedKagiStyle}
                {...editForm.register('kagiStyle')}
              />
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
            <ContextField
              value={editForm.watch('context')}
              onChange={(v) => {
                editForm.setValue('context', v, { shouldValidate: true })
              }}
              error={editForm.formState.errors.context?.message}
              maxLength={100}
              note="This context helps guide the translation output."
            />

            <div className="page-divider-brutal my-4" />
            <KeywordProtectionField
              value={editForm.watch('protectedKeywords')}
              onChange={(v) => {
                editForm.setValue('protectedKeywords', v, { shouldValidate: true })
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
                Back
              </button>
              <button
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
