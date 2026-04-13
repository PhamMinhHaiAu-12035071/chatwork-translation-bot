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
          className="tog-wrap cursor-pointer border-none bg-transparent p-0 outline-none [-webkit-tap-highlight-color:transparent]"
        >
          <div className={['tog-track', enabled ? 'tog-track-on' : ''].join(' ').trim()}>
            <div className={['tog-thumb', enabled ? 'tog-thumb-on' : ''].join(' ').trim()} />
          </div>
        </button>
      </div>
    </div>
  )
}
