import type { ReactNode } from 'react'
import { StickerLabel } from '~/components/atoms/sticker-label'

interface PageShellProps {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}

export function PageShell({ eyebrow, title, description, actions, children }: PageShellProps) {
  return (
    <div className="relative space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <StickerLabel tone="warning" tilt="flat">
            {eyebrow}
          </StickerLabel>
          <div className="space-y-2">
            <h1 className="font-heading text-3xl font-extrabold md:text-5xl">{title}</h1>
            <p className="font-ui-body max-w-2xl text-sm leading-7 text-[var(--text-secondary)] md:text-base">
              {description}
            </p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      {children}
    </div>
  )
}
