import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Icon } from '~/components/atoms/icons'
import { BrutalCard } from '~/components/molecules/brutal-card'
import { StatusPill } from '~/components/atoms/status-pill'
import { StickerLabel } from '~/components/atoms/sticker-label'
import { useCopyClipboard } from '~/hooks/use-copy-clipboard'
import { WebhookStep01Svg, WebhookStep02Svg } from '~/components/atoms/webhook-svgs'

interface WebhookStepperProps {
  webhookUrl?: string
}

interface Step {
  number: string
  title: string
  body: string
  action?: 'link' | 'copy' | 'none'
  actionLabel?: string
  svgFragment: React.ReactNode
}

const STEPS: Step[] = [
  {
    number: '01',
    title: 'Access Chatwork Admin',
    body: 'Log in to your Chatwork account. Open the Admin panel and navigate to Integrations → Webhooks.',
    action: 'link',
    actionLabel: 'Open Chatwork Admin',
    svgFragment: <WebhookStep01Svg />,
  },
  {
    number: '02',
    title: 'Create New Webhook',
    body: 'Click "Add webhook". Give it a descriptive name — for example, the room name you are setting up — so you can recognise it later.',
    action: 'none',
    svgFragment: <WebhookStep02Svg />,
  },
  {
    number: '03',
    title: 'Paste Webhook URL',
    body: 'Copy the URL below and paste it into the "Webhook URL" field in the Chatwork form.',
    action: 'copy',
    actionLabel: 'Copy URL',
    svgFragment: null,
  },
  {
    number: '04',
    title: 'Select Events',
    body: 'Tick "Message created" and "Message updated". Enter the original Room ID in the room filter so Chatwork only fires events for that room.',
    action: 'none',
    svgFragment: null,
  },
  {
    number: '05',
    title: 'Save Webhook',
    body: 'Click Save. Chatwork will activate the webhook. No secret needed.',
    action: 'none',
    svgFragment: null,
  },
]

const CARD_THEMES = [
  'theme-card-matcha',
  'theme-card-lilac',
  'theme-card-sky',
  'theme-card-matcha',
  'theme-card-peach',
] as const

const PILL_COLORS = [
  'bg-[#6e77e5]',
  'bg-[#e8a065]',
  'bg-[#5bb89a]',
  'bg-[#d44470]',
  'bg-[#6e77e5]',
] as const

const TILTS_BY_INDEX = ['left', 'right', 'flat', 'left', 'right'] as const
const DEFAULT_PILL_COLOR = 'bg-[var(--accent)]'

export function WebhookStepper({ webhookUrl }: WebhookStepperProps) {
  const [activeStep, setActiveStep] = useState(0)
  const { copied, copy } = useCopyClipboard()

  const activeConfig = STEPS[activeStep]
  const activeTheme = CARD_THEMES[activeStep]
  const activeTilt = TILTS_BY_INDEX[activeStep]
  const previousButtonMotionProps =
    activeStep > 0
      ? {
          whileHover: { scale: 1.05, y: -2 },
          whileTap: { scale: 0.95 },
        }
      : {}

  if (!activeConfig || !activeTheme || !activeTilt) {
    return null
  }

  const handleCopy = async () => {
    const url = webhookUrl ?? 'https://your-server.example.com/webhook'
    await copy(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {STEPS.map((step, index) => (
          <button
            key={step.number}
            type="button"
            onClick={() => {
              setActiveStep(index)
            }}
            className={[
              'rounded-full border-[3px] border-[var(--border)] px-4 py-1.5',
              'font-heading text-xs font-bold shadow-[3px_3px_0_var(--border)] transition-colors duration-150',
              index === activeStep
                ? `${PILL_COLORS[index] ?? DEFAULT_PILL_COLOR} text-white`
                : index < activeStep
                  ? 'bg-[var(--success)] text-[var(--border)]'
                  : 'bg-white/80 text-[var(--text-primary)]',
            ].join(' ')}
          >
            {index < activeStep ? 'OK' : step.number}
          </button>
        ))}
      </div>

      <div className="min-h-[360px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <BrutalCard
              animated={false}
              className={[activeTheme, 'space-y-4'].join(' ')}
              tilt={activeTilt}
            >
              <div className="flex flex-wrap items-center gap-3">
                <StickerLabel
                  tone={activeStep === STEPS.length - 1 ? 'accent' : 'warning'}
                  tilt={activeStep % 2 === 0 ? 'left' : 'right'}
                >
                  {`Step ${activeConfig.number}`}
                </StickerLabel>
                {activeStep < STEPS.length - 1 ? (
                  <StatusPill tone="neutral">
                    {`${String(activeStep + 1)} of ${String(STEPS.length)}`}
                  </StatusPill>
                ) : (
                  <StatusPill tone="success">Final step</StatusPill>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
                <div className="space-y-2">
                  <h2 className="font-heading text-2xl font-bold">{activeConfig.title}</h2>
                  <p className="font-ui-body text-sm leading-7 text-[var(--text-secondary)]">
                    {activeConfig.body}
                  </p>
                </div>
                <div className="flex items-start justify-center">{activeConfig.svgFragment}</div>
              </div>

              {activeStep === 0 ? (
                <a
                  href="https://www.chatwork.com/service/packages/chatwork/subpackages/webhook/list.php"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="brutal-button theme-button-violet inline-flex items-center gap-2 px-5 py-2.5 font-heading text-sm font-bold text-white"
                >
                  {activeConfig.actionLabel}
                  <Icon name="arrow-right" variant="stroke" size={15} aria-hidden />
                </a>
              ) : null}

              {activeStep === 2 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 rounded-[14px] border-[3px] border-[var(--border)] bg-white/80 px-4 py-2.5 shadow-[3px_3px_0_var(--border)]">
                    <span className="flex size-6 shrink-0 items-center justify-center" aria-hidden>
                      <Icon name="link" variant="clay" size={24} aria-hidden />
                    </span>
                    <code className="font-ui-body flex-1 truncate text-sm text-[var(--text-primary)]">
                      {webhookUrl ?? 'https://your-server.example.com/webhook'}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        void handleCopy()
                      }}
                      className={[
                        'brutal-button shrink-0 px-4 py-1.5 font-heading text-xs font-bold',
                        copied ? 'theme-button-gold' : 'theme-button-violet text-white',
                      ].join(' ')}
                    >
                      {copied ? 'Copied!' : 'Copy URL'}
                    </button>
                  </div>
                </div>
              ) : null}
            </BrutalCard>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between">
        <motion.button
          type="button"
          disabled={activeStep === 0}
          onClick={() => {
            setActiveStep((step) => Math.max(0, step - 1))
          }}
          className="brutal-button theme-button-warm inline-flex items-center gap-2 px-5 py-2.5 font-heading text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          {...previousButtonMotionProps}
        >
          <Icon name="arrow-left" variant="stroke" size={15} aria-hidden />
          Previous
        </motion.button>
        <AnimatePresence mode="wait">
          {activeStep < STEPS.length - 1 ? (
            <motion.button
              key="next"
              type="button"
              onClick={() => {
                setActiveStep((step) => Math.min(STEPS.length - 1, step + 1))
              }}
              className="brutal-button theme-button-violet inline-flex items-center gap-2 px-5 py-2.5 font-heading text-sm font-bold text-white"
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: -12 }}
              transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              Next
              <Icon name="arrow-right" variant="stroke" size={15} aria-hidden />
            </motion.button>
          ) : (
            <motion.div
              key="completed"
              className="brutal-button theme-button-matcha flex items-center justify-center px-5 py-2.5 font-heading text-sm font-bold text-white"
              initial={{ opacity: 0, scale: 0.5, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            >
              Completed
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
