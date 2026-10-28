'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, PlugZap, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { ServerForm } from '@/components/server-form'
import { StatusDot, toneOfStatus } from '@/components/status-dot'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { countryName, flagOf } from '@/lib/countries'
import { faMs, faPercent, faRelative, toFa } from '@/lib/format'
import type { ServerWithStats, ConfigWithStatus } from '@/lib/types'
import { AppShell } from '@/components/app-shell'
import Link from 'next/link'
import { useLiveUpdates } from '@/components/providers/live-update-provider'

/**
 * Component for professional number animations.
 */
function AnimatedNumber({ value, className }: { value: number | null; className?: string }) {
  const [displayValue, setDisplayValue] = useState(value ?? 0)
  const [isAnimating, setIsAnimating] = useState(false)
  const prevValueRef = useRef(value ?? 0)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    if (value === null) return
    if (animationRef.current) cancelAnimationFrame(animationRef.current)

    const start = prevValueRef.current
    const end = value
    prevValueRef.current = value

    if (start === end) return

    setIsAnimating(true)
    const diff = Math.abs(end - start)
    const duration = diff < 5 ? 900 : 500
    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = diff < 5 ? progress : 1 - Math.pow(1 - progress, 3)
      const current = Math.round(start + (end - start) * eased)
      setDisplayValue(current)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        animationRef.current = null
        setIsAnimating(false)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [value])

  if (value === null) return <span className={className}>—</span>
  return (
    <span
      className={cn(
        'tabular-nums inline-block relative',
        isAnimating && 'animate-pulse text-primary',
        className
      )}
      style={{
        transition: 'transform 0.15s ease-out, color 0.15s ease-out',
        transform: isAnimating ? 'scale(1.15)' : 'scale(1)',
        color: isAnimating ? '#6366f1' : 'inherit',
      }}
    >
      {toFa(displayValue)}
    </span>
  )
}

/**
 * Independent component for each config to react to SSE pulses.
 */
function ConfigCard({ config }: { config: ConfigWithStatus }) {
  // CRITICAL: Destructure 'updates' to trigger re-render on any SSE change
  const { updates, getConfigStats } = useLiveUpdates()

  // Depend on updates explicitly
  const live = useMemo(() => getConfigStats(config, config.id), [updates, config])

  const status = live.status ?? config.last_status
  const latency = live.latency ?? config.last_latency_ms
  const isTesting = live.isTesting
  const isUp = status === 'up'

  const latencyColor = latency
    ? latency < 150 ? 'text-up' : latency < 300 ? 'text-yellow-400' : 'text-down'
    : 'text-muted-foreground'

  return (
    <Card className={cn(
      'group relative overflow-hidden transition-all duration-300 border-border/50 bg-card/40 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg',
      isTesting && 'ring-2 ring-primary/50'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusDot tone={toneOfStatus(status)} pulse={isUp && !isTesting} className="mt-1" />
            <div className="min-w-0">
              <Link
                href={`/configs/${config.id}`}
                className="truncate text-sm font-bold hover:text-primary transition-colors"
              >
                {config.label ?? `کانفیگ #${config.id}`}
              </Link>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="uppercase text-[9px] px-1.5 py-0">
                  {config.protocol.toUpperCase()}
                </Badge>
                <span className={cn('text-[10px] tabular-nums', isTesting ? 'text-primary' : 'text-muted-foreground')}>
                  {isTesting ? 'در حال تست...' : config.last_checked_at ? faRelative(config.last_checked_at) : 'بدون تست'}
                </span>
              </div>
            </div>
          </div>
          <Button asChild variant="ghost" size="icon" className="size-8 text-muted-foreground group-hover:text-primary transition-colors">
            <Link href={`/configs/${config.id}`}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1 rounded-xl bg-muted/30 p-2 transition-colors group-hover:bg-muted/50">
            <span className="text-[9px] text-muted-foreground">تأخیر لحظه‌ای</span>
            <span className={cn('text-sm font-bold tabular-nums', latencyColor)}>
              <AnimatedNumber value={latency} />
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-muted/30 p-2 transition-colors group-hover:bg-muted/50">
            <span className="text-[9px] text-muted-foreground">دسترس‌پذیری</span>
            <span className={cn('text-sm font-bold tabular-nums', isUp ? 'text-up' : 'text-down')}>
              {config.uptime_24h !== null ? faPercent(config.uptime_24h) : '—'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface ServerDetailClientProps {
  server: ServerWithStats
  configs: ConfigWithStatus[]
}

export function ServerDetailClient({ server, configs: initialConfigs }: ServerDetailClientProps) {
  const router = useRouter()
  const [toDelete, setToDelete] = useState<ServerWithStats | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // CRITICAL: Destructure 'updates' to trigger re-render on any SSE change
  const { updates, getServerStats, isLive } = useLiveUpdates()

  async function act(action: 'check' | 'refresh') {
    const key = `${server.id}:${action}`
    setBusy(key)
    try {
      const response = await fetch(`/api/servers/${server.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = (await response.json()) as {
        error?: string
        result?: { up?: number; down?: number; configs?: number; error?: string | null }
        reconcile?: { parsed?: number; added?: number; error?: string }
      }

      if (!response.ok) {
        toast.error(data.error ?? 'عملیات ناموفق بود.')
        return
      }

      if (action === 'refresh') {
        if (data.reconcile?.error) toast.warning(data.reconcile.error)
        else toast.success(`${toFa(data.reconcile?.parsed ?? 0)} کانفیگ همگام شد.`)
      } else if (data.result?.error) {
        toast.warning(data.result.error)
      } else {
        toast.success(
          `بررسی انجام شد — ${toFa(data.result?.up ?? 0)} سالم، ${toFa(data.result?.down ?? 0)} مشکل‌دار.`,
        )
      }
      router.refresh()
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.')
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!toDelete) return
    setBusy(`delete:${toDelete.id}`)
    try {
      const response = await fetch(`/api/servers?id=${toDelete.id}`, { method: 'DELETE' })
      if (!response.ok) {
        toast.error('حذف سرور ناموفق بود.')
        return
      }
      toast.success('سرور حذف شد.')
      setToDelete(null)
      router.push('/servers')
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.')
    } finally {
      setBusy(null)
    }
  }

  // serverStats now depends on the updates object via getServerStats
  const serverStats = useMemo(() => getServerStats(server, server.id), [updates, server])
  const healthy = serverStats.down === 0 && serverStats.up > 0
  const tone = serverStats.up + serverStats.down === 0 ? 'idle' : healthy ? 'up' : 'down'

  return (
    <AppShell
      title={server.name}
      description={[
        `کشور: ${flagOf(server.country)} ${countryName(server.country)}`,
        `بازه بررسی: ${toFa(server.check_interval_sec)} ثانیه`,
        server.enabled === 0 && 'غیرفعال',
      ]
        .filter(Boolean)
        .join(' · ')}
      actions={
        <>
          <ServerForm server={server} />
          <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>حذف سرور</DialogTitle>
                <DialogDescription>
                  سرور «{server.name}» و همه‌ی کانفیگ‌ها و تاریخچه‌ی آن حذف می‌شود. این کار برگشت‌پذیر نیست.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setToDelete(null)} disabled={busy !== null}>
                  انصراف
                </Button>
                <Button variant="destructive" onClick={remove} disabled={busy !== null}>
                  {busy?.startsWith('delete:') ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  حذف کن
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setToDelete(server)} disabled={busy !== null} title="حذف سرور">
            <Trash2 />
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Card className="card-glow border-border/50 bg-card/40 py-5 transition-all hover:border-primary/30">
          <CardContent className="px-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <StatusDot tone={toneOfStatus(tone)} pulse={tone === 'up'} className="mt-1.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold">{server.name}</h1>
                    <Badge variant="secondary" className="text-[10px]">{flagOf(server.country)} {countryName(server.country)}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/40 border border-border/50">
                  <span className="text-muted-foreground">کانفیگ‌ها:</span>
                  <span className="fa-num font-bold text-foreground"><AnimatedNumber value={serverStats.up + serverStats.down} /></span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-up/10 border border-up/20">
                  <span className="text-up">سالم:</span>
                  <span className="fa-num font-bold text-up"><AnimatedNumber value={serverStats.up} /></span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-down/10 border border-down/20">
                  <span className="text-down">خطا:</span>
                  <span className="fa-num font-bold text-down"><AnimatedNumber value={serverStats.down} /></span>
                </div>
              </div>

              {/* Latency Stats - Modern Card Layout */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3" role="list" aria-label="آمار تاخیر سرور">
                <div className="group rounded-2xl bg-card border border-border/50 p-4 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5" role="listitem">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">میانگین</span>
                    <div className="size-2 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors" aria-hidden="true" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold tabular-nums text-foreground">
                      <AnimatedNumber value={serverStats.avgLatency ? Math.round(serverStats.avgLatency) : 0} />
                    </span>
                    <span className="text-[11px] text-muted-foreground self-end mb-0.5">ms</span>
                  </div>
                </div>
                <div className="group rounded-2xl bg-card border border-border/50 p-4 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5" role="listitem">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">میانه</span>
                    <div className="size-2 rounded-full bg-yellow-500/20 group-hover:bg-yellow-500/30 transition-colors" aria-hidden="true" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold tabular-nums text-foreground">
                      <AnimatedNumber value={server.median_latency ? Math.round(server.median_latency) : 0} />
                    </span>
                    <span className="text-[11px] text-muted-foreground self-end mb-0.5">ms</span>
                  </div>
                </div>
                <div className="group rounded-2xl bg-card border border-border/50 p-4 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5" role="listitem">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">صدک ۹۵</span>
                    <div className="size-2 rounded-full bg-orange-500/20 group-hover:bg-orange-500/30 transition-colors" aria-hidden="true" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold tabular-nums text-foreground">
                      <AnimatedNumber value={server.p95_latency ? Math.round(server.p95_latency) : 0} />
                    </span>
                    <span className="text-[11px] text-muted-foreground self-end mb-0.5">ms</span>
                  </div>
                </div>
              </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => act('check')} disabled={busy !== null} className="h-9 text-xs">
                  {busy === `${server.id}:check` ? <Loader2 className="animate-spin size-3.5 me-2" /> : <PlugZap className="size-3.5 me-2" />}
                  چک فوری
                </Button>
                <Button variant="ghost" size="sm" onClick={() => act('refresh')} disabled={busy !== null} title="تازه‌سازی ساب" className="h-9 text-xs">
                  {busy === `${server.id}:refresh` ? <Loader2 className="animate-spin size-3.5" /> : <RefreshCw className="size-3.5" />}
                </Button>
              </div>
            </div>

            {server.last_fetch_error && (
              <div className="mt-4 flex items-start gap-2 text-[11px] text-warn bg-warn/10 p-3 rounded-xl border border-warn/20">
                <TriangleAlert className="mt-px size-3.5 shrink-0" />
                <span className="line-clamp-2">{server.last_fetch_error}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <PlugZap className="size-4 text-primary" />
              کانفیگ‌های فعال
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-normal">
                {toFa(initialConfigs.length)} مورد یافت شد
              </Badge>
              {isLive && (
                <span className="flex items-center gap-1.5 text-up text-xs">
                  <span className="size-2 rounded-full bg-up animate-pulse" />
                  زنده
                </span>
              )}
            </div>
          </div>

          {initialConfigs.length === 0 ? (
            <Card className="border-dashed bg-card/40">
              <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary">
                  <PlugZap className="size-6" />
                </span>
                <p className="font-semibold">کانفیگی برای این سرور یافت نشد</p>
                <p className="text-sm text-muted-foreground">لینک ساب ممکن است خالی یا نامعتبر باشد.</p>
                <Button variant="outline" size="sm" onClick={() => act('refresh')}>
                  <RefreshCw className="size-3.5 me-2" /> تازه‌سازی ساب
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {initialConfigs.map((config) => (
                <ConfigCard key={config.id} config={config} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}