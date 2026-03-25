import { BrutalCard } from '~/components/ui/brutal-card'
import { PageShell } from '~/components/ui/page-shell'
import { StatusPill } from '~/components/ui/status-pill'
import { StickerLabel } from '~/components/ui/sticker-label'

const previewStats = [
  { label: 'Rooms Active', value: '0', tone: 'warning' as const },
  { label: 'Webhook Ready', value: 'Manual setup', tone: 'success' as const },
  { label: 'AI Providers', value: 'OpenAI + Gemini', tone: 'accent' as const },
] as const

export function RoomListPage() {
  return (
    <PageShell
      eyebrow="Phase 2 Preview"
      title="Room Dashboard"
      description="This screen stays data-free in Phase 2. The goal here is to land the approved kawaii, glassy, brutal visual language before real CRUD flows arrive in later phases."
      actions={
        <>
          <button
            type="button"
            className="brutal-button theme-button-accent px-5 py-3 font-heading text-sm font-bold"
          >
            Create Preview
          </button>
          <button
            type="button"
            className="brutal-button theme-button-warm px-5 py-3 font-heading text-sm font-bold"
          >
            Open Guide
          </button>
        </>
      }
    >
      <div className="grid gap-4 xl:grid-cols-3">
        {previewStats.map((item, index) => (
          <BrutalCard
            key={item.label}
            className={[
              'space-y-3',
              index === 0
                ? 'theme-card-butter'
                : index === 1
                  ? 'theme-card-mint'
                  : 'theme-card-lilac',
            ].join(' ')}
          >
            <StickerLabel tone={item.tone}>{item.label}</StickerLabel>
            <div className="font-heading text-4xl font-extrabold">{item.value}</div>
          </BrutalCard>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.8fr)]">
        <BrutalCard className="theme-card-sky space-y-5">
          <StatusPill tone="warning">Empty State</StatusPill>
          <div className="space-y-3">
            <h2 className="font-heading text-3xl font-bold">Create your first translation room</h2>
            <p className="max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
              The system will eventually let Tech Leads and BPMs define source room settings,
              destination room naming, and translation preferences here.
            </p>
          </div>
          <div className="dashed-panel grid min-h-56 place-items-center p-6 text-center">
            <div className="space-y-3">
              <div className="font-heading text-6xl leading-none">+</div>
              <p className="text-sm leading-7 text-[var(--text-secondary)]">
                Decorative empty-state illustration only for Phase 2.
              </p>
            </div>
          </div>
        </BrutalCard>

        <BrutalCard className="theme-card-blush space-y-4">
          <StickerLabel tone="success">Operator Note</StickerLabel>
          <p className="text-sm leading-7 text-[var(--text-secondary)]">
            Manual webhook setup remains part of the user journey, so the dashboard keeps a strong
            guidance surface instead of hiding that operator work.
          </p>
        </BrutalCard>
      </div>
    </PageShell>
  )
}
