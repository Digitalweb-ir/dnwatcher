import type { DatabaseSync, SQLOutputValue } from 'node:sqlite'

import { getDb, transaction } from './index'
import { getSettings } from './settings'
import type {
  Check,
  Config,
  ConfigStats,
  ConfigWithStatus,
  Incident,
  Server,
  ServerWithStats,
  TimelineCell,
  TestResult,
} from '@/lib/types'

/* ───────────────────────────── سرورها ───────────────────────────── */

const SERVER_WITH_STATS_SQL = `
  WITH enabled AS (
    SELECT
      id,
      server_id,
      status,
      last_latency_ms,
      last_check_at
    FROM configs
    WHERE enabled = 1
  ),
  ranked AS (
    SELECT
      server_id,
      last_latency_ms AS latency_ms,
      ROW_NUMBER() OVER (PARTITION BY server_id ORDER BY last_latency_ms) AS rn,
      COUNT(*) OVER (PARTITION BY server_id) AS cnt
    FROM enabled
    WHERE last_latency_ms IS NOT NULL
  ),
  lat_stats AS (
    SELECT
      server_id,
      AVG(latency_ms) AS avg_latency,
      MAX(CASE WHEN rn = CAST((cnt + 1) / 2 AS INTEGER) THEN latency_ms END) AS median_latency,
      MAX(CASE WHEN rn = CAST((cnt * 95 + 99) / 100 AS INTEGER) THEN latency_ms END) AS p95_latency
    FROM ranked
    GROUP BY server_id
  )

  SELECT
    s.*,
    COALESCE(COUNT(e.id), 0)                                        AS config_count,
    COALESCE(SUM(CASE WHEN e.status = 'up'   THEN 1 ELSE 0 END), 0) AS up_count,
    COALESCE(SUM(CASE WHEN e.status = 'down' THEN 1 ELSE 0 END), 0) AS down_count,
    ls.avg_latency                                                  AS avg_latency,
    ls.median_latency                                               AS median_latency,
    ls.p95_latency                                                  AS p95_latency,
    MAX(e.last_check_at)                                          AS last_check_at
  FROM servers s
  LEFT JOIN enabled e ON e.server_id = s.id
  LEFT JOIN lat_stats ls ON ls.server_id = s.id
`

/** تبدیل تمام bigintهای یک شیء به number */
function toNumber<T>(obj: T): T {
  const result = { ...obj } as Record<string, unknown>
  for (const key of Object.keys(result)) {
    const value = result[key]
    if (typeof value === 'bigint') {
      result[key] = Number(value)
    }
  }
  return result as T
}

export function listServers(db: DatabaseSync = getDb()): ServerWithStats[] {
  const rows = db
    .prepare(`${SERVER_WITH_STATS_SQL} GROUP BY s.id ORDER BY s.created_at DESC`)
    .all() as unknown as ServerWithStats[]
  return rows.map(toNumber)
}

export function getServer(id: number, db: DatabaseSync = getDb()): ServerWithStats | null {
  const row = db.prepare(`${SERVER_WITH_STATS_SQL} WHERE s.id = ? GROUP BY s.id`).get(id) as
    | ServerWithStats
    | undefined
  return row ? toNumber(row) : null
}

export function listDueServers(now: number, db: DatabaseSync = getDb()): Server[] {
  const servers = db
    .prepare('SELECT * FROM servers WHERE enabled = 1 ORDER BY id')
    .all() as unknown as Server[]
  const serversWithNumber = servers.map(toNumber)

  const lastCheck = db
    .prepare(
      `SELECT server_id, MAX(last_check_at) AS last_check_at
         FROM configs
        WHERE enabled = 1 AND last_check_at IS NOT NULL
        GROUP BY server_id`,
    )
    .all() as { server_id: number; last_check_at: number }[]

  const lastByServer = new Map(
    lastCheck.map((row) => [row.server_id, typeof row.last_check_at === 'bigint' ? Number(row.last_check_at) : row.last_check_at]),
  )

  return serversWithNumber.filter((server) => {
    const last = lastByServer.get(server.id)
    if (last === undefined) return true
    return now - last >= server.check_interval_sec * 1000
  })
}

export function listEnabledServers(db: DatabaseSync = getDb()): Server[] {
  const rows = db.prepare('SELECT * FROM servers WHERE enabled = 1 ORDER BY id').all() as unknown as Server[]
  return rows.map(toNumber)
}

export function createServer(
  input: {
    name: string
    country?: string | null
    sub_url: string
    check_interval_sec?: number
    enabled?: number
  },
  db: DatabaseSync = getDb(),
): number {
  const result = db
    .prepare(
      `INSERT INTO servers (name, country, sub_url, check_interval_sec, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.country ?? null,
      input.sub_url,
      input.check_interval_sec ?? 300,
      input.enabled ?? 1,
      Date.now(),
    )
  return Number(result.lastInsertRowid)
}

export function updateServer(
  id: number,
  patch: Partial<
    Pick<
      Server,
      | 'name'
      | 'country'
      | 'sub_url'
      | 'check_interval_sec'
      | 'enabled'
      | 'last_fetch_at'
      | 'last_fetch_error'
    >
  >,
  db: DatabaseSync = getDb(),
): void {
  const fields = Object.keys(patch)
  if (fields.length === 0) return

  const assignments = fields.map((f) => `${f} = ?`).join(', ')
  const values = fields.map((f) => (patch as Record<string, unknown>)[f] as string | number | null)
  db.prepare(`UPDATE servers SET ${assignments} WHERE id = ?`).run(...values, id)
}

export function deleteServer(id: number, db: DatabaseSync = getDb()): void {
  db.prepare('DELETE FROM servers WHERE id = ?').run(id)
}

/* ───────────────────────────── کانفیگ‌ها ───────────────────────────── */

const CONFIG_WITH_STATUS_SQL = `
  SELECT
    c.*,
    s.name AS server_name,
    (SELECT ROUND(AVG(ok) * 100, 1)
       FROM checks ch
      WHERE ch.config_id = c.id AND ch.ts >= ?) AS uptime_24h,
    (SELECT AVG(latency_ms)
       FROM checks ch
      WHERE ch.config_id = c.id AND ch.ts >= ? AND ok = 1) AS avg_latency
  FROM configs c
  JOIN servers s ON s.id = c.server_id
`

export function listConfigs(
  options: { serverId?: number; includeDisabled?: boolean; since?: number } = {},
  db: DatabaseSync = getDb(),
): ConfigWithStatus[] {
  const since = options.since ?? Date.now() - 24 * 3600 * 1000
  const where: string[] = []
  const params: (number | string)[] = [since, since]

  if (options.serverId !== undefined) {
    where.push('c.server_id = ?')
    params.push(options.serverId)
  }
  if (!options.includeDisabled) {
    where.push('c.enabled = 1')
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const rows = db
    .prepare(`${CONFIG_WITH_STATUS_SQL} ${clause} ORDER BY s.name, c.label, c.id`)
    .all(...params) as unknown as ConfigWithStatus[]
  return rows.map(toNumber)
}

export function getConfig(id: number, db: DatabaseSync = getDb()): ConfigWithStatus | null {
  const since = Date.now() - 24 * 3600 * 1000
  const row = db.prepare(`${CONFIG_WITH_STATUS_SQL} WHERE c.id = ?`).get(since, since, id) as
    | ConfigWithStatus
    | undefined
  return row ? toNumber(row) : null
}

export function getConfigByFingerprint(fingerprint: string, db: DatabaseSync = getDb()): Config | null {
  const row = db.prepare('SELECT * FROM configs WHERE fingerprint = ?').get(fingerprint) as
    | Config
    | undefined
  return row ? toNumber(row) : null
}

export function listEnabledConfigsByServer(serverId: number, db: DatabaseSync = getDb()): Config[] {
  const rows = db
    .prepare('SELECT * FROM configs WHERE server_id = ? AND enabled = 1 ORDER BY id')
    .all(serverId) as unknown as Config[]
  return rows.map(toNumber)
}

export interface ReconcileResult {
  added: number
  reactivated: number
  disabled: number
  unchanged: number
}

export function reconcileConfigs(
  serverId: number,
  parsed: {
    fingerprint: string
    uri: string
    protocol: string
    address: string | null
    port: number | null
    label: string | null
  }[],
  db: DatabaseSync = getDb(),
): ReconcileResult {
  const now = Date.now()
  const result: ReconcileResult = { added: 0, reactivated: 0, disabled: 0, unchanged: 0 }

  return transaction((tx) => {
    const existing = tx
      .prepare('SELECT id, fingerprint, enabled FROM configs WHERE server_id = ?')
      .all(serverId) as { id: number; fingerprint: string; enabled: number }[]

    const byFingerprint = new Map(existing.map((row) => [row.fingerprint, row]))
    const seen = new Set<string>()

    const insert = tx.prepare(
      `INSERT INTO configs (server_id, fingerprint, uri, protocol, address, port, label, enabled, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    const touch = tx.prepare(
      'UPDATE configs SET last_seen_at = ?, uri = ?, label = ?, enabled = 1 WHERE id = ?',
    )

    for (const item of parsed) {
      seen.add(item.fingerprint)
      const found = byFingerprint.get(item.fingerprint)

      if (!found) {
        insert.run(
          serverId,
          item.fingerprint,
          item.uri,
          item.protocol,
          item.address,
          item.port,
          item.label,
          now,
          now,
        )
        result.added += 1
      } else if (found.enabled === 0) {
        touch.run(now, item.uri, item.label, found.id)
        result.reactivated += 1
      } else {
        touch.run(now, item.uri, item.label, found.id)
        result.unchanged += 1
      }
    }

    const disable = tx.prepare(
      "UPDATE configs SET enabled = 0, status = 'idle', fail_streak = 0 WHERE id = ?",
    )
    for (const row of existing) {
      if (!seen.has(row.fingerprint) && row.enabled === 1) {
        disable.run(row.id)
        result.disabled += 1
      }
    }

    return result
  })
}

/* ───────────────────────────── بررسی‌ها ───────────────────────────── */

export function recordChecks(
  results: { configId: number; result: TestResult }[],
  failThreshold: number,
  db: DatabaseSync = getDb(),
): { opened: number[]; closed: number[] } {
  const now = Date.now()
  const opened: number[] = []
  const closed: number[] = []

  // User-configured webhook URL, called once when a config transitions to DOWN
  const outageWebhookUrl = getSettings(db).outage_webhook_url

  const getConfig = db.prepare('SELECT id, fail_streak, status, server_id, address, port FROM configs WHERE id = ?')
  const insertCheck = db.prepare(
    `INSERT INTO checks (config_id, ts, ok, status, latency_ms, ttfb_ms, http_status, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const updateConfig = db.prepare(
    `UPDATE configs
        SET status = ?, fail_streak = ?, last_ok = ?, last_latency_ms = ?, last_check_at = ?
      WHERE id = ?`,
  )
  const openIncident = db.prepare(
    'INSERT INTO incidents (config_id, started_at, fail_count, last_error) VALUES (?, ?, ?, ?)',
  )
  const bumpIncident = db.prepare(
    'UPDATE incidents SET fail_count = fail_count + 1, last_error = ? WHERE id = ?',
  )
  const closeIncident = db.prepare('UPDATE incidents SET ended_at = ? WHERE id = ?')
  const findOpenIncident = db.prepare(
    'SELECT id FROM incidents WHERE config_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
  )

  for (const { configId, result } of results) {
    try {
      const config = getConfig.get(configId) as
        | { id: number; fail_streak: number; status: string; server_id: number; address: string | null; port: number | null }
        | undefined
      if (!config) {
        console.error(`[recordChecks] Config ${configId} not found in database. Skipping.`);
        continue
      }

      const previousStatus = config.status
      let failStreak = config.fail_streak
      let status: 'up' | 'down' | 'idle'

      if (result.ok) {
        failStreak = 0
        status = 'up'
      } else {
        failStreak += 1
        status = failStreak >= failThreshold ? 'down' : 'idle'
      }

      insertCheck.run(
        configId,
        now,
        result.ok ? 1 : 0,
        status === 'down' ? 'down' : 'up',
        result.latency_ms,
        result.ttfb_ms,
        result.http_status,
        result.error,
      )

      updateConfig.run(
        status,
        failStreak,
        result.ok ? 1 : 0,
        result.latency_ms,
        now,
        configId,
      )

      const open = findOpenIncident.get(configId) as { id: number } | undefined

      if (status === 'down') {
        if (open) {
          bumpIncident.run(result.error, open.id)
        } else {
          openIncident.run(configId, now, failStreak, result.error)
          opened.push(configId)

          // Notify the user-configured webhook on the DOWN transition (fire and forget)
          if (outageWebhookUrl) {
            fetch(outageWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'config_down',
                configId,
                serverId: config.server_id,
                address: config.address,
                port: config.port,
                failStreak,
                threshold: failThreshold,
                error: result.error,
                timestamp: now,
              }),
            }).catch((err) =>
              console.error(`[recordChecks] Outage webhook failed for config ${configId}: ${err.message}`),
            )
          }

          // Trigger Webhook for Down Event
          // We use a non-blocking fetch to avoid delaying the checker
          fetch(`${process.env.APP_URL ?? 'http://localhost:3000'}/api/webhooks/recovery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              configId,
              serverId: config.server_id,
              address: config.address,
              port: config.port,
              error: result.error,
              failStreak,
            }),
          }).catch(err => console.error(`[recordChecks] Webhook trigger failed: ${err.message}`))
        }
      } else if (status === 'up' && (open || previousStatus === 'down')) {
        if (open) {
          closeIncident.run(now, open.id)
          closed.push(configId)
        }
      }
    } catch (e) {
      console.error(`[recordChecks] Critical failure for config ${configId}:`, e)
    }
  }

  return { opened, closed }
}

export function listChecks(
  configId: number,
  options: { since?: number; until?: number; limit?: number } = {},
  db: DatabaseSync = getDb(),
): Check[] {
  const where = ['config_id = ?']
  const params: number[] = [configId]

  if (options.since !== undefined) {
    where.push('ts >= ?')
    params.push(options.since)
  }
  if (options.until !== undefined) {
    where.push('ts <= ?')
    params.push(options.until)
  }

  const limit = options.limit ?? 500
  const rows = db
    .prepare(`SELECT * FROM checks WHERE ${where.join(' AND ')} ORDER BY ts DESC LIMIT ?`)
    .all(...params, limit) as unknown as Check[]
  return rows.map(toNumber)
}

export function listLatestChecks(db: DatabaseSync = getDb()): (Check & { config_id: number })[] {
  const rows = db
    .prepare(
      `SELECT ch.* FROM checks ch
        JOIN (SELECT config_id, MAX(ts) AS max_ts FROM checks GROUP BY config_id) latest
          ON latest.config_id = ch.config_id AND latest.max_ts = ch.ts`,
    )
    .all() as unknown as Check[]
  return rows.map(toNumber)
}

export function listIncidents(
  options: { configId?: number; serverId?: number; since?: number; limit?: number } = {},
  db: DatabaseSync = getDb(),
): (Incident & { label: string | null; server_name: string })[] {
  const where: string[] = []
  const params: number[] = []

  if (options.configId !== undefined) {
    where.push('i.config_id = ?')
    params.push(options.configId)
  }
  if (options.serverId !== undefined) {
    where.push('c.server_id = ?')
    params.push(options.serverId)
  }
  if (options.since !== undefined) {
    where.push('i.started_at >= ?')
    params.push(options.since)
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const rows = db
    .prepare(
      `SELECT i.*, c.label, s.name AS server_name
         FROM incidents i
         JOIN configs c ON c.id = i.config_id
         JOIN servers s ON s.id = c.server_id
         ${clause}
        ORDER BY i.started_at DESC
        LIMIT ?`,
    )
    .all(...params, options.limit ?? 100) as unknown as (Incident & { label: string | null; server_name: string })[]
  return rows.map(toNumber)
}

export function timelineCells(
  options: { since: number; until: number; bucketMs: number; configIds?: number[] },
  db: DatabaseSync = getDb(),
): Map<number, TimelineCell[]> {
  const params: number[] = [options.bucketMs, options.bucketMs, options.since, options.until]
  let filter = ''
  if (options.configIds && options.configIds.length > 0) {
    filter = `AND config_id IN (${options.configIds.map(() => '?').join(',')})`
    params.push(...options.configIds)
  }

  const rows = db
    .prepare(
      `SELECT
         config_id,
         (CAST(ts / ? AS INTEGER) * ?) AS bucket,
         COUNT(*)           AS total,
         SUM(ok)            AS up,
         AVG(CASE WHEN ok = 1 THEN latency_ms END) AS avg_latency
       FROM checks
      WHERE ts >= ? AND ts <= ? ${filter}
      GROUP BY config_id, bucket
      ORDER BY bucket`,
    )
    .all(...params) as { config_id: number; bucket: number; total: number; up: number; avg_latency: number | null }[]

  const out = new Map<number, TimelineCell[]>()
  for (const row of rows) {
    const list = out.get(row.config_id) ?? []
    list.push({
      // bucket از قبل میلی‌ثانیه و هم‌تراز با مرزهای بازه است
      t: Number(row.bucket),
      total: row.total,
      up: row.up,
      avg_latency: row.avg_latency,
    })
    out.set(row.config_id, list)
  }
  return out
}

export function configStats(
  configId: number,
  since: number,
  db: DatabaseSync = getDb(),
): ConfigStats {
  const agg = db
    .prepare(
      `SELECT
         COUNT(*)                                                        AS total,
         COALESCE(SUM(ok), 0)                                            AS up_count,
         AVG(CASE WHEN ok = 1 THEN latency_ms END)                       AS avg_latency,
         MIN(CASE WHEN ok = 1 THEN latency_ms END)                       AS min_latency,
         MAX(CASE WHEN ok = 1 THEN latency_ms END)                       AS max_latency
       FROM checks WHERE config_id = ? AND ts >= ?`,
    )
    .get(configId, since) as {
    total: number
    up_count: number
    avg_latency: number | null
    min_latency: number | null
    max_latency: number | null
  }
  const aggFixed = toNumber(agg)

  const latencies = db
    .prepare(
      'SELECT latency_ms FROM checks WHERE config_id = ? AND ts >= ? AND ok = 1 AND latency_ms IS NOT NULL ORDER BY latency_ms',
    )
    .all(configId, since) as { latency_ms: number }[]
  const latenciesFixed = latencies.map(toNumber)

  const median = percentile(latenciesFixed.map((r) => r.latency_ms), 0.5)
  const p95 = percentile(latenciesFixed.map((r) => r.latency_ms), 0.95)

  const incidents = db
    .prepare(
      `SELECT started_at, ended_at FROM incidents
        WHERE config_id = ? AND started_at >= ? ORDER BY started_at`,
    )
    .all(configId, since) as { started_at: number; ended_at: number | null }[]
  const incidentsFixed = incidents.map(toNumber)

  const now = Date.now()
  const downtimeSec = incidentsFixed.reduce((sum, inc) => {
    const end = inc.ended_at ?? now
    return sum + Math.max(0, Math.round((end - inc.started_at) / 1000))
  }, 0)

  const boundaries = [since, ...incidentsFixed.flatMap((i) => (i.ended_at ? [i.ended_at] : []))]
  const starts = incidentsFixed.map((i) => i.started_at)
  let longestHealthy = 0
  for (let i = 0; i < boundaries.length; i++) {
    const from = boundaries[i]
    const nextStart = starts.find((s) => s > from)
    const to = nextStart ?? now
    if (to > from) longestHealthy = Math.max(longestHealthy, Math.round((to - from) / 1000))
  }

  const windowSec = Math.max(1, Math.round((now - since) / 1000))
  const incidentCount = incidentsFixed.length
  const mtbfSec = incidentCount > 0 ? Math.max(0, Math.round((windowSec - downtimeSec) / incidentCount)) : null
  const mttrSec = incidentCount > 0 ? Math.round(downtimeSec / incidentCount) : null

  return {
    config_id: configId,
    total: aggFixed.total,
    up_count: aggFixed.up_count,
    uptime_pct: aggFixed.total > 0 ? (aggFixed.up_count / aggFixed.total) * 100 : null,
    avg_latency: aggFixed.avg_latency,
    median_latency: median,
    p95_latency: p95,
    min_latency: aggFixed.min_latency,
    max_latency: aggFixed.max_latency,
    incident_count: incidentCount,
    downtime_sec: downtimeSec,
    longest_healthy_sec: longestHealthy,
    mtbf_sec: mtbfSec,
    mttr_sec: mttrSec,
  }
}

function percentile(sorted: number[], ratio: number): number | null {
  if (sorted.length === 0) return null
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))
  return sorted[index]
}

export interface DashboardSummary {
  total_configs: number
  up_count: number
  down_count: number
  idle_count: number
  avg_latency: number | null
  uptime_24h: number | null
  total_incidents_24h: number
  servers: number
}

export function dashboardSummary(db: DatabaseSync = getDb()): DashboardSummary {
  const since = Date.now() - 24 * 3600 * 1000

  const configs = toNumber(
    db
      .prepare(
        `SELECT
           COUNT(*)                                                       AS total_configs,
           COALESCE(SUM(CASE WHEN status = 'up'   THEN 1 ELSE 0 END), 0)  AS up_count,
           COALESCE(SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END), 0)  AS down_count,
           COALESCE(SUM(CASE WHEN status = 'idle' THEN 1 ELSE 0 END), 0)  AS idle_count,
           AVG(CASE WHEN last_latency_ms IS NOT NULL THEN last_latency_ms END) AS avg_latency
         FROM configs WHERE enabled = 1`,
      )
      .get() ?? {},
  ) as Omit<DashboardSummary, 'uptime_24h' | 'total_incidents_24h' | 'servers'>

  const checks = toNumber(
    db.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(ok), 0) AS up FROM checks WHERE ts >= ?').get(since) ?? {},
  ) as { total: number; up: number }

  const incidents = toNumber(
    db.prepare('SELECT COUNT(*) AS c FROM incidents WHERE started_at >= ?').get(since) ?? {},
  ) as { c: number }

  const servers = toNumber(
    db.prepare('SELECT COUNT(*) AS c FROM servers WHERE enabled = 1').get() ?? {},
  ) as { c: number }

  return {
    ...configs,
    uptime_24h: checks.total > 0 ? (checks.up / checks.total) * 100 : null,
    total_incidents_24h: incidents.c,
    servers: servers.c,
  }
}
