import { z } from 'zod'

// Login form schema
export const loginSchema = z.object({
  password: z.string().min(1, 'رمز عبور را وارد کنید.'),
})

export type LoginFormData = z.infer<typeof loginSchema>

// Server form schema (add/edit)
export const serverSchema = z.object({
  name: z.string().min(1, 'نام سرور را وارد کنید.').max(100, 'نام سرور بیش از حد طولانی است.'),
  country: z.string().length(2, 'کد کشور باید ۲ کاراکتر باشد.'),
  sub_url: z.string().url('لینک ساب باید یک URL معتبر باشد.').optional().or(z.literal('')),
  check_interval_sec: z.number().int().min(30, 'بازه باید حداقل ۳۰ ثانیه باشد.').max(86400, 'بازه نمی‌تواند بیش از ۲۴ ساعت باشد.'),
  enabled: z.number().int().min(0).max(1),
})

export type ServerFormData = z.infer<typeof serverSchema>

// SSH Server form schema
export const sshServerSchema = z.object({
  name: z.string().min(1, 'نام نمایشی را وارد کنید.').max(100, 'نام بیش از حد طولانی است.'),
  ip: z.string().min(1, 'آدرس IP را وارد کنید.').regex(/^(?:\d{1,3}\.){3}\d{1,3}$/, 'آدرس IP معتبر نیست.'),
  user: z.string().min(1, 'نام کاربری را وارد کنید.').max(50, 'نام کاربری بیش از حد طولانی است.'),
  password: z.string().min(1, 'رمز عبور را وارد کنید.').max(200, 'رمز عبور بیش از حد طولانی است.'),
})

export type SSHServerFormData = z.infer<typeof sshServerSchema>

// Settings schema already exists in settings-schema.ts
export { settingsSchema, type SettingsFormData } from './settings-schema'