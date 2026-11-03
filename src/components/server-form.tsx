'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, PlusCircle, Save } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { serverSchema, type ServerFormData } from '@/lib/forms-schema'

/** بازه‌های آماده — کاربر می‌تواند عدد دلخواه هم وارد کند */
const INTERVAL_PRESETS = [60, 120, 300, 600, 1800] as const

/**
 * فرم افزودن/ویرایش سرور.
 *
 * در حالت ویرایش، لینک ساب فعلی نمایش داده می‌شود.
 * اگر کاربر مقدار جدیدی وارد نکند، لینک قبلی حفظ می‌شود.
 */
export function ServerForm({ server }: { server?: ServerWithStats }) {
  const router = useRouter()
  const editing = server !== undefined

  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const form = useForm<ServerFormData>({
    resolver: zodResolver(serverSchema),
    defaultValues: {
      name: server?.name ?? '',
      country: server?.country ?? 'DE',
      sub_url: editing ? (server?.sub_url ?? '') : '',
      check_interval_sec: server?.check_interval_sec ?? 120,
      enabled: (server?.enabled ?? 1) === 1 ? 1 : 0,
    },
    mode: 'onChange',
  })

  // با هر بار باز شدن دیالوگ، مقادیر از پراپ تازه می‌شوند
  useEffect(() => {
    if (!open) return
    form.reset({
      name: server?.name ?? '',
      country: server?.country ?? 'DE',
      sub_url: editing ? (server?.sub_url ?? '') : '',
      check_interval_sec: server?.check_interval_sec ?? 120,
      enabled: (server?.enabled ?? 1) === 1 ? 1 : 0,
    })
  }, [open, server, form, editing])

  async function onSubmit(data: ServerFormData) {
    if (!editing && !data.sub_url?.trim()) {
      toast.error('لینک ساب را وارد کنید.')
      return
    }

    setPending(true)
    try {
      const payload: Record<string, unknown> = {
        name: data.name.trim(),
        country: data.country || null,
        check_interval_sec: data.check_interval_sec,
        enabled: data.enabled,
      }
      if (data.sub_url?.trim()) payload.sub_url = data.sub_url.trim()

      const response = await fetch('/api/servers', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: server!.id, ...payload } : payload),
      })

      const result = (await response.json()) as {
        error?: string
        reconcile?: { added?: number; reactivated?: number; parsed?: number; error?: string }
      }

      if (!response.ok) {
        toast.error(result.error ?? 'ذخیره‌ی سرور ناموفق بود.')
        return
      }

      if (result.reconcile) {
        if (result.reconcile.error) {
          toast.warning(`سرور ذخیره شد، اما دریافت ساب ناموفق بود: ${result.reconcile.error}`)
        } else {
          toast.success(`سرور ذخیره شد — ${result.reconcile.parsed ?? 0} کانفیگ استخراج شد.`)
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

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="server-name">نام سرور</Label>
            <Input
              id="server-name"
              placeholder="مثلاً: آلمان ۱"
              autoComplete="off"
              {...form.register('name')}
              aria-invalid={!!form.formState.errors.name}
              aria-describedby={form.formState.errors.name ? 'name-error' : undefined}
            />
            {form.formState.errors.name && (
              <p id="name-error" className="text-xs text-destructive" role="alert">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="server-country">کشور</Label>
            <select
              id="server-country"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
              {...form.register('country')}
              aria-invalid={!!form.formState.errors.country}
              aria-describedby={form.formState.errors.country ? 'country-error' : undefined}
            >
              {COUNTRIES.map((item) => (
                <option key={item.code} value={item.code}>
                  {flagOf(item.code)} {item.name}
                </option>
              ))}
            </select>
            {form.formState.errors.country && (
              <p id="country-error" className="text-xs text-destructive" role="alert">
                {form.formState.errors.country.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="server-sub">
              لینک ساب
            </Label>
            <Input
              id="server-sub"
              type="url"
              placeholder="https://example.com/sub?token=…"
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              {...form.register('sub_url')}
              aria-invalid={!!form.formState.errors.sub_url}
              aria-describedby={form.formState.errors.sub_url ? 'sub-url-error' : undefined}
            />
            {form.formState.errors.sub_url && (
              <p id="sub-url-error" className="text-xs text-destructive" role="alert">
                {form.formState.errors.sub_url.message}
              </p>
            )}
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
                className="w-28"
                dir="ltr"
                {...form.register('check_interval_sec', { valueAsNumber: true })}
                aria-invalid={!!form.formState.errors.check_interval_sec}
                aria-describedby={form.formState.errors.check_interval_sec ? 'interval-error' : undefined}
              />
              <span className="text-xs text-muted-foreground">ثانیه</span>
              <div className="flex flex-wrap gap-1">
                {INTERVAL_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={form.watch('check_interval_sec') === preset ? 'secondary' : 'ghost'}
                    size="sm"
                    className="fa-num h-7 px-2 text-[11px]"
                    onClick={() => form.setValue('check_interval_sec', preset, { shouldValidate: true })}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>
            {form.formState.errors.check_interval_sec && (
              <p id="interval-error" className="text-xs text-destructive" role="alert">
                {form.formState.errors.check_interval_sec.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">فعال باشد</p>
              <p className="text-[11px] text-muted-foreground">سرورهای غیرفعال در دورهای بررسی نادیده گرفته می‌شوند.</p>
            </div>
            <Switch
              checked={form.watch('enabled') === 1}
              onCheckedChange={(value) => form.setValue('enabled', value ? 1 : 0, { shouldValidate: true })}
            />
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