import { BrutalCard } from '~/components/molecules/brutal-card'
import { StickerLabel } from '~/components/atoms/sticker-label'

interface TipCardProps {
  children: React.ReactNode
  tilt?: 'left' | 'right' | 'flat'
  theme?: string
}

export function TipCard({ children, tilt = 'right', theme = 'theme-card-butter' }: TipCardProps) {
  return (
    <BrutalCard className={[theme, 'space-y-3'].join(' ')} tilt={tilt}>
      <StickerLabel tone="success" tilt={tilt}>
        Tip
      </StickerLabel>
      <p className="text-sm leading-7 text-[var(--text-secondary)] break-words">{children}</p>
    </BrutalCard>
  )
}
