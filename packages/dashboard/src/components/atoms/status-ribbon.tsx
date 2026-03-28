interface StatusRibbonProps {
  enabled: boolean
  className?: string
}

export function StatusRibbon({ enabled, className }: StatusRibbonProps) {
  return (
    <span
      aria-hidden="true"
      className={['ribbon-base', enabled ? 'ribbon-live' : 'ribbon-paused', className ?? '']
        .join(' ')
        .trim()}
    >
      <span className="ribbon-dot" />
      {enabled ? 'Live' : 'Paused'}
    </span>
  )
}
