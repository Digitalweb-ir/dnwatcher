import type { DatabaseSync } from 'node:sqlite'

/** Default system settings — read from and written to the settings table */
export const DEFAULT_SETTINGS = {
  /** Default check interval per server (seconds) */
  check_interval_sec: 300,
  /** Request timeout for each test (milliseconds) */
  request_timeout_ms: 5000,
  /** Health check endpoint URL */
  test_url: 'https://www.gstatic.com/generate_204',
  /** How many consecutive failures = outage */
  fail_threshold: 2,
  /** Raw checks retention (days) */
  retention_days: 30,
  /** Daily stats retention (days) */
  daily_retention_days: 365,
  /** SOCKS5 port range base */
  port_base: 20000,
  /** Max configs per batch (excess split into smaller batches) */
  max_batch: 50,
  /** Subscription refresh interval (seconds) */
  sub_refresh_sec: 3600,
  /** Scheduler tick interval (seconds) */
  scheduler_tick_sec: 15,
  /** Webhook URL to call when a config goes down (POST with address, port, etc.) */
  outage_webhook_url: '',
  /** SSH recovery command to run when config goes down (empty = disabled) */
  ssh_recovery_command: 'backpack -restart-all',
  /** Telegram bot token for notifications */
  telegram_bot_token: '',
  /** Comma-separated list of Telegram admin chat IDs */
  telegram_admin_ids: '',
  /** SOCKS5 proxy address for Telegram (e.g., 127.0.0.1) */
  telegram_proxy_address: '127.0.0.1',
  /** SOCKS5 proxy port for Telegram (e.g., 10808) */
  telegram_proxy_port: 10808,
  /** Enable/disable Telegram notifications */
  telegram_enabled: 0,
} as const

export type SettingKey = keyof typeof DEFAULT_SETTINGS
/** Resolved settings: numeric defaults stay numbers, everything else is a string */
export type Settings = {
  [K in SettingKey]: (typeof DEFAULT_SETTINGS)[K] extends number ? number : string
}

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
