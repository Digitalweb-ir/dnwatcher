'use client'

import { useEffect, useState } from 'react'
import { BellRing, Clock, Database, KeyRound, Save, Server, Shield, AlertCircle, Bot, Trash2, Plus } from 'lucide-react'
import { useForm, UseFormReturn, FieldErrors, FieldValues, Path } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Toaster, toast } from 'sonner'

import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { saveSettingsAction, changePasswordAction } from './actions'
import type { Settings } from '@/lib/db/settings'
import { toFa } from '@/lib/format'
import { settingsSchema, settingsToFormData, type SettingsFormData } from '@/lib/settings-schema'

interface SettingsClientProps {
  initialSettings: Settings
}

export default function SettingsClient({ initialSettings }: SettingsClientProps) {
  const [telegramAdminIds, setTelegramAdminIds] = useState(initialSettings.telegram_admin_ids)
  const [newAdminId, setNewAdminId] = useState('')

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema) as any,
    defaultValues: settingsToFormData(initialSettings),
    mode: 'onChange',
  })

  useEffect(() => {
    setTelegramAdminIds(initialSettings.telegram_admin_ids)
    form.setValue('telegram_admin_ids', initialSettings.telegram_admin_ids, { shouldValidate: true })
  }, [initialSettings.telegram_admin_ids, form])

  const telegramEnabled = form.watch('telegram_enabled') === 1
  const telegramLogChecks = form.watch('telegram_log_checks') === 1

  function changeAdminIds(value: string) {
    const sanitized = value.replace(/[^0-9,\s]/g, '')
    setTelegramAdminIds(sanitized)
    form.setValue('telegram_admin_ids', sanitized, { shouldValidate: true })
  }

  function addAdminId() {
    const trimmed = newAdminId.trim()
    if (!trimmed || !/^\d+$/.test(trimmed)) return
    const current = telegramAdminIds.split(',').map((id) => id.trim()).filter(Boolean)
    if (current.includes(trimmed)) return
    const updated = [...current, trimmed].join(', ')
    setTelegramAdminIds(updated)
    form.setValue('telegram_admin_ids', updated, { shouldValidate: true })
    setNewAdminId('')
  }

  function removeAdminId(idToRemove: string) {
    const updated = telegramAdminIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id && id !== idToRemove)
      .join(', ')
    setTelegramAdminIds(updated)
    form.setValue('telegram_admin_ids', updated, { shouldValidate: true })
  }

  async function onGeneralSubmit(data: SettingsFormData) {
    try {
      const formData = new FormData()
      Object.entries(data).forEach(([key, value]) => formData.append(key, String(value)))
      const res = await saveSettingsAction(formData)
      if (res.success) toast.success(res.message)
      else toast.error(res.message)
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.')
    }
  }

  async function onPasswordSubmit(data: { current_password: string; new_password: string; confirm_password: string }) {
    try {
      const formData = new FormData()
      formData.append('current_password', data.current_password)
      formData.append('new_password', data.new_password)
      formData.append('confirm_password', data.confirm_password)
      const res = await changePasswordAction(formData)
      if (res.success) {
        toast.success(res.message)
        form.reset()
      } else toast.error(res.message)
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.')
    }
  }

  // Separate form instance for password change (not tied to SettingsFormData)
  const passwordForm = useForm<{ current_password: string; new_password: string; confirm_password: string }>({
    mode: 'onChange',
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  })

  return (
    <AppShell
      title="تنظیمات"
      description="پیکربندی بازه‌ی بررسی، نگهداری داده و امنیت"
      actions={<Badge variant="secondary">مرحله ۸</Badge>}
    >
      <Toaster position="bottom-left" closeButton />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="card-glow border-border/70 bg-card/60 flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary"><Clock className="size-5" /></div>
              <div>
                <CardTitle>بازه و آستانه</CardTitle>
                <CardDescription>فرکانس بررسی و حساسیت قطعی</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <form onSubmit={form.handleSubmit(onGeneralSubmit)} className="grid gap-4">
              <RHFField rhfForm={form} name="check_interval_sec" label="بازه پیش‌فرض بررسی (ثانیه)" type="number" min={30} step={30} />
              <RHFField rhfForm={form} name="fail_threshold" label="آستانه قطعی (شکست پیاپی)" type="number" min={1} max={10} />
              <RHFField rhfForm={form} name="request_timeout_ms" label="مهلت درخواست تست (میلی‌ثانیه)" type="number" min={1000} step={500} />
              <RHFField rhfForm={form} name="scheduler_tick_sec" label="فاصله حلقه زمان‌بند (ثانیه)" type="number" min={5} max={300} />
              <RHFField rhfForm={form} name="test_url" label="آدرس تست سلامت" type="url" />
              <RHFField rhfForm={form} name="outage_webhook_url" label="آدرس وب‌هوک قطعی" type="url" placeholder="http://localhost:3000/api/webhooks/outage" />
              <RHFField rhfForm={form} name="ssh_recovery_command" label="دستور ریکاوری SSH" placeholder="backpack -restart-all" />
              <Button type="submit" className="mt-2 w-full"><Save className="me-2 size-4" />ذخیره تنظیمات</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="card-glow border-border/70 bg-card/60 flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary"><Database className="size-5" /></div>
              <div>
                <CardTitle>نگهداری داده</CardTitle>
                <CardDescription>مدت زمان نگهداری داده‌ها</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <form onSubmit={form.handleSubmit(onGeneralSubmit)} className="grid gap-4">
              <RHFField rhfForm={form} name="retention_days" label="داده خام (روز)" type="number" min={1} max={3650} />
              <RHFField rhfForm={form} name="daily_retention_days" label="آمار روزانه (روز)" type="number" min={30} max={3650} />
              <Button type="submit" className="mt-auto w-full"><Save className="me-2 size-4" />ذخیره</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="card-glow border-border/70 bg-card/60 flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary"><Server className="size-5" /></div>
              <div>
                <CardTitle>لینک ساب و پورت‌ها</CardTitle>
                <CardDescription>تنظیمات SOCKS5 و Batch</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <form onSubmit={form.handleSubmit(onGeneralSubmit)} className="grid gap-4">
              <RHFField rhfForm={form} name="sub_refresh_sec" label="تازه‌سازی ساب (ثانیه)" type="number" min={300} step={60} />
              <RHFField rhfForm={form} name="max_batch" label="حداکثر کانفیگ در Batch" type="number" min={1} max={200} />
              <RHFField rhfForm={form} name="port_base" label="پورت پایه SOCKS5" type="number" min={1024} max={60000} />
              <Button type="submit" className="mt-auto w-full"><Save className="me-2 size-4" />ذخیره</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="card-glow mt-6 border-border/70 bg-card/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary"><Bot className="size-5" /></div>
            <div>
              <CardTitle>تلگرام و اعلان‌ها</CardTitle>
              <CardDescription>تنظیمات بات تلگرام برای گزارش‌های قطعی</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onGeneralSubmit)} className="grid gap-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="telegram_enabled"
                checked={telegramEnabled}
                onCheckedChange={(value) => form.setValue('telegram_enabled', value ? 1 : 0, { shouldValidate: true })}
              />
              <Label htmlFor="telegram_enabled" className="cursor-pointer text-xs">فعال‌سازی اعلان‌های تلگرام</Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="telegram_log_checks"
                checked={telegramLogChecks}
                onCheckedChange={(value) => form.setValue('telegram_log_checks', value ? 1 : 0, { shouldValidate: true })}
              />
              <Label htmlFor="telegram_log_checks" className="cursor-pointer text-xs">ارسال هر بررسی به لاگ (حالت واژه‌به‌واژه)</Label>
            </div>
            <RHFField rhfForm={form} name="telegram_bot_token" label="توکن بات تلگرام" type="password" placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ" className="font-mono text-sm" />
            <div className="grid gap-2">
              <Label htmlFor="telegram_admin_ids" className="text-xs">آی‌دی ادمین‌ها (جداشده با کاما)</Label>
              <div className="flex gap-2">
                <Input
                  id="new_admin_id"
                  value={newAdminId}
                  onChange={(e) => setNewAdminId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAdminId()}
                  placeholder="آی‌دی عددی"
                  dir="ltr"
                  className="font-mono text-sm flex-1"
                />
                <Button type="button" size="sm" onClick={addAdminId}>
                  <Plus className="size-4" />
                </Button>
              </div>
              <Input
                id="telegram_admin_ids"
                value={telegramAdminIds}
                onChange={(e) => changeAdminIds(e.target.value)}
                dir="ltr"
                className="font-mono text-sm"
                readOnly
              />
              <div className="flex flex-wrap gap-1">
                {telegramAdminIds.split(',').map((id) => id.trim()).filter(Boolean).map((id) => (
                  <Badge key={id} variant="secondary" className="gap-1">
                    {id}
                    <button type="button" onClick={() => removeAdminId(id)} className="hover:text-destructive"><Trash2 className="size-3" /></button>
                  </Badge>
                ))}
              </div>
            </div>
            <RHFField rhfForm={form} name="telegram_proxy_address" label="آدرس پروکسی SOCKS5" placeholder="127.0.0.1" />
            <RHFField rhfForm={form} name="telegram_proxy_port" label="پورت پروکسی SOCKS5" type="number" min={1} max={65535} />
            <Button type="submit" className="mt-2 w-full"><Save className="me-2 size-4" />ذخیره تنظیمات تلگرام</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="card-glow mt-6 border-border/70 bg-card/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary"><Shield className="size-5" /></div>
            <div>
              <CardTitle>امنیت</CardTitle>
              <CardDescription>رمز مدیر و احراز هویت</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card/40 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">احراز هویت پنل</p>
              <p className="text-xs text-muted-foreground">محافظت از نشست</p>
            </div>
            <Badge>فعال</Badge>
          </div>
          <Separator />
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="grid items-end gap-4 sm:grid-cols-3">
            <RHFField rhfForm={passwordForm} name="current_password" label="رمز فعلی" type="password" autoComplete="current-password" />
            <RHFField rhfForm={passwordForm} name="new_password" label="رمز جدید" type="password" autoComplete="new-password" min={8} />
            <RHFField rhfForm={passwordForm} name="confirm_password" label="تکرار رمز جدید" type="password" autoComplete="new-password" min={8} />
            <div className="flex justify-end sm:col-span-3">
              <Button type="submit" className="max-w-xs"><KeyRound className="me-2 size-4" />تغییر رمز مدیر</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Note icon={Server} title="بازه‌های پیش‌فرض" text="هر سرور می‌تواند بازه‌ی بررسی اختصاصی داشته باشد. پیش‌فرض از تنظیمات بالا گرفته می‌شود." />
        <Note icon={Clock} title="حذف خودکار داده" text={`داده‌های خام بررسی‌ها پس از ${toFa(initialSettings.retention_days)} روز حذف می‌شوند. آمار روزانه تا ${toFa(initialSettings.daily_retention_days)} روز نگه‌داری می‌شود.`} />
        <Note icon={BellRing} title="آستانه قطعی" text={`یک کانفیگ پس از ${toFa(initialSettings.fail_threshold)} شکست پیاپی به حالت «قطع» می‌شود و یک رخداد ثبت می‌شود.`} />
      </div>
    </AppShell>
  )
}

function RHFField({
  rhfForm,
  name,
  label,
  className,
  ...props
}: { rhfForm: any; name: string; label: string } & React.ComponentProps<typeof Input>) {
  const errors = rhfForm.formState.errors as Record<string, { message?: string }>
  return (
    <div className="grid gap-2">
      <Label htmlFor={name} className="text-xs">{label}</Label>
      <Input
        id={name}
        {...rhfForm.register(name)}
        dir="ltr"
        className={cn('text-sm', className)}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        {...props}
      />
      {errors[name] && (
        <p id={`${name}-error`} className="text-xs text-destructive" role="alert">
          {errors[name].message}
        </p>
      )}
    </div>
  )
}

function Note({ icon: Icon, title, text }: { icon: typeof Server; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/30 p-4 text-sm text-muted-foreground">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-xs leading-relaxed">{text}</p>
      </div>
    </div>
  )
}