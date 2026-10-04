/**
 * لایه‌ی سرویس بررسی: از یک سرور تا ثبت نتیجه در دیتابیس.
 *
 * این ماژول تنها جایی است که «دریافت ساب → تست → ثبت» را هماهنگ می‌کند؛
 * هم زمان‌بند پس‌زمینه و هم دکمه‌ی «چک فوری» در UI از همین توابع استفاده می‌کنند.
 */
import { getDb } from '@/lib/db'
import {
  listDueServers,
  listEnabledConfigsByServer,
  listEnabledServers,
  recordChecks,
} from '@/lib/db/queries'
import { getSettings } from '@/lib/db/settings'
import { reconcileServer } from '@/lib/sub/reconcile'
import type { Server, TestResult } from '@/lib/types'
import { hasXray } from '@/lib/xray/binary'
import { testConfigs, type ConfigTestResult } from '@/lib/xray/tester'
import { emitConfigCheck, emitConfigStart, emit } from '@/app/api/stream/route'

/** وضعیت آخرین دور بررسی — برای نمایش در UI */
export interface CycleState {
  running: boolean
  startedAt: number | null
  finishedAt: number | null
  servers: number
  configs: number
  up: number
  down: number
  errors: string[]
}

let cycleState: CycleState = {
  running: false,
  startedAt: null,
  finishedAt: null,
  servers: 0,
  configs: 0,
  up: 0,
  down: 0,
  errors: [],
}

export function getCycleState(): CycleState {
  return { ...cycleState, errors: [...cycleState.errors] }
}

export interface ServerCheckResult {
  serverId: number
  configs: number
  up: number
  down: number
  error: string | null
}

/**
 * بررسی یک سرور: در صورت نیاز ابتدا ساب را تازه می‌کند، بعد کانفیگ‌ها را تست می‌کند.
 * نکته: تست‌ها عمداً سریالی اجرا می‌شوند چون همه‌ی دسته‌ها از یک بازه‌ی پورت مشترک
 * استفاده می‌کنند و اجرای هم‌زمان باعث تداخل پورت می‌شود.
 */
export async function checkServer(
  serverId: number,
  options: { refresh?: boolean } = {},
): Promise<ServerCheckResult> {
  const db = getDb()
  const settings = getSettings(db)

  let configs = listEnabledConfigsByServer(serverId, db)
  let refreshError: string | null = null

  if (options.refresh || configs.length === 0) {
    const reconciled = await reconcileServer(serverId)
    if (reconciled.error) {
      refreshError = reconciled.error
    }
    configs = listEnabledConfigsByServer(serverId, db)
  }

  if (configs.length === 0) {
    return {
      serverId,
      configs: 0,
      up: 0,
      down: 0,
      error: refreshError ?? 'هیچ کانفیگی برای این سرور یافت نشد.',
    }
  }

  if (!hasXray()) {
    console.error('[check-server] Xray binary NOT found on system!')
    return {
      serverId,
      configs: configs.length,
      up: 0,
      down: 0,
      error: 'باینری Xray روی سیستم پیدا نشد؛ تست‌ها اجرا نمی‌شوند.',
    }
  }

  console.log(`[check-server] Testing ${configs.length} configs for server ${serverId}...`)

  try {
    // ۱. اعلام شروع تست برای کل سرور (در صورت نیاز) و هر کانفیگ
    const configsForServer = listEnabledConfigsByServer(serverId, db)
    configsForServer.forEach(c => emitConfigStart(c.id))

    // اضافه کردن Hard Timeout برای کل عملیات تست سرور (مثلا حداکثر ۶۰ ثانیه)
    const testPromise = testConfigs(configs, {
      testUrl: settings.test_url,
      timeoutMs: settings.request_timeout_ms,
      portBase: settings.port_base,
      maxBatch: settings.max_batch,
    })

    const timeoutPromise = new Promise<any>((_, reject) =>
      setTimeout(() => reject(new Error('server_check_timeout')), 120000)
    )

    const results = (await Promise.race([testPromise, timeoutPromise])) as ConfigTestResult[]

    console.log(`[check-server] Server ${serverId} results: ${results.filter((r: ConfigTestResult) => r.result.ok).length}/${results.length} UP`)

    const checkResults = results.map((item: ConfigTestResult) => ({ configId: item.configId, result: item.result }))

    recordChecks(checkResults, settings.fail_threshold, db)

    // ۲. ارسال رویداد نتیجه برای هر کانفیگ
    for (const item of results) {
      emitConfigCheck(item.configId, {
        ok: item.result.ok,
        latency_ms: item.result.latency_ms,
      })
    }

    const up = results.filter((item: ConfigTestResult) => item.result.ok).length

    return {
      serverId,
      configs: results.length,
      up,
      down: results.length - up,
      error: refreshError,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[check-server] Critical error testing server ${serverId}: ${message}`)
    return {
      serverId,
      configs: configs.length,
      up: 0,
      down: configs.length,
      error: message === 'server_check_timeout' ? 'زمان تست سرور به پایان رسید (Timeout)' : message,
    }
  }
}

/** آیا وقت تازه‌سازی ساب این سرور رسیده است؟ */
function needsRefresh(server: Server, now: number, refreshSec: number): boolean {
  if (!server.last_fetch_at) return true
  return now - server.last_fetch_at >= refreshSec * 1000
}

/**
 * یک دور کامل بررسی روی سرورهای موعددار.
 * اگر `force` باشد، همه‌ی سرورهای فعال بررسی می‌شوند (صرف‌نظر از بازه).
 */
export async function runCheckCycle(
  options: { force?: boolean } = {},
): Promise<CycleState> {
  if (cycleState.running) return getCycleState()

  const db = getDb()
  const settings = getSettings(db)
  const now = Date.now()

  const servers: Server[] = options.force
    ? listEnabledServers(db)
    : listDueServers(now, db)

  cycleState = {
    running: true,
    startedAt: now,
    finishedAt: null,
    servers: servers.length,
    configs: 0,
    up: 0,
    down: 0,
    errors: [],
  }

  // فوراً وضعیت شروع را پخش کن
  emit('cycle:state', getCycleState())

  try {
    for (const server of servers) {
      try {
        const result = await checkServer(server.id, {
          refresh: needsRefresh(server, now, settings.sub_refresh_sec),
        })
        cycleState.configs += result.configs
        cycleState.up += result.up
        cycleState.down += result.down
        if (result.error) cycleState.errors.push(`${server.name}: ${result.error}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        cycleState.errors.push(`${server.name}: ${message}`)
      }
    }
  } finally {
    cycleState.running = false
    cycleState.finishedAt = Date.now()
    // وضعیت پایان را پخش کن
    emit('cycle:state', getCycleState())
  }

  return getCycleState()
}