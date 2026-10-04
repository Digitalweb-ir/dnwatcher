import { cn } from '@/lib/utils'

const TONES = {
  up: 'bg-up shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-up)_22%,transparent)]',
  down: 'bg-down shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-down)_22%,transparent)]',
  warn: 'bg-warn shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-warn)_22%,transparent)]',
  idle: 'bg-idle',
} as const

export type DotTone = keyof typeof TONES

/** نقطه‌ی وضعیت — سبز/قرمز/زرد/خاکستری */
export function StatusDot({
  tone = 'idle',
  pulse = false,
  className,
}: {
  tone?: DotTone
  pulse?: boolean
  className?: string
}) {
  return (
    <span className={cn('relative inline-flex size-2.5 shrink-0 rounded-full', TONES[tone], className)}>
      {pulse && (
        <span className={cn('absolute inset-0 animate-ping rounded-full opacity-60', TONES[tone])} aria-hidden />
      )}
    </span>
  )
}

/** تبدیل وضعیت کانفیگ به رنگ نقطه */
export function toneOfStatus(status: string | null | undefined): DotTone {
  if (status === 'up') return 'up'
  if (status === 'down') return 'down'
  if (status === 'idle') return 'warn'
  return 'idle'
}
