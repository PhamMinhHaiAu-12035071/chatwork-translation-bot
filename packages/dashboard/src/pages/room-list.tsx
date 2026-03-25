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
            className="brutal-button theme-button-violet px-5 py-3 font-heading text-sm font-bold text-white"
          >
            Create Preview
          </button>
          <button
            type="button"
            className="brutal-button theme-button-warm px-5 py-3 font-heading text-sm font-bold text-white"
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
            tilt={index === 0 ? 'left' : index === 2 ? 'right' : 'flat'}
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
          <div className="dashed-panel space-y-4 p-5">
            <div className="space-y-1 text-left">
              <div className="font-heading text-xl font-bold">Future room previews</div>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                Color blocks stay light, cute, and readable even when the dashboard becomes
                operational.
              </p>
            </div>

            <div className="room-stack">
              <div className="room-card theme-card-lilac">
                <div>
                  <div className="room-title">Sakura Desk</div>
                  <div className="room-meta">Operations handoff</div>
                </div>
                <div className="room-status theme-button-sky text-[var(--border)]">Live</div>
              </div>

              <div className="room-card theme-card-matcha">
                <div>
                  <div className="room-title">Gamma Team</div>
                  <div className="room-meta">Technical setup</div>
                </div>
                <div className="room-status theme-button-gold text-[var(--border)]">Setup</div>
              </div>

              <div className="room-card theme-card-cream">
                <div>
                  <div className="room-title">Customer Care</div>
                  <div className="room-meta">Pilot translation flow</div>
                </div>
                <div className="room-status theme-button-pink text-[#fff7ed]">Pilot</div>
              </div>
            </div>
          </div>
        </BrutalCard>

        <BrutalCard className="theme-card-cream space-y-4" tilt="right">
          <StickerLabel tone="success" tilt="right">
            Operator Note
          </StickerLabel>
          <p className="text-sm leading-7 text-[var(--text-secondary)]">
            Manual webhook setup remains part of the user journey, so the dashboard keeps a strong
            guidance surface instead of hiding that operator work.
          </p>
        </BrutalCard>
      </div>
    </PageShell>
  )
}
