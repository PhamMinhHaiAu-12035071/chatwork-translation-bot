import { BrutalCard } from '~/components/molecules/brutal-card'
import { PageShell } from '~/components/layout/page-shell'
import { StickerLabel } from '~/components/atoms/sticker-label'
import { TipCard } from '~/components/atoms/tip-card'
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
      description="Follow these five steps to connect your Chatwork room to the translation bot. Complete each step before moving on."
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

          <TipCard tilt="left" theme="theme-card-butter">
            Room ID is the number after #/rid in the chat URL — for example,
            https://www.chatwork.com/#/rid123 means Room ID is 123.
          </TipCard>
        </div>
      </div>
    </PageShell>
  )
}
