import { BrutalCard } from '~/components/ui/brutal-card'
import { PageShell } from '~/components/ui/page-shell'
import { StickerLabel } from '~/components/ui/sticker-label'

const steps = [
  ['01', 'Access Chatwork Admin', 'Open Integrations and move to the webhook screen.'],
  [
    '02',
    'Create New Webhook',
    'Use a clear room-specific name so the operator recognizes it later.',
  ],
  [
    '03',
    'Paste Webhook URL',
    'The dashboard-generated URL will live here once activation becomes functional.',
  ],
  ['04', 'Select Events', 'Enable message created and message updated for the correct room.'],
  ['05', 'Save and Copy Token', 'Copy the Chatwork webhook token immediately after saving.'],
  [
    '06',
    'Activate on Dashboard',
    'Return to the room detail page and paste the token to enable translation.',
  ],
] as const

export function WebhookGuidePage() {
  return (
    <PageShell
      eyebrow="Manual Guide"
      title="Webhook Setup Guide"
      description="This page is intentionally instructional because webhook setup remains a human step in the product flow."
    >
      <div className="grid gap-4 xl:grid-cols-2">
        {steps.map(([index, title, body]) => (
          <BrutalCard
            key={index}
            tilt={
              index === '01' || index === '04'
                ? 'left'
                : index === '02' || index === '05'
                  ? 'right'
                  : index === '03'
                    ? 'flat'
                    : 'right'
            }
            className={[
              'space-y-4',
              index === '01' || index === '04'
                ? 'theme-card-matcha'
                : index === '02' || index === '05'
                  ? 'theme-card-cream'
                  : index === '03'
                    ? 'theme-card-sky'
                    : 'theme-card-blush',
            ].join(' ')}
          >
            <StickerLabel
              tone={index === '06' ? 'accent' : 'warning'}
              tilt={index === '02' || index === '05' || index === '06' ? 'right' : 'left'}
            >{`Step ${index}`}</StickerLabel>
            <div className="space-y-2">
              <h2 className="font-heading text-2xl font-bold">{title}</h2>
              <p className="text-sm leading-7 text-[var(--text-secondary)]">{body}</p>
            </div>
          </BrutalCard>
        ))}
      </div>
    </PageShell>
  )
}
