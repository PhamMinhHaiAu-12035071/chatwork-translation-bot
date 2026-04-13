import { motion } from 'framer-motion'
import { StickerLabel } from '~/components/atoms/sticker-label'

interface FeatureLabPanelProps {
  collapsed: boolean // desktop only; mobile always passes false
  enabled: boolean // freeRoomEnabled from ui-store
  onToggle: () => void
}

export function FeatureLabPanel({ collapsed, enabled, onToggle }: FeatureLabPanelProps) {
  if (collapsed) {
    return (
      <div
        className="brutal-surface theme-card-butter p-4 flex items-center justify-center"
        style={{ borderStyle: 'dashed' }}
        title="Feature Lab"
      >
        <span aria-hidden="true" style={{ fontSize: '18px' }}>
          ⚗️
        </span>
      </div>
    )
  }

  return (
    <div
      className="brutal-surface theme-card-butter pt-4 pl-4 pr-5 pb-5 space-y-3"
      style={{ borderStyle: 'dashed' }}
    >
      <StickerLabel tone="warning" tilt="flat">
        ⚗️ FEATURE LAB
      </StickerLabel>
      <div className="flex items-center justify-between gap-3">
        <span className="font-heading text-sm font-bold">Free Rooms</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle Free Rooms feature"
          onClick={onToggle}
          className="relative flex-shrink-0"
          style={{
            width: '52px',
            height: '26px',
            border: '2px solid #111',
            borderRadius: '20px',
            background: enabled ? '#22c55e' : '#e5e7eb',
            transition: 'background-color 200ms ease',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <motion.div
            animate={{ x: enabled ? 26 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{
              width: '18px',
              height: '18px',
              border: '2px solid #111',
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '2px 2px 0 #111',
              position: 'absolute',
              top: '2px',
              left: '2px',
            }}
          />
        </button>
      </div>
    </div>
  )
}
