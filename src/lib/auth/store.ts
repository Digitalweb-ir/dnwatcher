/**
 * ذخیره‌سازی رمز مدیر در جدول settings.
 *
 * رمز هرگز به‌صورت متن ذخیره نمی‌شود؛ فقط هش scrypt.
 * مقدار اولیه از `ADMIN_PASSWORD` خوانده می‌شود و اگر نبود، `admin`
 * (با هشدار در لاگ — فقط برای راه‌اندازی اولیه).
 *
 * توجه: عمداً از SQL خام استفاده می‌کنیم تا این کلید به اتحادیه‌ی
 * `SettingKey` در settings.ts گره نخورد و رمز از مسیرهای عمومی
 * (مثل GET /api/settings) بیرون بماند.
 */
import type { DatabaseSync } from 'node:sqlite'

import { hashPasswordSync, verifyPasswordSync } from './password'

const HASH_KEY = 'admin_password_hash'

/** هش ذخیره‌شده را برمی‌گرداند، یا null اگر هنوز تنظیم نشده باشد. */
export function getAdminHash(db: DatabaseSync): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(HASH_KEY) as
    | { value: string }
    | undefined
  return row?.value && row.value.length > 0 ? row.value : null
}

/** نوشتن هش جدید (جایگزینی). */
export function setAdminHash(db: DatabaseSync, hash: string): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(HASH_KEY, hash)
}

/** بررسی رمز ورود در برابر هش ذخیره‌شده. */
export function checkAdminPassword(db: DatabaseSync, password: string): boolean {
  const stored = getAdminHash(db)
  if (!stored) return false
  return verifyPasswordSync(password, stored)
}

/**
 * اگر هنوز رمزی تنظیم نشده، از `ADMIN_PASSWORD` (یا `admin`) مقداردهی کن.
 * این تابع هنگام باز شدن دیتابیس صدا زده می‌شود.
 */
export function ensureAdminPassword(db: DatabaseSync): void {
  if (getAdminHash(db)) return

  const fromEnv = process.env.ADMIN_PASSWORD
  const initial = fromEnv && fromEnv.length > 0 ? fromEnv : 'admin'
  setAdminHash(db, hashPasswordSync(initial))

  if (!fromEnv) {
    console.warn(
      '[auth] ADMIN_PASSWORD تنظیم نشده بود؛ رمز پیش‌فرض «admin» استفاده شد. همین حالا آن را تغییر دهید.',
    )
  }
}

/** تغییر رمز مدیر (از صفحه‌ی تنظیمات). */
export function changeAdminPassword(db: DatabaseSync, next: string): void {
  setAdminHash(db, hashPasswordSync(next))
}
