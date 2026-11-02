import { Suspense } from 'react'
import { Metadata } from 'next'
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Gauge,
  Link2,
  PlusCircle,
  ServerCog,
  XCircle,
  Server,
  TrendingUp,
  AlertTriangle,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

import { AppShell } from '@/components/app-shell'
import { StatCard, type StatTone } from '@/components/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { dashboardSummary, listServers, listIncidents } from '@/lib/db/queries'
import { faMs, faPercent, faRelative, toFa } from '@/lib/format'
import { CycleStatus } from '@/components/cycle-status'

export const metadata: Metadata = { title: 'داشبورد' }
export const dynamic = 'force-dynamic'

function DashboardContent() {
  const summary = dashboardSummary()
  const servers = listServers()
  const incidents = listIncidents({ limit: 5 })

  const enabledServers = servers.filter((s) => s.enabled === 1).length
  const disabledServers = servers.length - enabledServers
  const serversWithConfigs = servers.filter((s) => s.config_count > 0).length

  const STATS: {
    label: string
    value: string
    unit?: string
    icon: typeof Gauge
    tone: StatTone
    hint: string
  }[] = [
    {
      label: 'کانفیگ‌های فعال',
      value: toFa(summary.total_configs),
      icon: Gauge,
      tone: 'primary',
      hint: 'کانفیگ‌هایی که enabled = 1 هستند',
    },
    {
      label: 'سالم',
      value: toFa(summary.up_count),
      icon: CheckCircle2,
      tone: 'up',
      hint: 'آخرین دور بررسی — وضعیت up',
    },
    {
      label: 'قطع',
      value: toFa(summary.down_count),
      icon: XCircle,
      tone: 'down',
      hint: 'نیازمند بررسی — وضعیت down',
    },
    {
      label: 'بیکار',
      value: toFa(summary.idle_count),
      icon: Clock,
      tone: 'idle',
      hint: 'در انتظار بررسی مجدد (fail_streak < threshold)',
    },
    {
      label: 'میانگین تأخیر',
      value: faMs(summary.avg_latency),
      unit: 'میلی‌ثانیه',
      icon: Clock,
      tone: 'warn',
      hint: 'میانگین ۲۴ ساعت گذشته روی تست‌های موفق',
    },
    {
      label: 'آپتایم ۲۴ ساعت',
      value: summary.uptime_24h !== null ? faPercent(summary.uptime_24h) : '—',
      icon: TrendingUp,
      tone: summary.uptime_24h !== null && summary.uptime_24h >= 99 ? 'up' : 'warn',
      hint: 'درصد موفقیت بررسی‌ها در ۲۴ ساعت گذشته',
    },
    {
      label: 'سرورهای فعال',
      value: toFa(enabledServers),
      unit: `/ ${toFa(servers.length)}`,
      icon: Server,
      tone: 'primary',
      hint: `${serversWithConfigs} سرور با کانفیگ | ${disabledServers} غیرفعال`,
    },
    {
      label: 'رخدادهای ۲۴ ساعت',
      value: toFa(summary.total_incidents_24h),
      icon: AlertTriangle,
      tone: summary.total_incidents_24h > 0 ? 'down' : 'up',
      hint: 'تعداد کل رویدادهای قطعی در روز گذشته',
    },
  ]

  const STEPS = [
    {
      icon: ServerCog,
      title: 'لایه‌ی داده و ذخیره‌سازی',
      text: 'پایگاه‌داده SQLite و جدول‌های سرور، کانفیگ، بررسی و رخداد.',
    },
    {
      icon: Link2,
      title: 'افزودن سرور و لینک ساب',
      text: 'لینک ساب هر سرور را وارد کنید تا کانفیگ‌ها خودکار استخراج شوند.',
    },
    {
      icon: Activity,
      title: 'شروع پایش خودکار',
      text: 'موتور Xray در بازه‌ی دلخواه همه‌ی کانفیگ‌ها را می‌سنجد و ثبت می‌کند.',
    },
  ]

  return (
    <AppShell
      title="داشبورد"
      description="نمای کلی سلامت سرورها، کانفیگ‌ها و تأخیر اتصال"
      actions={
        <>
          <Badge variant="secondary">مرحله ۸</Badge>
          <Button asChild size="sm">
            <Link href="/servers">
              <PlusCircle />
              افزودن سرور
            </Link>
          </Button>
        </>
      }
    >
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map(({ label, value, unit, icon, tone, hint }) => (
          <StatCard
            key={label}
            label={label}
            value={value}
            unit={unit}
            hint={hint}
            icon={icon}
            tone={tone}
          />
        ))}
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Card className="card-glow border-border/70 bg-card/60">
          <CardHeader>
            <CardTitle>شروع سریع</CardTitle>
            <CardDescription>سه گام تا فعال شدن پایش شبانه‌روزی</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <div key={title}>
                <div className="flex items-start gap-3 py-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                    <Icon className="size-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      <span className="fa-num me-1.5 text-muted-foreground">{index + 1}.</span>
                      {title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </div>
                {index < STEPS.length - 1 && <Separator className="opacity-60" />}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <PlaceholderCard
            href="/timeline"
            icon={Activity}
            title="تایم‌لاین ۲۴ ساعته"
            text="نمای رنگی سلامت هر کانفیگ در بازه‌های ۲۴ ساعت، هفتگی، ماهانه و سالانه."
            step={8}
          />
          <PlaceholderCard
            href="/servers"
            icon={ServerCog}
            title="سرورها و کانفیگ‌ها"
            text="مدیریت سرورها، لینک ساب، وضعیت هر inbound و جزئیات تأخیر."
            step={8}
          />
        </div>
      </section>

      {/* سرورها — وضعیت کلی */}
      {servers.length > 0 && (
        <Card className="card-glow border-border/70 bg-card/60 mt-4">
          <CardHeader>
            <CardTitle>نمای سرورها</CardTitle>
            <CardDescription>وضعیت کلی هر سرور و تعداد کانفیگ‌های آن</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-start px-3 py-2 font-medium text-muted-foreground">نام</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">کشور</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">کانفیگ‌ها</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">سالم / قطع / بیکار</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">میانگین تأخیر</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">آخرین بررسی</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">وضعیت</th>
                    <th className="text-end px-3 py-2 font-medium text-muted-foreground">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {servers.map((server) => (
                    <tr key={server.id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="px-3 py-2.5 font-medium">{server.name}</td>
                      <td className="text-center px-3 py-2.5 text-muted-foreground">
                        {server.country ?? '—'}
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <span className="fa-num">{toFa(server.config_count)}</span>
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <span className="fa-num text-up">{toFa(server.up_count)}</span>
                        <span className="mx-1 text-muted-foreground">/</span>
                        <span className="fa-num text-down">{toFa(server.down_count)}</span>
                        <span className="mx-1 text-muted-foreground">/</span>
                        <span className="fa-num text-idle">{toFa(server.idle_count)}</span>
                      </td>
                      <td className="text-center px-3 py-2.5 text-muted-foreground">
                        {server.avg_latency ? `${toFa(Math.round(server.avg_latency))} ms` : '—'}
                      </td>
                      <td className="text-center px-3 py-2.5 text-muted-foreground">
                        {server.last_check_at
                          ? faRelative(server.last_check_at)
                          : 'هرگز'}
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            server.enabled === 1
                              ? 'bg-green-500/15 text-green-500'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {server.enabled === 1 ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td className="text-end px-3 py-2.5">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/servers/${server.id}`}>مشاهده</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* رخدادهای اخیر */}
      {(incidents.length > 0 || summary.total_incidents_24h > 0) && (
        <Card className="card-glow border-border/70 bg-card/60 mt-4">
          <CardHeader>
            <CardTitle>رخدادهای اخیر (۲۴ ساعت)</CardTitle>
            <CardDescription>آخرین ۵ رخداد قطعی و بازگشت</CardDescription>
          </CardHeader>
          <CardContent>
            {incidents.length > 0 ? (
              <div className="space-y-2">
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-card/50 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-full ${
                          inc.ended_at ? 'bg-up/15 text-up' : 'bg-down/15 text-down animate-pulse'
                        }`}
                      >
                        {inc.ended_at ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {inc.server_name} — {inc.label ?? `کانفیگ #${inc.config_id}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          شروع: {faRelative(inc.started_at)}
                          {inc.ended_at ? ` • پایان: ${faRelative(inc.ended_at)}` : ' • در حال ادامه'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        inc.ended_at
                          ? 'bg-up/15 text-up'
                          : 'bg-down/15 text-down animate-pulse'
                      }`}
                    >
                      {inc.ended_at ? 'حل شده' : 'فعال'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                رخدادی در ۲۴ ساعت گذشته ثبت نشده است.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* وضعیت چرخه بررسی */}
      <Card className="card-glow border-border/70 bg-card/60 mt-4">
        <CardHeader>
          <CardTitle>موتور بررسی</CardTitle>
          <CardDescription>آخرین دور بررسی و وضعیت زمان‌بند</CardDescription>
        </CardHeader>
        <CardContent>
          <CycleStatus />
        </CardContent>
      </Card>

      {/* آمار کلی سیستم */}
      <Card className="card-glow border-border/70 bg-card/60 mt-4">
        <CardHeader>
          <CardTitle>آمار کلی سیستم</CardTitle>
          <CardDescription>نمای خلاصه از کل داده‌های ذخیره‌شده</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatMini label="کل سرورها" value={toFa(servers.length)} icon={ServerCog} />
          <StatMini label="کل کانفیگ‌ها" value={toFa(summary.total_configs + summary.idle_count)} icon={Gauge} tone="primary" />
          <StatMini label="کل بررسی‌ها (۲۴س)" value={toFa(summary.uptime_24h !== null ? Math.round(summary.uptime_24h * (summary.total_configs || 1) / 100) : 0)} icon={Activity} tone="primary" />
          <StatMini label="زمان سرور" value={faRelative(Date.now())} icon={Zap} tone="warn" />
        </CardContent>
      </Card>
    </AppShell>
  )
}

function PlaceholderCard({
  href,
  icon: Icon,
  title,
  text,
  step,
}: {
  href: string
  icon: typeof Activity
  title: string
  text: string
  step: number
}) {
  return (
    <Card className="card-glow group relative gap-0 border-border/70 bg-card/60 py-4 transition-colors hover:border-primary/40">
      <CardContent className="px-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Icon className="size-[18px]" />
          </span>
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge variant="secondary" className="ms-auto fa-num text-[10px]">
            مرحله {step}
          </Badge>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{text}</p>
        <Button asChild variant="ghost" size="sm" className="mt-2 -ms-2 text-primary">
          <Link href={href}>
            مشاهده
            <ArrowLeft />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function StatMini({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: string
  icon: typeof Gauge
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

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex h-[400px] items-center justify-center">بارگذاری…</div>}>
      <DashboardContent />
    </Suspense>
  )
}