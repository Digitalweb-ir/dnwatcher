'use client'

import { useState } from 'react'
import { BellRing, Clock, Database, KeyRound, Save, Server, Shield, AlertCircle, Bot, Send, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Toaster, toast } from 'sonner'
import { saveSettingsAction, changePasswordAction } from './actions'
import { DEFAULT_SETTINGS, Settings } from '@/lib/db/settings'
import { toFa } from '@/lib/format'

interface SettingsClientProps {
  initialSettings: Settings
}

export default function SettingsClient({ initialSettings }: SettingsClientProps) {
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [generalSuccess, setGeneralSuccess] = useState<string | null>(null)
  const [retentionError, setRetentionError] = useState<string | null>(null)
  const [retentionSuccess, setRetentionSuccess] = useState<string | null>(null)
  const [subError, setSubError] = useState<string | null>(null)
  const [subSuccess, setSubSuccess] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  // Telegram admin IDs state
  const [telegramAdminIds, setTelegramAdminIds] = useState<string>('')

  function handleTelegramAdminIdsChange(value: string) {
    // Only allow numbers, commas, and spaces
    const sanitized = value.replace(/[^0-9,\s]/g, '')
    setTelegramAdminIds(sanitized)
  }

  function addTelegramAdminId(newId: string) {
    const trimmed = newId.trim()
    if (!trimmed) return
    if (!/^\d+$/.test(trimmed)) return

    const currentIds = telegramAdminIds.split(',').map((id) => id.trim()).filter(Boolean)
    if (currentIds.includes(trimmed)) return

    setTelegramAdminIds([...currentIds, trimmed].join(', '))
  }

  function removeTelegramAdminId(idToRemove: string) {
    const currentIds = telegramAdminIds.split(',').map((id) => id.trim()).filter(Boolean)
    setTelegramAdminIds(currentIds.filter((id) => id !== idToRemove).join(', '))
  }

  async function handleSaveSettings(formData: FormData) {
    setGeneralError(null)
    setGeneralSuccess(null)
    const res = await saveSettingsAction(formData)
    if (res.success) {
      setGeneralSuccess(res.message)
      toast.success(res.message)
    } else {
      setGeneralError(res.message)
      toast.error(res.message)
    }
  }

  async function handleRetentionSettings(formData: FormData) {
    setRetentionError(null)
    setRetentionSuccess(null)
    const res = await saveSettingsAction(formData)
    if (res.success) {
      setRetentionSuccess(res.message)
      toast.success(res.message)
    } else {
      setRetentionError(res.message)
      toast.error(res.message)
    }
  }

  async function handleSubSettings(formData: FormData) {
    setSubError(null)
    setSubSuccess(null)
    const res = await saveSettingsAction(formData)
    if (res.success) {
      setSubSuccess(res.message)
      toast.success(res.message)
    } else {
      setSubError(res.message)
      toast.error(res.message)
    }
  }

  async function handleChangePassword(formData: FormData) {
    setPasswordError(null)
    setPasswordSuccess(null)
    const res = await changePasswordAction(formData)
    if (res.success) {
      setPasswordSuccess(res.message)
      toast.success(res.message)
    } else {
      setPasswordError(res.message)
      toast.error(res.message)
    }
  }

  return (
    <AppShell
      title="تنظیمات"
      description="پیکربندی بازه‌ی بررسی، نگهداری داده و امنیت"
      actions={<Badge variant="secondary">مرحله ۸</Badge>}
    >
      <Toaster position="bottom-left" closeButton />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* بازه و آستانه */}
        <Card className="card-glow border-border/70 bg-card/60 flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Clock className="size-5" />
              </div>
              <div>
                <CardTitle>بازه و آستانه</CardTitle>
                <CardDescription>فرکانس بررسی و حساسیت قطعی</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <form action={handleSaveSettings} className="grid gap-4">
              {generalError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-xs text-destructive" role="alert">
                  <AlertCircle className="size-3 shrink-0" />
                  {generalError}
                </div>
              )}
              {generalSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-500" role="status">
                  {generalSuccess}
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="check_interval_sec" className="text-xs">بازه پیش‌فرض بررسی (ثانیه)</Label>
                <Input
                  id="check_interval_sec"
                  name="check_interval_sec"
                  type="number"
                  min="30"
                  step="30"
                  defaultValue={initialSettings.check_interval_sec}
                  dir="ltr"
                  className="text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fail_threshold" className="text-xs">آستانه قطعی (شکست پیاپی)</Label>
                <Input
                  id="fail_threshold"
                  name="fail_threshold"
                  type="number"
                  min="1"
                  max="10"
                  defaultValue={initialSettings.fail_threshold}
                  dir="ltr"
                  className="text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="request_timeout_ms" className="text-xs">مهلت درخواست تست (میلی‌ثانیه)</Label>
                <Input
                  id="request_timeout_ms"
                  name="request_timeout_ms"
                  type="number"
                  min="1000"
                  step="500"
                  defaultValue={initialSettings.request_timeout_ms}
                  dir="ltr"
                  className="text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="scheduler_tick_sec" className="text-xs">فاصله حلقه زمان‌بند (ثانیه)</Label>
                <Input
                  id="scheduler_tick_sec"
                  name="scheduler_tick_sec"
                  type="number"
                  min="5"
                  max="300"
                  defaultValue={initialSettings.scheduler_tick_sec}
                  dir="ltr"
                  className="text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="test_url" className="text-xs">آدرس تست سلامت</Label>
                <Input
                  id="test_url"
                  name="test_url"
                  type="url"
                  defaultValue={initialSettings.test_url}
                  dir="ltr"
                  className="text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="outage_webhook_url" className="text-xs">آدرس وب‌هوک قطعی</Label>
                <Input
                  id="outage_webhook_url"
                  name="outage_webhook_url"
                  type="url"
                  placeholder="https://example.com/webhook"
                  defaultValue={initialSettings.outage_webhook_url}
                  dir="ltr"
                  className="text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ssh_recovery_command" className="text-xs">دستور ریکاوری SSH</Label>
                <Input
                  id="ssh_recovery_command"
                  name="ssh_recovery_command"
                  type="text"
                  placeholder="backpack -restart-all"
                  defaultValue={initialSettings.ssh_recovery_command}
                  dir="ltr"
                  className="text-sm"
                />
              </div>
              <Button type="submit" className="w-full mt-2">
                <Save className="me-2 size-4" />
                ذخیره تنظیمات
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* نگهداری داده */}
        <Card className="card-glow border-border/70 bg-card/60 flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Database className="size-5" />
              </div>
              <div>
                <CardTitle>نگهداری داده</CardTitle>
                <CardDescription>مدت زمان نگهداری داده‌ها</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <form action={handleRetentionSettings} className="grid gap-4">
              {retentionError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-xs text-destructive" role="alert">
                  <AlertCircle className="size-3 shrink-0" />
                  {retentionError}
                </div>
              )}
              {retentionSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-500" role="status">
                  {retentionSuccess}
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="retention_days" className="text-xs">داده خام (روز)</Label>
                <Input
                  id="retention_days"
                  name="retention_days"
                  type="number"
                  min="1"
                  max="3650"
                  defaultValue={initialSettings.retention_days}
                  dir="ltr"
                  className="text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="daily_retention_days" className="text-xs">آمار روزانه (روز)</Label>
                <Input
                  id="daily_retention_days"
                  name="daily_retention_days"
                  type="number"
                  min="30"
                  max="3650"
                  defaultValue={initialSettings.daily_retention_days}
                  dir="ltr"
                  className="text-sm"
                />
              </div>
              <Button type="submit" className="w-full mt-auto">
                <Save className="me-2 size-4" />
                ذخیره
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ساب و پورت */}
        <Card className="card-glow border-border/70 bg-card/60 flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Server className="size-5" />
              </div>
              <div>
                <CardTitle>لینک ساب و پورت‌ها</CardTitle>
                <CardDescription>تنظیمات SOCKS5 و Batch</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <form action={handleSubSettings} className="grid gap-4">
              {subError && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-xs text-destructive" role="alert">
                  <AlertCircle className="size-3 shrink-0" />
                  {subError}
                </div>
              )}
              {subSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-500" role="status">
                  {subSuccess}
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="sub_refresh_sec" className="text-xs">تازه‌سازی ساب (ثانیه)</Label>
                <Input
                  id="sub_refresh_sec"
                  name="sub_refresh_sec"
                  type="number"
                  min="300"
                  step="60"
                  defaultValue={initialSettings.sub_refresh_sec}
                  dir="ltr"
                  className="text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="max_batch" className="text-xs">حداکثر کانفیگ در Batch</Label>
                <Input
                  id="max_batch"
                  name="max_batch"
                  type="number"
                  min="1"
                  max="200"
                  defaultValue={initialSettings.max_batch}
                  dir="ltr"
                  className="text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="port_base" className="text-xs">پورت پایه SOCKS5</Label>
                <Input
                  id="port_base"
                  name="port_base"
                  type="number"
                  min="1024"
                  max="60000"
                  defaultValue={initialSettings.port_base}
                  dir="ltr"
                  className="text-sm"
                />
              </div>
              <Button type="submit" className="w-full mt-auto">
                <Save className="me-2 size-4" />
                ذخیره
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* امنیت و رمزنگاری */}
      <Card className="card-glow border-border/70 bg-card/60 mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Shield className="size-5" />
            </div>
            <div>
              <CardTitle>امنیت و رمزنگاری</CardTitle>
              <CardDescription>وضعیت کلید رمزنگاری و رمز مدیر</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-card/40">
              <div className="space-y-1">
                <p className="font-medium text-sm">رمزنگاری AES-256-GCM</p>
                <p className="text-xs text-muted-foreground">رمزنگاری لینک‌های ساب</p>
              </div>
              <Badge variant={process.env.ENCRYPTION_KEY ? 'default' : 'destructive'}>
                {process.env.ENCRYPTION_KEY ? 'فعال' : 'تنظیم نشده'}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-card/40">
              <div className="space-y-1">
                <p className="font-medium text-sm">احراز هویت پنل</p>
                <p className="text-xs text-muted-foreground">محافظت از نشست (Session)</p>
              </div>
              <Badge variant="default">فعال</Badge>
            </div>
          </div>

          <Separator />

          <form action={handleChangePassword} className="grid gap-4 sm:grid-cols-3 items-end">
            {passwordError && (
              <div className="col-span-full flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-xs text-destructive" role="alert">
                <AlertCircle className="size-3 shrink-0" />
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="col-span-full flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-500" role="status">
                <AlertCircle className="size-3 shrink-0" />
                {passwordSuccess}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="current_password" className="text-xs">رمز فعلی</Label>
              <Input id="current_password" name="current_password" type="password" autoComplete="current-password" className="text-sm" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new_password" className="text-xs">رمز جدید</Label>
              <Input id="new_password" name="new_password" type="password" autoComplete="new-password" minLength={8} className="text-sm" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm_password" className="text-xs">تکرار رمز جدید</Label>
              <Input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" minLength={8} className="text-sm" />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit" className="max-w-xs">
                <KeyRound className="me-2 size-4" />
                تغییر رمز مدیر
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* نکات مهم */}
      <div className="grid gap-4 mt-6 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/30 p-4 text-sm text-muted-foreground">
          <Shield className="mt-0.5 size-4 text-primary shrink-0" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">رمزنگاری لینک ساب</p>
            <p className="text-xs leading-relaxed">لینک ساب هر سرور با AES-256-GCM رمزنگاری شده در دیتابیس ذخیره می‌شود. کلید در <code className="bg-muted px-1 rounded">ENCRYPTION_KEY</code> است.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/30 p-4 text-sm text-muted-foreground">
          <Server className="mt-0.5 size-4 text-primary shrink-0" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">بازه‌های پیش‌فرض</p>
            <p className="text-xs leading-relaxed">هر سرور می‌تواند بازه‌ی بررسی اختصاصی داشته باشد. پیش‌فرض از تنظیمات بالا گرفته می‌شود.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/30 p-4 text-sm text-muted-foreground">
          <Clock className="mt-0.5 size-4 text-primary shrink-0" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">حذف خودکار داده</p>
            <p className="text-xs leading-relaxed">داده‌های خام بررسی‌ها پس از <strong className="text-foreground">{toFa(initialSettings.retention_days)} روز</strong> حذف می‌شوند. آمار روزانه تا <strong className="text-foreground">{toFa(initialSettings.daily_retention_days)} روز</strong> نگه‌داری می‌شود.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/30 p-4 text-sm text-muted-foreground">
          <BellRing className="mt-0.5 size-4 text-primary shrink-0" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">آستانه قطعی</p>
            <p className="text-xs leading-relaxed">یک کانفیگ پس از <strong className="text-foreground">{toFa(initialSettings.fail_threshold)} شکست پیاپی</strong> به حالت «قطع» می‌رود و یک رخداد ثبت می‌شود.</p>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
