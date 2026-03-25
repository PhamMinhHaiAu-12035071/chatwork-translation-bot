import { useParams } from 'react-router'
import { BrutalCard } from '~/components/ui/brutal-card'
import { MockField } from '~/components/ui/mock-field'
import { PageShell } from '~/components/ui/page-shell'
import { StatusPill } from '~/components/ui/status-pill'
import { StickerLabel } from '~/components/ui/sticker-label'

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <PageShell
      eyebrow="Activation Preview"
      title="Room detail"
      description="This page previews how operators will inspect a room config and complete webhook activation after the initial create step."
      actions={<StatusPill tone="warning">Draft Only</StatusPill>}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <BrutalCard className="theme-card-sky space-y-4" tilt="left">
          <div className="flex flex-wrap items-center gap-3">
            <StickerLabel tone="accent">Room ID</StickerLabel>
            <code className="rounded-full border-[3px] border-[var(--border)] bg-white px-4 py-2 text-sm shadow-[3px_3px_0_var(--border)]">
              {id}
            </code>
          </div>
          <MockField
            label="Generated Webhook URL"
            hint="Will become copyable in later phases."
            value="https://example.com/webhook?room_id=123456789"
          />
          <MockField
            label="Destination Room"
            hint="System-created internal room preview."
            value="Project Sakura JP"
          />
        </BrutalCard>

        <BrutalCard className="theme-card-peach space-y-4" tilt="right">
          <StickerLabel tone="warning" tilt="right">
            Create - Activate
          </StickerLabel>
          <p className="text-sm leading-7 text-[var(--text-secondary)]">
            The room stays disabled until the operator pastes the Chatwork webhook token back into
            the dashboard.
          </p>
          <MockField
            label="Webhook Token"
            hint="Visual-only secret field shell for this phase."
            value="cw-token-********"
          />
        </BrutalCard>
      </div>
    </PageShell>
  )
}
