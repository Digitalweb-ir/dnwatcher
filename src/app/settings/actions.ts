'use server'

import { getDb } from '@/lib/db'
import { getSettings, updateSettings, DEFAULT_SETTINGS, SettingKey } from '@/lib/db/settings'
import { changeAdminPassword } from '@/lib/auth/store'
import { verifyPasswordSync } from '@/lib/auth/password'
import { getAdminHash } from '@/lib/auth/store'
import { revalidatePath } from 'next/cache'

export async function saveSettingsAction(formData: FormData) {
  const db = getDb()
  const patch: Partial<Record<SettingKey, string | number>> = {}

  // Keys that are boolean flags stored as 0/1 in DB but sent as "on"/undefined from checkboxes
  const booleanKeys: SettingKey[] = [
    'telegram_enabled',
    'telegram_log_checks',
  ]

  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
    const defaultValue = DEFAULT_SETTINGS[key]
    const value = formData.get(key)

    if (booleanKeys.includes(key)) {
      // Checkbox: "on" when checked, absent when unchecked
      patch[key] = value === 'on' ? 1 : 0
    } else if (value !== null) {
      patch[key] = typeof defaultValue === 'number' ? Number(value) : String(value)
    }
  }
  updateSettings(db, patch)
  revalidatePath('/settings')
  return { success: true, message: 'تنظیمات ذخیره شد.' }
}

export async function changePasswordAction(formData: FormData) {
  const db = getDb()
  const current = formData.get('current_password') as string
  const next = formData.get('new_password') as string
  const confirm = formData.get('confirm_password') as string

  if (!current || !next || !confirm) {
    return { success: false, message: 'تمام فیلدها را پر کنید.' }
  }
  if (next !== confirm) {
    return { success: false, message: 'رمز تکرار شده با رمز جدید همخوانی ندارد.' }
  }
  if (next.length < 8) {
    return { success: false, message: 'رمز جدید باید حداقل ۸ کاراکتر باشد.' }
  }

  const stored = getAdminHash(db)
  if (!stored || !verifyPasswordSync(current, stored)) {
    return { success: false, message: 'رمز فعلی نادرست است.' }
  }

  changeAdminPassword(db, next)
  revalidatePath('/settings')
  return { success: true, message: 'رمز مدیر تغییر کرد.' }
}