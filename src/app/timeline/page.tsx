import { Suspense } from 'react'
import { Activity, CalendarRange, Timer, Flame, BarChart3 } from 'lucide-react'

import { TimelineView } from '@/components/timeline-view'
import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = { title: 'تایم‌لاین' }

function TimelineContent() {
  return (
    <AppShell
      title="تایم‌لاین"
      description="نمای تاریخی سلامت و تأخیر کانفیگ‌ها در بازه‌های مختلف"
      actions={<Badge variant="secondary">مرحله ۸</Badge>}
    >
      <TimelineView />

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: Activity, title: 'نوار سلامت رنگی', text: 'هر خانه یک بازه‌ی زمانی است؛ سبز یعنی پاسخ موفق، قرمز یعنی timeout یا خطا.' },
          { icon: CalendarRange, title: 'چهار بازه‌ی زمانی', text: '۲۴ ساعته، هفتگی، ماهانه و سالانه با تفکیک خودکار سلول‌ها.' },
          { icon: Timer, title: 'نمودار تأخیر', text: 'روند میانگین و صدک ۹۵ تأخیر در کنار نوار سلامت.' },
          { icon: Flame, title: 'نقشه‌ی رخدادها', text: 'بازه‌های قطعی پیوسته به‌صورت یک رخداد با مدت مشخص ثبت می‌شوند.' },
          { icon: BarChart3, title: 'مقایسه‌ی سرورها', text: 'مقایسه‌ی هم‌زمان چند کانفیگ روی یک محور زمانی.' },
        ].map(({ icon: Icon, title, text }, index) => (
          <Card key={title} className="card-glow border-border/70 bg-card/60 py-4 transition-colors hover:border-primary/30">
            <CardContent className="px-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                  <Icon className="size-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    <span className="fa-num me-1.5 text-muted-foreground">{index + 1}.</span>
                    {title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </AppShell>
  )
}

export default function TimelinePage() {
  return (
    <Suspense fallback={<div className="flex flex-col gap-2"><Skeleton className="h-10 w-full rounded" /><Skeleton className="h-[300px] w-full rounded" /></div>}>
      <TimelineContent />
    </Suspense>
  )
}