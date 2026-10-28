'use client'

import { useState, useEffect } from 'react'
import { useLiveUpdates } from '@/components/providers/live-update-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Activity, Pause, Play, Wifi, WifiOff } from 'lucide-react'
import { toFa } from '@/lib/format'

export function MonitoringStatus() {
  const { updates, isLive } = useLiveUpdates()
  const [schedulerStatus, setSchedulerStatus] = useState<{
    running: boolean
    paused: boolean
  } | null>(null)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    fetch('/api/scheduler')
      .then(res => res.json())
      .then(setSchedulerStatus)
      .catch(console.error)
  }, [])

  async function toggleScheduler() {
    setIsPending(true)
    try {
      const action = schedulerStatus?.paused ? 'resume' : 'pause'
      const res = await fetch('/api/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      setSchedulerStatus(data.status)
    } catch (error) {
      console.error('Failed to toggle scheduler:', error)
    } finally {
      setIsPending(false)
    }
  }

  if (schedulerStatus === null) return null

  const isRunning = schedulerStatus.running && !schedulerStatus.paused
  const cycle = updates.cycleState

  return (
    <div className="rounded-xl border border-sidebar-border bg-card/60 p-3 transition-all duration-500">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">وضعیت پایش</span>
        <Badge
          variant="secondary"
          className={cn(
            "gap-1.5 transition-all duration-500",
            isRunning ? "bg-up/20 text-up border-up/30" : "bg-muted text-muted-foreground"
          )}
        >
          <span className={cn(
            "size-1.5 rounded-full transition-all duration-500",
            isRunning ? "bg-up animate-pulse" : "bg-idle"
          )} />
          {isRunning ? 'فعال' : 'متوقف'}
        </Badge>
      </div>

      <div className="mt-3 space-y-3">
        {/* Cycle Info */}
        {cycle?.running ? (
          <div className="flex items-center gap-2 text-[11px] text-primary animate-pulse">
            <Activity className="size-3" />
            <span>در حال بررسی {toFa(cycle.configs)} کانفیگ...</span>
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {schedulerStatus.paused
              ? 'پایش به صورت دستی متوقف شده است.'
              : 'موتور بررسی در انتظار دور بعدی است.'}
          </p>
        )}

        {/* Connection Status */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className={cn(
            "flex items-center gap-1.5 text-[10px] font-medium transition-colors",
            isLive ? "text-up/80" : "text-down/80"
          )}>
            {isLive ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
            {isLive ? 'اتصال زنده برقرار' : 'اتصال قطع است'}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="size-6 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={toggleScheduler}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : isRunning ? (
              <Pause className="size-3" />
            ) : (
              <Play className="size-3" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Helper for loader in button
function Loader2({ className }: { className?: string }) {
  return <div className={cn("animate-spin", className)} style={{ border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
}
