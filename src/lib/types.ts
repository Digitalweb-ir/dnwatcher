/** انواع مشترک سراسر برنامه */

export type CheckStatus = 'up' | 'down'

export type Protocol = 'vless' | 'vmess' | 'trojan' | 'ss' | 'socks' | 'http'

export interface Server {
  id: number
  name: string
  /** کشور سرور — کد دوحرفی ISO یا نام فارسی (اختیاری) */
  country: string | null
  /** لینک ساب رمزنگاری‌شده (AES-256-GCM) */
  sub_url: string
  check_interval_sec: number
  enabled: 0 | 1
  last_fetch_at: number | null
  last_fetch_error: string | null
  created_at: number
}

/** سرور به‌همراه آمار خلاصه — برای فهرست سرورها */
export interface ServerWithStats extends Server {
  config_count: number
  up_count: number
  down_count: number
  avg_latency: number | null
  last_check_at: number | null
}

export interface Config {
  id: number
  server_id: number
  fingerprint: string
  uri: string
  protocol: Protocol
  address: string | null
  port: number | null
  label: string | null
  enabled: 0 | 1
  first_seen_at: number
  last_seen_at: number
}

/** کانفیگ به‌همراه نتیجه‌ی آخرین بررسی */
export interface ConfigWithStatus extends Config {
  server_name: string
  last_ok: 0 | 1 | null
  last_status: CheckStatus | null
  last_latency_ms: number | null
  last_checked_at: number | null
  uptime_24h: number | null
}

export interface Check {
  id: number
  config_id: number
  ts: number
  ok: 0 | 1
  status: CheckStatus
  latency_ms: number | null
  ttfb_ms: number | null
  http_status: number | null
  error: string | null
}

export interface Incident {
  id: number
  config_id: number
  started_at: number
  ended_at: number | null
  fail_count: number
  last_error: string | null
}

export interface DailyStat {
  config_id: number
  day: string
  total: number
  up_count: number
  avg_latency: number | null
  min_latency: number | null
  max_latency: number | null
  p95_latency: number | null
  downtime_sec: number
}

/** نتیجه‌ی خام یک تست */
export interface TestResult {
  fingerprint: string
  ok: boolean
  latency_ms: number | null
  ttfb_ms: number | null
  http_status: number | null
  error: string | null
}

export type ErrorKind = 'timeout' | 'refused' | 'tls' | 'protocol' | 'http' | 'dns' | 'unknown'

/** نتیجه‌ی استخراج یک کانفیگ از لینک ساب */
export interface ParsedConfig {
  fingerprint: string
  uri: string
  protocol: Protocol
  address: string | null
  port: number | null
  label: string | null
  /** outbound آماده برای Xray */
  outbound: XrayOutbound
}

export interface XrayOutbound {
  tag: string
  protocol: string
  settings?: Record<string, unknown>
  streamSettings?: Record<string, unknown>
}

export interface TimelineCell {
  /** شروع بازه (Unix ms) */
  t: number
  total: number
  up: number
  avg_latency: number | null
}

export interface TimelineRow {
  config_id: number
  label: string
  server_id: number
  server_name: string
  cells: TimelineCell[]
  uptime: number | null
  avg_latency: number | null
}

export interface ConfigStats {
  config_id: number
  total: number
  up_count: number
  uptime_pct: number | null
  avg_latency: number | null
  median_latency: number | null
  p95_latency: number | null
  min_latency: number | null
  max_latency: number | null
  incident_count: number
  downtime_sec: number
  longest_healthy_sec: number | null
  mtbf_sec: number | null
  mttr_sec: number | null
}
