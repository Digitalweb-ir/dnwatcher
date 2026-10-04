import type { LucideIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const TONES = {
  default: 'text-foreground',
  primary: 'text-primary',
  up: 'text-up',
  down: 'text-down',
  warn: 'text-warn',
  idle: 'text-idle',
} as const

const ICON_TONES = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/12 text-primary',
  up: 'bg-up/12 text-up',
  down: 'bg-down/12 text-down',
  warn: 'bg-warn/12 text-warn',
  idle: 'bg-muted text-idle',
} as const

export type StatTone = keyof typeof TONES

/** کارت آمار — پایه‌ی نمایش شاخص‌های داشبورد */
export function StatCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone = 'default',
  className,
}: {
  label: string
  value: string
  unit?: string
  hint?: string
  icon: LucideIcon
  tone?: StatTone
  className?: string
}) {
  return (
    <Card className={cn('card-glow gap-0 overflow-hidden border-border/70 bg-card/60 py-4', className)}>
      <div className="flex items-start justify-between gap-3 px-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 flex items-baseline gap-1">
            <span className={cn('fa-num text-2xl font-bold tracking-tight', TONES[tone])}>{value}</span>
            {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
          </p>
        </div>
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', ICON_TONES[tone])}>
          <Icon className="size-[18px]" />
        </span>
      </div>
      {hint && <p className="mt-3 border-t border-border/60 px-4 pt-2.5 text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  )
}
