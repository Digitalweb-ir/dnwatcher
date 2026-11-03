import { z } from 'zod'
import { DEFAULT_SETTINGS, type SettingKey, type Settings } from '@/lib/db/settings'

/** Zod schema matching DEFAULT_SETTINGS for form validation */
export const settingsSchema = z.object({
  // General
  check_interval_sec: z.coerce.number().int().positive().min(30).max(86400),
  request_timeout_ms: z.coerce.number().int().positive().min(1000).max(60000),
  test_url: z.string().url({ message: 'آدرس URL معتبر نیست' }).optional().or(z.literal('')),
  fail_threshold: z.coerce.number().int().positive().min(1).max(10),
  retention_days: z.coerce.number().int().positive().min(1).max(365),
  daily_retention_days: z.coerce.number().int().positive().min(1).max(1095),
  port_base: z.coerce.number().int().min(10000).max(65535),
  max_batch: z.coerce.number().int().positive().min(1).max(500),
  sub_refresh_sec: z.coerce.number().int().positive().min(60).max(86400),
  scheduler_tick_sec: z.coerce.number().int().positive().min(5).max(300),

  // Outage webhook
  outage_webhook_url: z.string().url({ message: 'آدرس وب‌هوک معتبر نیست' }).optional().or(z.literal('')),
  ssh_recovery_command: z.string().max(200).optional().or(z.literal('')),

  // Telegram
  telegram_bot_token: z.string().max(200).optional().or(z.literal('')),
  telegram_admin_ids: z.string().max(1000).optional().or(z.literal('')),
  telegram_proxy_address: z.string().max(100).optional().or(z.literal('')),
  telegram_proxy_port: z.coerce.number().int().min(1).max(65535),
  telegram_enabled: z.coerce.number().int().min(0).max(1),
  telegram_log_checks: z.coerce.number().int().min(0).max(1),
})

/** Explicitly define the form shape for Zod 4 compatibility */
export type SettingsFormData = {
  check_interval_sec: number
  request_timeout_ms: number
  test_url: string
  fail_threshold: number
  retention_days: number
  daily_retention_days: number
  port_base: number
  max_batch: number
  sub_refresh_sec: number
  scheduler_tick_sec: number
  outage_webhook_url: string
  ssh_recovery_command: string
  telegram_bot_token: string
  telegram_admin_ids: string
  telegram_proxy_address: string
  telegram_proxy_port: number
  telegram_enabled: number
  telegram_log_checks: number
  // Password change fields (not in DB, only for form)
  current_password?: string
  new_password?: string
  confirm_password?: string
}

/** Convert Settings (DB format) to form data format */
export function settingsToFormData(settings: Settings): SettingsFormData {
  return {
    check_interval_sec: settings.check_interval_sec,
    request_timeout_ms: settings.request_timeout_ms,
    test_url: settings.test_url,
    fail_threshold: settings.fail_threshold,
    retention_days: settings.retention_days,
    daily_retention_days: settings.daily_retention_days,
    port_base: settings.port_base,
    max_batch: settings.max_batch,
    sub_refresh_sec: settings.sub_refresh_sec,
    scheduler_tick_sec: settings.scheduler_tick_sec,
    outage_webhook_url: settings.outage_webhook_url,
    ssh_recovery_command: settings.ssh_recovery_command,
    telegram_bot_token: settings.telegram_bot_token,
    telegram_admin_ids: settings.telegram_admin_ids,
    telegram_proxy_address: settings.telegram_proxy_address,
    telegram_proxy_port: settings.telegram_proxy_port,
    telegram_enabled: settings.telegram_enabled,
    telegram_log_checks: settings.telegram_log_checks,
  }
}

/** Convert form data to DB patch format */
export function formDataToPatch(formData: SettingsFormData): Partial<Record<SettingKey, string | number>> {
  const patch: Partial<Record<SettingKey, string | number>> = {}
  for (const [key, value] of Object.entries(formData) as [SettingKey, unknown][]) {
    const defaultValue = DEFAULT_SETTINGS[key]
    if (typeof defaultValue === 'number') {
      patch[key] = Number(value)
    } else {
      patch[key] = String(value)
    }
  }
  return patch
}