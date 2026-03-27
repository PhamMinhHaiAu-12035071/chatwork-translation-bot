import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { BrutalCard } from '~/components/molecules/brutal-card'
import { StatusPill } from '~/components/atoms/status-pill'
import { StickerLabel } from '~/components/atoms/sticker-label'
import { useCopyClipboard } from '~/hooks/use-copy-clipboard'

interface WebhookStepperProps {
  webhookUrl?: string
}

interface Step {
  number: string
  title: string
  body: string
  action?: 'link' | 'copy' | 'none'
  actionLabel?: string
}

const STEPS: Step[] = [
  {
    number: '01',
    title: 'Access Chatwork Admin',
    body: 'Log in to your Chatwork account. Open the Admin panel and navigate to Integrations → Webhooks.',
    action: 'link',
    actionLabel: 'Open Chatwork Admin',
  },
  {
    number: '02',
    title: 'Create New Webhook',
    body: 'Click "Add webhook". Give it a descriptive name — for example, the room name you are setting up — so you can recognise it later.',
    action: 'none',
  },
  {
    number: '03',
    title: 'Paste Webhook URL',
    body: 'Copy the URL below and paste it into the "Webhook URL" field in the Chatwork form.',
    action: 'copy',
    actionLabel: 'Copy URL',
  },
  {
    number: '04',
    title: 'Select Events',
    body: 'Tick "Message created" and "Message updated". Enter the original Room ID in the room filter so Chatwork only fires events for that room.',
    action: 'none',
  },
  {
    number: '05',
    title: 'Save Webhook',
    body: 'Click Save. Chatwork will activate the webhook. No secret needed.',
    action: 'none',
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

      <div className="min-h-[280px]">
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

              <div className="space-y-2">
                <h2 className="font-heading text-2xl font-bold">{activeConfig.title}</h2>
                <p className="font-ui-body text-sm leading-7 text-[var(--text-secondary)]">
                  {activeConfig.body}
                </p>
              </div>

              {activeStep === 0 ? (
                <a
                  href="https://www.chatwork.com/service/packages/chatwork/subpackages/webhook/list.php"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="brutal-button theme-button-violet inline-flex items-center gap-2 px-5 py-2.5 font-heading text-sm font-bold text-white"
                >
                  {activeConfig.actionLabel}
                  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 8H13M13 8L9 4M13 8L9 12"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              ) : null}

              {activeStep === 2 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 rounded-[14px] border-[3px] border-[var(--border)] bg-white/80 px-4 py-2.5 shadow-[3px_3px_0_var(--border)]">
                    <code className="font-ui-body flex-1 truncate text-xs text-[var(--text-primary)]">
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
          className="brutal-button theme-button-warm px-5 py-2.5 font-heading text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          {...previousButtonMotionProps}
        >
          <svg
            aria-hidden="true"
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            style={{
              display: 'inline-block',
              verticalAlign: 'middle',
              marginRight: '6px',
              marginTop: '-2px',
            }}
          >
            <path
              d="M13 8H3M3 8L7 4M3 8L7 12"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
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
              className="brutal-button theme-button-violet px-5 py-2.5 font-heading text-sm font-bold text-white"
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: -12 }}
              transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              Next
              <svg
                aria-hidden="true"
                width="15"
                height="15"
                viewBox="0 0 16 16"
                fill="none"
                style={{
                  display: 'inline-block',
                  verticalAlign: 'middle',
                  marginLeft: '6px',
                  marginTop: '-2px',
                }}
              >
                <path
                  d="M3 8H13M13 8L9 4M13 8L9 12"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
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
