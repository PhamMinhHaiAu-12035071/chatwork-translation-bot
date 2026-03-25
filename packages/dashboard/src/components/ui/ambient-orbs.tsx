const orbClassNames = [
  'absolute left-[-4rem] top-12 h-28 w-28 rounded-full bg-[var(--organic-circle-1)]/70 blur-[2px]',
  'absolute right-16 top-28 h-20 w-20 rounded-full bg-[var(--organic-circle-2)]/70 blur-[1px]',
  'absolute bottom-10 right-[-2rem] h-32 w-32 rounded-full bg-[var(--organic-circle-3)]/65 blur-[2px]',
] as const

export function AmbientOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {orbClassNames.map((className) => (
        <div
          key={className}
          className={className}
          style={{ animation: 'float-orb 6s ease-in-out infinite' }}
        />
      ))}
    </div>
  )
}
