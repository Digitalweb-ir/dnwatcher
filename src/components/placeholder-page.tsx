import { Construction, type LucideIcon } from 'lucide-react'

import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * صفحه‌ی موقت برای بخش‌هایی که در مرحله‌های بعدی ساخته می‌شوند.
 * با پیاده‌سازی هر بخش، این کامپوننت با محتوای واقعی جایگزین می‌شود.
 */
export function PlaceholderPage({
  title,
  description,
  step,
  items,
}: {
  title: string
  description: string
  step: number
  items: { icon: LucideIcon; title: string; text: string }[]
}) {
  return (
    <AppShell
      title={title}
      description={description}
      actions={<Badge variant="outline">مرحله {step} از ۱۱</Badge>}
    >
      <Card className="card-glow border-dashed bg-card/60">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Construction className="size-5" />
            </span>
            <div>
              <CardTitle>در حال ساخت</CardTitle>
              <CardDescription>این بخش در مرحله‌ی {step} پیاده‌سازی می‌شود.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map(({ icon: Icon, title: itemTitle, text }) => (
              <li
                key={itemTitle}
                className="rounded-xl border border-border bg-background/40 p-4 transition-colors hover:border-primary/40"
              >
                <Icon className="size-5 text-primary" />
                <p className="mt-2.5 text-sm font-semibold">{itemTitle}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </AppShell>
  )
}
