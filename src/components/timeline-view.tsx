'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw, Server } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

import { TimelineGrid, type TimelineRowData } from '@/components/timeline-grid'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const WINDOWS = [
  { key: '1h', label: '۱ ساعت' },
  { key: '4h', label: '۴ ساعت' },
  { key: '24h', label: '۲۴ ساعت' },
  { key: '7d', label: '۷ روز' },
  { key: '30d', label: '۳۰ روز' },
  { key: '1y', label: '۱ سال' },
] as const

type WindowKey = (typeof WINDOWS)[number]['key']

interface Row {
  config_id: number
  label: string | null
  server_name: string
  server_id: number
  protocol: string
  cells: { t: number; total: number; up: number; avg_latency: number | null }[]
  uptime: number | null
  avg_latency: number | null
}

export function TimelineView({ serverId }: { serverId?: number }) {
  const router = useRouter()
  const [windowKey, setWindowKey] = useState<WindowKey>('24h')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [meta, setMeta] = useState<{ since: number; until: number; bucketMs: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTests, setActiveTests] = useState<Set<number>>(new Set())

  const query = useMemo(() => {
    const params = new URLSearchParams({ window: windowKey })
    if (serverId !== undefined) params.set('serverId', String(serverId))
    return params.toString()
  }, [windowKey, serverId])

  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetch(`/api/timeline?${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('دریافت تایم‌لاین ناموفق بود')
        return (await response.json()) as {
          rows: Row[]
          since: number
          until: number
          bucketMs: number
        }
      })
      .then((data) => {
        if (cancelled) return
        setRows(data.rows)
        setMeta({ since: data.since, until: data.until, bucketMs: data.bucketMs })
      })
      .catch(() => {
        if (!cancelled) toast.error('دریافت تایم‌لاین ناموفق بود.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [query, reloadToken])

  useEffect(() => {
    const source = new EventSource('/api/stream')

    const handleCycleState = () => {
      setReloadToken((t) => t + 1)
    }

    const handleConfigStart = (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setActiveTests((prev) => {
        const next = new Set(prev)
        next.add(data.configId)
        return next
      })
    }

    const handleConfigCheck = (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      setActiveTests((prev) => {
        const next = new Set(prev)
        next.delete(data.configId)
        return next
      })
      // بازخوانی داده‌ی تایم‌لاین برای نمایش نتیجه‌ی تازه
      setReloadToken((t) => t + 1)
    }

    source.addEventListener('cycle:state', handleCycleState)
    source.addEventListener('config:start', handleConfigStart)
    source.addEventListener('config:check', handleConfigCheck)

    return () => {
      source.removeEventListener('cycle:state', handleCycleState)
      source.removeEventListener('config:start', handleConfigStart)
      source.removeEventListener('config:check', handleConfigCheck)
      source.close()
    }
  }, [])

  const groupedData = useMemo(() => {
    if (!rows) return []

    const groups: Record<string, { serverName: string; serverId: number; configs: TimelineRowData[] }> = {}

    rows.forEach(row => {
      const sName = row.server_name || 'سرور ناشناس'
      if (!groups[sName]) {
        groups[sName] = {
          serverName: sName,
          serverId: row.server_id,
          configs: []
        }
      }
      groups[sName].configs.push({
        key: String(row.config_id),
        label: row.label ?? `کانفیگ #${row.config_id}`,
        sublabel: `${row.protocol.toUpperCase()}`,
        href: `/configs/${row.config_id}`,
        cells: row.cells,
        uptime: row.uptime,
        avgLatency: row.avg_latency,
      })
    })

    return Object.values(groups)
  }, [rows])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card/50 p-1 backdrop-blur-md">
          {WINDOWS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setWindowKey(item.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200',
                windowKey === item.key
                  ? 'bg-primary text-primary-foreground shadow-sm scale-105'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={() => router.refresh()} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="animate-spin size-4" /> : <RefreshCw className="size-4" />}
          تازه‌سازی
        </Button>
      </div>

      <div className="flex flex-col gap-8">
        <AnimatePresence mode="wait">
          {loading && rows === null ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-4"
            >
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-8 w-48 rounded-lg" />
                  <Skeleton className="h-32 w-full rounded-xl" />
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-8"
            >
              {groupedData.length === 0 ? (
                <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
                  در این بازه داده‌ای یافت نشد.
                </div>
              ) : (
                groupedData.map((group) => (
                  <div key={group.serverId} className="space-y-4">
                    <div className="flex items-center gap-3 px-1">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Server className="size-4" />
                      </div>
                      <h3 className="text-sm font-bold text-foreground/90">{group.serverName}</h3>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {group.configs.length} کانفیگ
                      </Badge>
                    </div>

                    <Card className="card-glow border-border/70 bg-card/50 transition-all hover:border-primary/30">
                      <CardContent className="p-4">
                        <TimelineGrid
                          rows={group.configs}
                          windowStart={meta?.since ?? 0}
                          windowEnd={meta?.until ?? 0}
                          bucketMs={meta?.bucketMs ?? 0}
                          activeTests={activeTests}
                        />
                      </CardContent>
                    </Card>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
