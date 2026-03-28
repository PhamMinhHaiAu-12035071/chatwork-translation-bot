interface RoomStatusToggleProps {
  enabled: boolean
  loading: boolean
  onToggle: () => void
}

export function RoomStatusToggle({ enabled, loading, onToggle }: RoomStatusToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? 'Pause room' : 'Enable room'}
      aria-disabled={loading ? true : undefined}
      disabled={loading}
      onClick={onToggle}
      className={['cursor-pointer border-none bg-transparent p-0', loading ? 'opacity-50' : '']
        .join(' ')
        .trim()}
    >
      <div className={['tog-track', enabled ? 'tog-track-on' : ''].join(' ').trim()}>
        <div className={['tog-thumb', enabled ? 'tog-thumb-on' : ''].join(' ').trim()} />
      </div>
    </button>
  )
}
