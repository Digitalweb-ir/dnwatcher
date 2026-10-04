'use client'

import { motion } from 'framer-motion'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { toFa } from '@/lib/format'
import { useEffect, useRef, useState } from 'react'

export interface TimelineCell {
  t: number
  total: number
  up: number
  avg_latency: number | null
}

export interface TimelineRowData {
  key: string
  label: string
  sublabel: string
  href: string
  cells: TimelineCell[]
  uptime: number | null
  avgLatency: number | null
}

interface TimelineGridProps {
  rows: TimelineRowData[]
  windowStart: number
  windowEnd: number
  bucketMs: number
  emptyLabel?: string
  activeTests?: Set<number>
}

const MAX_DISPLAY_COLS = 60

function pad2(n: number): string {
  return toFa(n).padStart(2, '۰')
}

function formatClock(ts: number): string {
  const d = new Date(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${toFa(d.getMonth() + 1)}/${toFa(d.getDate())}`
}

function AnimatedLatency({ value }: { value: number | null }) {
  const [display, setDisplay] = useState(value ?? 0)
  const prevRef = useRef(value ?? 0)

  useEffect(() => {
    const next = value ?? 0
    const prev = prevRef.current
    prevRef.current = next

    if (prev === next) {
      setDisplay(next)
      return
    }

    const duration = 600
    const start = performance.now()
    let raf = 0

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(prev + (next - prev) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  if (value === null) return null
  return <span className="tabular-nums">{toFa(display)}ms</span>
}

function TimelineCellItem({
  cell,
  isActive,
  index,
  displayCols,
  showDate,
}: {
  cell: TimelineCell
  isActive: boolean
  index: number
  displayCols: number
  showDate: boolean
}) {
  const isUp = cell.up > 0
  const isDown = cell.total > 0 && cell.up === 0

  // فقط ستون آخر (نزدیک به now) برای تست در حال اجرا pulse می‌خورد
  const isTesting = isActive && index === displayCols - 1

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          initial={{ scaleY: 0.45, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ delay: Math.min(index * 0.003, 0.25) }}
          className={cn(
            'h-7 w-full origin-bottom rounded-[2px] transition-all duration-500',
            isTesting
              ? 'animate-pulse bg-primary/55 shadow-[0_0_12px_rgba(99,102,241,0.75)]'
              : isUp
                ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                : isDown
                  ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                  : 'bg-muted/30',
          )}
        />
      </TooltipTrigger>

      <TooltipContent className="bg-card/90 backdrop-blur-md border-border/50 p-2 text-xs">
        <div className="font-medium text-primary">{showDate ? formatDate(cell.t) : formatClock(cell.t)}</div>

        {isTesting ? (
          <div className="mt-1 text-primary">در حال تست…</div>
        ) : cell.total > 0 ? (
          <>
            <div className="mt-1 flex gap-2">
              <span className={isUp ? 'text-green-500' : 'text-red-500'}>
                {isUp ? '✓ موفق' : '✗ ناموفق'}
              </span>
              {cell.avg_latency !== null && (
                <span className="text-muted-foreground">
                  <AnimatedLatency value={cell.avg_latency} />
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {toFa(cell.up)} / {toFa(cell.total)}
            </div>
          </>
        ) : (
          <div className="text-muted-foreground mt-1">بدون تست</div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

export function TimelineGrid({
  rows,
  windowStart,
  windowEnd,
  bucketMs,
  emptyLabel = 'داده‌ای یافت نشد',
  activeTests,
}: TimelineGridProps) {
  if (rows.length === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">{emptyLabel}</div>
  }

  if (bucketMs <= 0 || windowEnd <= windowStart) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">{emptyLabel}</div>
  }

  // هم‌تراز با bucketهای SQL (این مهمه تا سلول‌ها دقیقاً match شوند)
  const firstBucketStart = Math.floor(windowStart / bucketMs) * bucketMs
  const lastBucketEnd = Math.ceil(windowEnd / bucketMs) * bucketMs

  const totalBuckets = Math.max(1, Math.floor((lastBucketEnd - firstBucketStart) / bucketMs))

  const displayCols = Math.min(MAX_DISPLAY_COLS, totalBuckets)
  const stepBuckets = totalBuckets / displayCols

  const showDate = bucketMs >= 24 * 3600 * 1000

  // برای RTL: کانتینر را LTR بگذاریم تا اسکرول اول سمت چپ/شروع محور درست نمایش داده شود.
  return (
    <div className="overflow-x-auto" dir="ltr">
      <div className="grid gap-2" style={{ gridAutoRows: 'min-content' }}>
        {rows.map((row) => {
          const isActive = activeTests?.has(Number(row.key)) ?? false

          // کلید به دست می‌آید چون از bucketهای هم‌تراز SQL استفاده می‌کنیم.
          return (
            <div
              key={row.key}
              className="grid gap-0.5"
              style={{ gridTemplateColumns: `repeat(${displayCols}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: displayCols }).map((_, i) => {
                const startBucketIdx = Math.floor(i * stepBuckets)
                const endBucketIdx = Math.min(totalBuckets, Math.floor((i + 1) * stepBuckets))

                const bucketStart = firstBucketStart + startBucketIdx * bucketMs
                const bucketEnd = firstBucketStart + Math.max(startBucketIdx + 1, endBucketIdx) * bucketMs

                // اگر downsample داریم، داخل بازه‌ی bucketهای واقعی aggregate می‌کنیم.
                let total = 0
                let up = 0
                let latWeighted = 0
                let latCount = 0

                for (const c of row.cells) {
                  if (c.t >= bucketStart && c.t < bucketEnd) {
                    total += c.total
                    up += c.up
                    if (c.avg_latency !== null && c.up > 0) {
                      latWeighted += c.avg_latency * c.up
                      latCount += c.up
                    }
                  }
                }

                const avg_latency = latCount > 0 ? latWeighted / latCount : null

                return (
                  <TimelineCellItem
                    key={i}
                    cell={{
                      t: bucketStart,
                      total,
                      up,
                      avg_latency,
                    }}
                    isActive={isActive}
                    index={i}
                    displayCols={displayCols}
                    showDate={showDate}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
