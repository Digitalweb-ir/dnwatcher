'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Loader2,
  PlugZap,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
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
import type { ServerWithStats } from '@/lib/types'

/**
 * فهرست سرورها همراه با اکشن‌های زنده (چک فوری، تازه‌سازی ساب، حذف).
 */
export function ServersView({ servers }: { servers: ServerWithStats[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<ServerWithStats | null>(null)

  async function act(server: ServerWithStats, action: 'check' | 'refresh') {
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
      router.refresh()
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.')
    } finally {
      setBusy(null)
    }
  }

  if (servers.length === 0) {
    return (
      <Card className="border-dashed bg-card/40">
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/12 text-primary">
            <PlugZap className="size-6" />
          </span>
          <div>
            <p className="font-semibold">هنوز سروری اضافه نشده</p>
            <p className="mt-1 text-sm text-muted-foreground">
              یک لینک ساب وارد کنید تا کانفیگ‌های آن به‌صورت خودکار استخراج و پایش شوند.
            </p>
          </div>
          <ServerForm />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {servers.map((server) => {
        const checkBusy = busy === `${server.id}:check`
        const refreshBusy = busy === `${server.id}:refresh`
        const healthy = server.down_count === 0 && server.up_count > 0
        const tone = server.up_count + server.down_count === 0 ? 'idle' : healthy ? 'up' : 'down'

        // تعیین رنگ درخشش بر اساس وضعیت
        const glowColor = tone === 'up' ? 'group-hover:shadow-up/20' : tone === 'down' ? 'group-hover:shadow-down/20' : 'group-hover:shadow-primary/10'
        const accentColor = tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-primary'

        return (
          <Card key={server.id} className={cn(
            'group relative overflow-hidden transition-all duration-300 border-border/50 bg-card/40 hover:-translate-y-1',
            'hover:border-primary/40 hover:shadow-xl',
            glowColor
          )}>
            {/* افکت نوری پس‌زمینه (Glow Effect) */}
            <div className={cn(
              'absolute -right-10 -top-10 size-32 rounded-full blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-30',
              tone === 'up' ? 'bg-up' : tone === 'down' ? 'bg-down' : 'bg-primary'
            )} />

            <CardContent className="relative z-10 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <StatusDot tone={toneOfStatus(tone === 'idle' ? 'idle' : tone)} pulse={tone === 'up'} className="mt-1.5" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/servers/${server.id}`}
                        className="truncate text-base font-bold tracking-tight hover:text-primary transition-colors"
                      >
                        {server.name}
                      </Link>
                      <span className="text-xs text-muted-foreground opacity-80" title={server.country ?? ''}>
                        {flagOf(server.country)} {countryName(server.country)}
                      </span>
                      {server.enabled === 0 && <Badge variant="secondary" className="text-[10px]">غیرفعال</Badge>}
                    </div>

                    {server.last_fetch_error && (
                      <p className="mt-2 flex items-start gap-1.5 text-[11px] text-warn bg-warn/10 p-2 rounded-lg border border-warn/20">
                        <TriangleAlert className="mt-px size-3.5 shrink-0" />
                        <span className="line-clamp-2">{server.last_fetch_error}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setToDelete(server)}
                    disabled={busy !== null}
                    title="حذف سرور"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                  <Button asChild variant="ghost" size="icon" title="جزئیات">
                    <Link href={`/servers/${server.id}`}>
                      <ChevronLeft className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>

              {/* بخش آمارهای اصلی - طراحی متمرکز */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 rounded-2xl bg-muted/30 p-3 transition-colors group-hover:bg-muted/50">
                  <span className="text-[10px] text-muted-foreground">وضعیت کانفیگ‌ها</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-foreground">{toFa(server.up_count + server.down_count)}</span>
                    <span className="text-[10px] text-muted-foreground">کل</span>
                    <div className="flex gap-1">
                      <span className="text-[10px] text-up font-medium">{toFa(server.up_count)} سالم</span>
                      <span className="text-[10px] text-down font-medium">{toFa(server.down_count)} خطا</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 rounded-2xl bg-muted/30 p-3 transition-colors group-hover:bg-muted/50">
                  <span className="text-[10px] text-muted-foreground">میانگین تاخیر</span>
                  <div className="flex items-baseline gap-1">
                    <span className={cn('text-lg font-bold transition-colors', accentColor)}>
                      {server.avg_latency ? faMs(server.avg_latency) : '—'}
                    </span>
                    <div className="size-1.5 rounded-full bg-current animate-pulse" />
                  </div>
                </div>
              </div>

              {/* اکشن‌های سریع در پایین کارت */}
              <div className="mt-5 flex items-center gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-9 text-xs font-medium transition-all hover:bg-primary/10"
                  onClick={() => act(server, 'check')}
                  disabled={busy !== null}
                >
                  {checkBusy ? <Loader2 className="animate-spin size-3.5 me-2" /> : <PlugZap className="size-3.5 me-2" />}
                  چک فوری
                </Button>
                <Button
                  variant="ghost"
                  className="h-9 px-3 transition-all hover:bg-primary/10"
                  onClick={() => act(server, 'refresh')}
                  disabled={busy !== null}
                  title="تازه‌سازی لینک ساب"
                >
                  {refreshBusy ? <Loader2 className="animate-spin size-3.5" /> : <RefreshCw className="size-3.5" />}
                </Button>
                <ServerForm server={server} />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

