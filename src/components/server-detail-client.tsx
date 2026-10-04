'use client'

import { useState } from 'react'
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

interface ServerDetailClientProps {
  server: ServerWithStats
  configs: ConfigWithStatus[]
}

export function ServerDetailClient({ server, configs }: ServerDetailClientProps) {
  const router = useRouter()
  const [toDelete, setToDelete] = useState<ServerWithStats | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

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

  const healthy = server.down_count === 0 && server.up_count > 0
  const tone = server.up_count + server.down_count === 0 ? 'idle' : healthy ? 'up' : 'down'

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
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>کانفیگ‌ها: <span className="fa-num font-medium text-foreground">{toFa(server.config_count)}</span></span>
                    <span className="text-up">سالم: <span className="fa-num font-medium">{toFa(server.up_count)}</span></span>
                    <span className="text-down">خطا: <span className="fa-num font-medium">{toFa(server.down_count)}</span></span>
                    <span>میانگین: <span className="fa-num font-medium text-foreground">{server.avg_latency ? faMs(server.avg_latency) : '—'}</span></span>
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
            <Badge variant="outline" className="text-[10px] font-normal">
              {toFa(configs.length)} مورد یافت شد
            </Badge>
          </div>

          {configs.length === 0 ? (
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
              {configs.map((config) => {
                const isUp = config.last_status === 'up'
                const latencyColor = config.last_latency_ms
                  ? config.last_latency_ms < 150 ? 'text-up' : config.last_latency_ms < 300 ? 'text-yellow-400' : 'text-down'
                  : 'text-muted-foreground'

                return (
                  <Card key={config.id} className="group relative overflow-hidden transition-all duration-300 border-border/50 bg-card/40 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <StatusDot tone={toneOfStatus(config.last_status)} pulse={isUp} className="mt-1" />
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
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {config.last_checked_at ? faRelative(config.last_checked_at) : 'بدون تست'}
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
                            {config.last_latency_ms !== null ? faMs(config.last_latency_ms) : '—'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 rounded-xl bg-muted/30 p-2 transition-colors group-hover:bg-muted/50">
                          <span className="text-[9px] text-muted-foreground">دسترس‌پذیری</span>
                          <span className={cn('text-sm font-bold tabular-nums', isUp ? 'text-up' : 'text-down')}>
                            {config.uptime_24h !== null ? faPercent(config.uptime_24h, 1) : '—'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}