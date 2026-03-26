import { BrutalCard } from '~/components/molecules/brutal-card'
import { PageShell } from '~/components/layout/page-shell'
import { StickerLabel } from '~/components/atoms/sticker-label'
import { WebhookStepper } from '~/components/molecules/webhook-stepper'

function getWebhookUrl(): string {
  const base =
    typeof window !== 'undefined' ? window.location.origin : 'https://your-server.example.com'
  return `${base}/webhook`
}

export function WebhookGuidePage() {
  const webhookUrl = getWebhookUrl()

  return (
    <PageShell
      eyebrow="Manual Guide"
      title="Webhook Setup Guide"
      description="Follow these six steps to connect your Chatwork room to the translation bot. Complete each step before moving on."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
        <BrutalCard className="theme-card-cream space-y-5">
          <StickerLabel tone="accent">Step-by-Step</StickerLabel>
          <WebhookStepper webhookUrl={webhookUrl} />
        </BrutalCard>

        <div className="space-y-5">
          <BrutalCard className="theme-card-sky space-y-3" tilt="right">
            <StickerLabel tone="warning" tilt="right">
              Why manual?
            </StickerLabel>
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              Chatwork webhooks require operator-level access to the Chatwork Admin panel. The
              dashboard cannot create them on your behalf — this is a Chatwork API limitation.
            </p>
          </BrutalCard>

          <BrutalCard className="theme-card-matcha space-y-3" tilt="left">
            <StickerLabel tone="success">One-time setup</StickerLabel>
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              Once the webhook secret is saved in the room configuration and the room is enabled, no
              further manual steps are needed. Translation runs automatically.
            </p>
          </BrutalCard>
        </div>
      </div>
    </PageShell>
  )
}
