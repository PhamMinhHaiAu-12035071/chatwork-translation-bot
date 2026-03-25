import { BrutalCard } from '~/components/ui/brutal-card'
import { MockField } from '~/components/ui/mock-field'
import { PageShell } from '~/components/ui/page-shell'
import { StickerLabel } from '~/components/ui/sticker-label'

export function RoomCreatePage() {
  return (
    <PageShell
      eyebrow="Create Flow Preview"
      title="Set up a new translation room"
      description="Phase 2 locks the visual rhythm for cards, fields, labels, spacing, and helper callouts. Functional form controls arrive in the next phase."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.8fr)]">
        <BrutalCard className="theme-card-lilac space-y-5">
          <StickerLabel tone="accent">Phase 3 Enables Real Inputs</StickerLabel>
          <div className="grid gap-4 md:grid-cols-2">
            <MockField
              label="Original Room ID"
              hint="Customer Chatwork room identifier."
              value="123456789"
            />
            <MockField
              label="Destination Room Name"
              hint="Internal translation room title."
              value="Project Sakura JP"
            />
            <MockField label="AI Provider" hint="Provider selector visual shell." value="OpenAI" />
            <MockField label="AI Model" hint="Model selector visual shell." value="gpt-4o" />
            <MockField
              label="Translation Style"
              hint="Profile selection card."
              value="Professional Business"
            />
            <MockField
              label="AI API Token"
              hint="Masked secret input preview."
              value="sk-live-********"
            />
          </div>
        </BrutalCard>

        <div className="space-y-6">
          <BrutalCard className="theme-card-peach space-y-3">
            <StickerLabel tone="warning">Manual Work</StickerLabel>
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              Users still need Chatwork room access and webhook setup outside the dashboard.
            </p>
          </BrutalCard>

          <BrutalCard className="theme-card-mint space-y-3">
            <StickerLabel tone="success">Design Goal</StickerLabel>
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              This page should already feel trustworthy, feminine, and operational even before the
              inputs become live.
            </p>
          </BrutalCard>
        </div>
      </div>
    </PageShell>
  )
}
