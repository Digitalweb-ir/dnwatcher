import { Suspense } from 'react'
import { PlusCircle, ServerCog, Link2, RefreshCw, Cable, ShieldCheck } from 'lucide-react'

import { ServersView } from '@/components/servers-view'
import { ServerForm } from '@/components/server-form'
import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { listServers } from '@/lib/db/queries'
import { isAuthed } from '@/lib/auth/guard'

export const metadata = { title: 'سرورها' }
export const dynamic = 'force-dynamic'

async function ServersContent() {
  const servers = listServers()
  const authenticated = await isAuthed()
  console.log('[ServersPage] Loaded servers from DB:', servers, '| Authenticated:', authenticated)
  return (
    <AppShell
      title="سرورها"
      description="مدیریت سرورها، لینک‌های ساب و کانفیگ‌های استخراج‌شده"
      actions={
        <>
          <Badge variant="secondary">مرحله ۸</Badge>
          {authenticated && <ServerForm />}
        </>
      }
    >
      <ServersView servers={servers} />

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: ServerCog, title: 'مدیریت سرور', text: 'افزودن، ویرایش و غیرفعال‌سازی سرور به‌همراه بازه‌ی بررسی اختصاصی.' },
          { icon: Link2, title: 'لینک ساب امن', text: 'لینک ساب هر سرور رمزنگاری‌شده ذخیره می‌شود و در فهرست نمایش داده نمی‌شود.' },
          { icon: RefreshCw, title: 'همگام‌سازی کانفیگ‌ها', text: 'کانفیگ‌های جدید اضافه و کانفیگ‌های حذف‌شده غیرفعال می‌شوند، بدون از دست رفتن تاریخچه.' },
          { icon: Cable, title: 'فهرست inboundها', text: 'وضعیت لحظه‌ای، تأخیر آخرین بررسی و درصد دسترس‌پذیری هر کانفیگ.' },
          { icon: ShieldCheck, title: 'صفحه‌ی جزئیات کانفیگ', text: 'تاریخچه‌ی کامل یک کانفیگ به‌همراه آمار تجمیعی و رخدادها.' },
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

export default function ServersPage() {
  return (
    <Suspense fallback={<div className="flex h-[400px] items-center justify-center">بارگذاری…</div>}>
      <ServersContent />
    </Suspense>
  )
}