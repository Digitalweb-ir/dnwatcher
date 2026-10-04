import type { DatabaseSync } from 'node:sqlite'

/** تنظیمات پیش‌فرض سیستم — از جدول settings خوانده و نوشته می‌شوند */
export const DEFAULT_SETTINGS = {
  /** بازه‌ی پیش‌فرض بررسی هر سرور (ثانیه) */
  check_interval_sec: 300,
  /** مهلت هر درخواست تست (میلی‌ثانیه) */
  request_timeout_ms: 5000,
  /** آدرس تست سلامت */
  test_url: 'https://www.gstatic.com/generate_204',
  /** چند شکست پیاپی = قطعی */
  fail_threshold: 2,
  /** ماندگاری داده‌ی خام checks (روز) */
  retention_days: 30,
  /** ماندگاری آمار روزانه (روز) */
  daily_retention_days: 365,
  /** شروع بازه‌ی پورت‌های SOCKS5 */
  port_base: 20000,
  /** حداکثر کانفیگ در هر batch (بیش از این، به دسته‌های کوچک‌تر تقسیم می‌شود) */
  max_batch: 50,
  /** فاصله‌ی تازه‌سازی لینک ساب (ثانیه) */
  sub_refresh_sec: 3600,
  /** فاصله‌ی حلقه‌ی زمان‌بند (ثانیه) */
  scheduler_tick_sec: 15,
} as const

export type SettingKey = keyof typeof DEFAULT_SETTINGS
export type Settings = { [K in SettingKey]: (typeof DEFAULT_SETTINGS)[K] }

export function ensureDefaultSettings(db: DatabaseSync): void {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insert.run(key, String(value))
  }
}

export function getSettings(db: DatabaseSync): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const stored = new Map(rows.map((r) => [r.key, r.value]))
  const out = {} as Record<string, number | string>

  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
    const raw = stored.get(key)
    if (raw === undefined) {
      out[key] = fallback
      continue
    }
    out[key] = typeof fallback === 'number' ? Number(raw) : raw
  }

  return out as Settings
}

export function getSetting<K extends SettingKey>(db: DatabaseSync, key: K): Settings[K] {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  const fallback = DEFAULT_SETTINGS[key]
  if (!row) return fallback
  return (typeof fallback === 'number' ? Number(row.value) : row.value) as Settings[K]
}

export function setSetting(db: DatabaseSync, key: SettingKey, value: string | number): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, String(value))
}

export function updateSettings(db: DatabaseSync, patch: Partial<Record<SettingKey, string | number>>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (key in DEFAULT_SETTINGS && value !== undefined && value !== null) {
      setSetting(db, key as SettingKey, value as string | number)
    }
  }
}
