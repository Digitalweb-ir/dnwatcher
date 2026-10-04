import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { ensureAdminPassword } from '@/lib/auth/store'

import { runMigrations } from './schema'
import { ensureDefaultSettings } from './settings'

let dbInstance: DatabaseSync | null = null

/**
 * مسیر فایل دیتابیس. در استقرار واقعی با متغیر محیطی `DB_PATH` تغییر می‌کند.
 */
export function getDbPath(): string {
  return process.env.DB_PATH ?? './data/watch.db'
}

/**
 * نمونه‌ی یکتای دیتابیس (singleton) همراه با PRAGMAهای بهینه،
 * مایگریشن‌ها و تنظیمات پیش‌فرض.
 */
export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance

  const path = getDbPath()
  // پوشه‌ی data ممکن است هنوز ساخته نشده باشد
  mkdirSync(dirname(path), { recursive: true })

  const db = new DatabaseSync(path)

  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA synchronous = NORMAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')

  runMigrations(db)
  ensureDefaultSettings(db)
  ensureAdminPassword(db)

  dbInstance = db
  return db
}

/**
 * اجرای یک تراکنش؛ اگر تابع خطا پرتاب کند، ROLLBACK می‌شود.
 */
export function transaction<T>(fn: (tx: DatabaseSync) => T): T {
  const db = getDb()
  db.exec('BEGIN')
  try {
    const result = fn(db)
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/** بستن اتصال — برای تست یا خاموشی تمیز. */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
