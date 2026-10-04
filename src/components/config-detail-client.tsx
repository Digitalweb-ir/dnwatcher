'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, RefreshCw, TrendingUp, Clock, CheckCircle2, Activity, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

import { TimelineGrid, type TimelineRowData } from '@/components/timeline-grid'
import { StatusDot, toneOfStatus } from '@/components/status-dot'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { faMs, toFa, faRelative, faDuration } from '@/lib/format'
import type { ConfigWithStatus, ConfigStats } from '@/lib/types'

const WINDOWS = [
  { key: '1h', label: '۱ ساعت' },
  { key: '24h', label: '۲۴ ساعت' },
  { key: '7d', label: '۷ روز' },
  { key: '30d', label: '۳۰ روز' },
] as const

type WindowKey = (typeof WINDOWS)[number]['key']

interface TimelineRow extends TimelineRowData {
  config_id: number
}

interface ConfigWithStats extends ConfigWithStatus {
  stats?: ConfigStats
}

export function ConfigDetailClient({ config }: { config: ConfigWithStats }) {
  const router = useRouter()
  const [windowKey, setWindowKey] = useState<WindowKey>('24h')
  const [rows, setRows] = useState<TimelineRow[] | null>(null)
  const [meta, setMeta] = useState<{ since: number; until: number; bucketMs: number } | null>(null)
  const [stats, setStats] = useState<ConfigStats | null>(null)
  const [loading, setLoading] = useState(true)

  const query = useMemo(() => {
    const params = new URLSearchParams({ window: windowKey, configIds: String(config.id) })
    return params.toString()
  }, [windowKey, config.id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetch(`/api/timeline?${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('دریافت تایم‌لاین ناموفق بود')
        return (await response.json()) as {
          rows: TimelineRow[]
          since: number
          until: number
          bucketMs: number
          stats: ConfigStats | null
        }
      })
      .then((data) => {
        if (cancelled) return
        setRows(data.rows)
        setMeta({ since: data.since, until: data.until, bucketMs: data.bucketMs })
        setStats(data.stats)
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
  }, [query])

  useEffect(() => {
    const source = new EventSource('/api/stream')
    const reload = () => router.refresh()
    source.addEventListener('cycle:state', reload)
    return () => {
      source.removeEventListener('cycle:state', reload)
      source.close()
    }
  }, [router])

  return (
    <div className="flex flex-col gap-6">
      {/* هدر کانفیگ - طراحی مدرن و متمرکز */}
      <Card className="card-glow border-border/50 bg-card/40 py-5 transition-all hover:border-primary/30">
        <CardContent className="px-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <StatusDot tone={toneOfStatus(config.last_status)} pulse={config.last_status === 'up'} className="mt-1.5" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold truncate">{config.label ?? `کانفیگ #${config.id}`}</h1>
                  <Badge variant="secondary" className="uppercase text-[10px] px-1.5 py-0">
                    {config.protocol.toUpperCase()}
                  </Badge>
                  {config.enabled === 0 && <Badge variant="outline" className="text-[10px]">غیرفعال</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  سرور: <span className="text-foreground font-medium">{config.server_name}</span> · آدرس: {config.address ?? '—'} : {config.port ?? '—'}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" /> {config.last_checked_at ? faRelative(config.last_checked_at) : 'بدون بررسی'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Activity className="size-3" /> {config.last_latency_ms !== null ? faMs(config.last_latency_ms) : '—'}
                  </span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" asChild title="بازگشت" className="hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
              <Link href={`/servers/${config.server_id}`}>
                <ChevronLeft />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* کنترلر تایم‌فریم - حالا در صدر صفحه */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">بازه زمانی:</span>
            <div className="flex p-1 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
              {WINDOWS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setWindowKey(item.key)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200',
                    windowKey === item.key
                      ? 'bg-primary text-primary-foreground shadow-md scale-105'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.refresh()} disabled={loading} className="h-9 text-xs">
            {loading ? <Loader2 className="animate-spin size-3.5 me-2" /> : <RefreshCw className="size-3.5 me-2" />}
            تازه‌سازی داده‌ها
          </Button>
        </div>

        {/* آمار متغیر بر اساس تایم‌فریم */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatBlock label="مجموع تست‌ها" value={toFa(stats?.total ?? 0)} icon={Activity} />
          <StatBlock label="موفق" value={toFa(stats?.up_count ?? 0)} tone="up" icon={CheckCircle2} />
          <StatBlock label="میانگین تأخیر" value={faMs(stats?.avg_latency)} tone="warn" icon={Clock} />
          <StatBlock label="صدک ۹۵" value={faMs(stats?.p95_latency)} tone="down" icon={AlertCircle} />
        </section>
      </div>

      {/* تایم‌لاین با استایل ارتقا یافته */}
      <div className="flex flex-col gap-4">
        <Card className="card-glow border-border/50 bg-card/40 py-5 transition-all hover:border-primary/30">
          <CardContent className="px-5">
            {loading && rows === null ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} className="h-11 w-full rounded-lg" />
                ))}
              </div>
            ) : meta ? (
              <TimelineGrid
                rows={rows?.map((r) => ({
                  key: String(r.config_id),
                  label: r.label,
                  sublabel: r.sublabel,
                  href: r.href,
                  cells: r.cells,
                  uptime: r.uptime,
                  avgLatency: r.avgLatency,
                })) ?? []}
                windowStart={meta.since}
                windowEnd={meta.until}
                bucketMs={meta.bucketMs}
                emptyLabel="در این بازه داده‌ای ثبت نشده است."
              />
            ) : null}
          </CardContent>
        </Card>

        {/* جزئیات آمار */}
        {stats && (
          <Card className="card-glow border-border/50 bg-card/40 py-5 transition-all hover:border-primary/30">
            <CardHeader className="px-5 pb-2">
              <CardTitle className="text-base font-bold">آنالیز عمیق وضعیت</CardTitle>
              <CardDescription>آمارهای تجمیعی برای بازه انتخابی</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatItem label="حداقل تأخیر" value={faMs(stats.min_latency)} />
              <StatItem label="حداکثر تأخیر" value={faMs(stats.max_latency)} />
              <StatItem label="میانه تأخیر" value={faMs(stats.median_latency)} />
              <StatItem label="تعداد رخدادها" value={toFa(stats.incident_count)} />
              <StatItem label="مدت قطعی" value={faDuration(stats.downtime_sec)} />
              <StatItem label="طولانی‌ترین بازه سالم" value={faDuration(stats.longest_healthy_sec ?? 0)} />
              <StatItem label="MTBF" value={stats.mtbf_sec ? faDuration(stats.mtbf_sec) : '—'} />
              <StatItem label="MTTR" value={stats.mttr_sec ? faDuration(stats.mttr_sec) : '—'} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function StatBlock({
  label,
  value,
  tone = 'default',
  icon: Icon,
}: {
  label: string
  value: string
  tone?: 'default' | 'up' | 'down' | 'warn'
  icon: typeof TrendingUp
}) {
  const TONES = {
    default: 'text-foreground',
    up: 'text-up',
    down: 'text-down',
    warn: 'text-warn',
  } as const

  return (
    <Card className="card-glow border-border/50 bg-card/40 py-3 transition-all hover:border-primary/30 group">
      <CardContent className="px-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">{label}</p>
          <Icon className="size-3 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className={cn('fa-num text-xl font-bold transition-colors', TONES[tone])}>{value}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-2xl bg-muted/30 transition-colors hover:bg-muted/50">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="fa-num font-mono text-sm font-semibold text-foreground">{value}</span>
    </div>
  )
}
