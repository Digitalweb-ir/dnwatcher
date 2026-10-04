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
import { dashboardSummary } from '@/lib/db/queries'
import { faMs, faPercent, faRelative, toFa } from '@/lib/format'
import { CycleStatus } from '@/components/cycle-status'

export const metadata: Metadata = { title: 'داشبورد' }

function DashboardContent() {
  const summary = dashboardSummary()

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
      hint: 'نیازمند بررسی —-status down',
    },
    {
      label: 'میانگین تأخیر',
      value: faMs(summary.avg_latency),
      unit: 'میلی‌ثانیه',
      icon: Clock,
      tone: 'warn',
      hint: 'میانگین ۲۴ ساعت گذشته روی تست‌های موفق',
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

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex h-[400px] items-center justify-center">بارگذاری…</div>}>
      <DashboardContent />
    </Suspense>
  )
}