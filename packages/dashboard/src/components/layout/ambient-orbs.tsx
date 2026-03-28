const orbClassNames = [
  // Top-left — soft matcha green, large focal orb
  'absolute -left-16 -top-8 h-48 w-48 rounded-full bg-[var(--organic-circle-1)]/60 blur-[32px]',
  // Top-right — warm amber, medium
  'absolute right-24 top-20 h-36 w-36 rounded-full bg-[var(--organic-circle-2)]/55 blur-[24px]',
  // Bottom-right — soft green, large
  'absolute -bottom-8 -right-10 h-52 w-52 rounded-full bg-[var(--organic-circle-3)]/50 blur-[40px]',
  // Center-left — lilac accent orb, soft
  'absolute left-[15%] top-[40%] h-28 w-28 rounded-full bg-[var(--card-lilac)]/50 blur-[28px]',
  // Bottom-center — warm peach glow
  'absolute bottom-[10%] left-[45%] h-24 w-24 rounded-full bg-[var(--card-peach)]/45 blur-[20px]',
] as const

export function AmbientOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {orbClassNames.map((className, index) => (
        <div
          key={index}
          className={className}
          style={{
            animation: `float-orb ${String(6 + index * 1.2)}s ease-in-out infinite`,
            animationDelay: `${String(index * 0.8)}s`,
          }}
        />
      ))}
    </div>
  )
}
