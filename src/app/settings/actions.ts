'use server'

import { getDb } from '@/lib/db'
import { getSettings, updateSettings, DEFAULT_SETTINGS, SettingKey } from '@/lib/db/settings'
import { changeAdminPassword } from '@/lib/auth/store'
import { verifyPasswordSync } from '@/lib/auth/password'
import { getAdminHash } from '@/lib/auth/store'
import { revalidatePath } from 'next/cache'
import { settingsSchema, formDataToPatch, SettingsFormData } from '@/lib/settings-schema'
import { isAuthed } from '@/lib/auth/guard'

const UNAUTHED = { success: false, message: 'برای این کار باید وارد شوید.' }

export async function saveSettingsAction(formData: FormData) {
  if (!(await isAuthed())) return UNAUTHED
  // Convert FormData to plain object
  const rawData: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    if (key in DEFAULT_SETTINGS) {
      rawData[key] = value
    }
  }

  // Validate with Zod
  const result = settingsSchema.safeParse(rawData)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return { success: false, message: `${firstError.path.join('.')}: ${firstError.message}` }
  }

  const validatedData = result.data as SettingsFormData
  const patch = formDataToPatch(validatedData)

  const db = getDb()
  updateSettings(db, patch)
  revalidatePath('/settings')
  return { success: true, message: 'تنظیمات ذخیره شد.' }
}

export async function changePasswordAction(formData: FormData) {
  if (!(await isAuthed())) return UNAUTHED

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