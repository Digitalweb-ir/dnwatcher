'use client'

import { useState, useEffect } from 'react'
import { Activity, CheckCircle2, Clock } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { CycleState } from '@/lib/service/check'
import { faRelative, toFa } from '@/lib/format'

function StatMini({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'primary' | 'up' | 'down' | 'warn' | 'idle'
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border/50 bg-card/50 p-2.5">
      <span className="fa-num text-lg font-bold" style={{ color: `var(--color-${tone})` }}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}

export function CycleStatus() {
  const [state, setState] = useState<CycleState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchState() {
      try {
        const response = await fetch('/api/check')
        if (response.ok) {
          const data = await response.json()
          setState(data.state)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }

    fetchState()

    // لایو با SSE
    const source = new EventSource('/api/stream')
    source.addEventListener('cycle:state', (event) => {
      setState(JSON.parse(event.data))
    })
    return () => {
      source.close()
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-2">
        <Skeleton className="h-8 w-32 rounded" />
        <Skeleton className="h-8 w-24 rounded" />
      </div>
    )
  }

  if (!state) {
    return (
      <p className="text-sm text-muted-foreground">اطلاعات وضعیت در دسترس نیست.</p>
    )
  }

  const isRunning = state.running
  const lastRun = state.finishedAt ? faRelative(state.finishedAt) : 'هنوز اجرا نشده'
  const nextRun = state.startedAt
    ? `حدود ${toFa(Math.max(0, Math.ceil((state.startedAt + 15000 - Date.now()) / 1000)))} ثانیه دیگر`
    : '—'

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 p-3">
        <span className={`grid size-9 place-items-center rounded-xl ${
          isRunning ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground'
        }`}>
          {isRunning ? <Activity className="size-5 animate-spin" /> : <Clock className="size-5" />}
        </span>
        <div>
          <p className="font-medium">وضعیت</p>
          <p className="text-sm text-muted-foreground">
            {isRunning ? 'در حال اجرا…' : 'بیکار'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 p-3">
        <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground">
          <CheckCircle2 className="size-5" />
        </span>
        <div>
          <p className="font-medium">آخرین دور</p>
          <p className="text-sm text-muted-foreground">{lastRun}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 p-3">
        <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground">
          <Activity className="size-5" />
        </span>
        <div>
          <p className="font-medium">دور بعد</p>
          <p className="text-sm text-muted-foreground">{nextRun}</p>
        </div>
      </div>

      <div className="sm:col-span-3 grid gap-2 sm:grid-cols-4 text-center">
        <StatMini label="سرورها" value={toFa(state.servers)} />
        <StatMini label="کانفیگ‌ها" value={toFa(state.configs)} tone="primary" />
        <StatMini label="سالم" value={toFa(state.up)} tone="up" />
        <StatMini label="مشکل‌دار" value={toFa(state.down)} tone="down" />
      </div>

      {state.errors.length > 0 && (
        <div className="sm:col-span-3 rounded-lg border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
          <p className="font-medium">خطاهای آخرین دور:</p>
          <ul className="mt-1.5 list-disc list-inside space-y-0.5 max-h-32 overflow-auto">
            {state.errors.map((err, i) => (
              <li key={i} className="text-[11px] line-clamp-1">{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}