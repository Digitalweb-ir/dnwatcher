'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, PlusCircle, Save } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { COUNTRIES, flagOf } from '@/lib/countries'
import type { ServerWithStats } from '@/lib/types'

/** بازه‌های آماده — کاربر می‌تواند عدد دلخواه هم وارد کند */
const INTERVAL_PRESETS = [60, 120, 300, 600, 1800] as const

/**
 * فرم افزودن/ویرایش سرور.
 *
 * نکته‌ی امنیتی: لینک ساب هرگز به کلاینت برگردانده نمی‌شود؛ در حالت ویرایش
 * فیلد خالی می‌ماند و فقط اگر کاربر مقداری وارد کند جایگزین می‌شود.
 */
export function ServerForm({ server }: { server?: ServerWithStats }) {
  const router = useRouter()
  const editing = server !== undefined

  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [name, setName] = useState(server?.name ?? '')
  const [country, setCountry] = useState(server?.country ?? 'DE')
  const [subUrl, setSubUrl] = useState('')
  const [interval, setIntervalSec] = useState(server?.check_interval_sec ?? 120)
  const [enabled, setEnabled] = useState((server?.enabled ?? 1) === 1)

  // با هر بار باز شدن دیالوگ، مقادیر از پراپ تازه می‌شوند
  useEffect(() => {
    if (!open) return
    setName(server?.name ?? '')
    setCountry(server?.country ?? 'DE')
    setSubUrl(server?.sub_url ?? '')
    setIntervalSec(server?.check_interval_sec ?? 120)
    setEnabled((server?.enabled ?? 1) === 1)
  }, [open, server])

  async function submit(event: React.FormEvent) {
    event.preventDefault()

    if (!name.trim()) {
      toast.error('نام سرور را وارد کنید.')
      return
    }
    if (!editing && !subUrl.trim()) {
      toast.error('لینک ساب را وارد کنید.')
      return
    }

    setPending(true)
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        country: country || null,
        check_interval_sec: interval,
        enabled: enabled ? 1 : 0,
      }
      if (subUrl.trim()) payload.sub_url = subUrl.trim()

      const response = await fetch('/api/servers', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: server.id, ...payload } : payload),
      })

      const data = (await response.json()) as {
        error?: string
        reconcile?: { added?: number; reactivated?: number; parsed?: number; error?: string }
      }

      if (!response.ok) {
        toast.error(data.error ?? 'ذخیره‌ی سرور ناموفق بود.')
        return
      }

      if (data.reconcile) {
        if (data.reconcile.error) {
          toast.warning(`سرور ذخیره شد، اما دریافت ساب ناموفق بود: ${data.reconcile.error}`)
        } else {
          toast.success(`سرور ذخیره شد — ${data.reconcile.parsed ?? 0} کانفیگ استخراج شد.`)
        }
      } else {
        toast.success('سرور ذخیره شد.')
      }

      setOpen(false)
      router.refresh()
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="sm">
            ویرایش
          </Button>
        ) : (
          <Button size="sm">
            <PlusCircle />
            افزودن سرور
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'ویرایش سرور' : 'افزودن سرور'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'برای تغییر لینک ساب، مقدار تازه را وارد کنید؛ در غیر این صورت خالی بگذارید.'
              : 'لینک ساب را وارد کنید تا کانفیگ‌های آن به‌صورت خودکار استخراج شوند.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="server-name">نام سرور</Label>
            <Input
              id="server-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: آلمان ۱"
              autoComplete="off"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="server-country">کشور</Label>
            <select
              id="server-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            >
              {COUNTRIES.map((item) => (
                <option key={item.code} value={item.code}>
                  {flagOf(item.code)} {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="server-sub">
              لینک ساب
            </Label>
            <Input
              id="server-sub"
              value={subUrl}
              onChange={(e) => setSubUrl(e.target.value)}
              placeholder="https://example.com/sub?token=…"
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              لینک ساب برای دریافت کانفیگ‌ها استفاده می‌شود.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="server-interval">بازه‌ی بررسی</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="server-interval"
                type="number"
                min={30}
                step={30}
                value={interval}
                onChange={(e) => setIntervalSec(Number(e.target.value) || 120)}
                className="w-28"
                dir="ltr"
              />
              <span className="text-xs text-muted-foreground">ثانیه</span>
              <div className="flex flex-wrap gap-1">
                {INTERVAL_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={interval === preset ? 'secondary' : 'ghost'}
                    size="sm"
                    className="fa-num h-7 px-2 text-[11px]"
                    onClick={() => setIntervalSec(preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">فعال باشد</p>
              <p className="text-[11px] text-muted-foreground">سرورهای غیرفعال در دورهای بررسی نادیده گرفته می‌شوند.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              انصراف
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />}
              {editing ? 'ذخیره‌ی تغییرات' : 'افزودن سرور'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
