/**
 * هماهنگ‌کننده‌ی تست: از کانفیگ‌های دیتابیس به نتیجه‌ی خام می‌رسد.
 *
 * برای سرعت حداکثری و دقت بالا، تست‌ها را در دسته‌های بهینه اجرا می‌کند.
 * هر دسته در یک پروسه Xray مشترک اجرا می‌شود تا سربار استارت/استاپ کاهش یابد،
 * اما درخواست‌های Probe به صورت ترتیبی ارسال می‌شوند تا Latency دقیق باشد.
 */
import { parseUri } from '@/lib/sub/parse'
import type { Config, ErrorKind, ParsedConfig, TestResult, XrayOutbound } from '@/lib/types'

import { XRAY_NOT_FOUND, runBatch } from './runner'
import { measureTcpPing, type ProbeResult } from './socks5'

export interface TestOptions {
  testUrl: string
  timeoutMs: number
  portBase: number
  maxBatch: number
}

export interface ConfigTestResult {
  configId: number
  fingerprint: string
  result: TestResult
}

/**
 * تست کانفیگ‌ها.
 * برای سرعت و دقت، از یک پروسه Xray برای هر دسته استفاده می‌کند.
 */
export async function testConfigs(
  configs: Config[],
  options: TestOptions,
): Promise<ConfigTestResult[]> {
  if (configs.length === 0) return []

  const out: ConfigTestResult[] = []
  const prepared: { config: Config; parsed: ParsedConfig }[] = []

  for (const config of configs) {
    const parsed = parseUri(config.uri)
    if (!parsed) {
      out.push({
        configId: config.id,
        fingerprint: config.fingerprint,
        result: toTestResult(config.fingerprint, failResult('protocol')),
      })
      continue
    }
    prepared.push({ config, parsed })
  }

  const size = Math.max(1, options.maxBatch)
  for (let i = 0; i < prepared.length; i += size) {
    const chunk = prepared.slice(i, i + size)
    const outbounds = chunk.map((item) => item.parsed.outbound)

    try {
      // اجرای تست‌ها در یک پروسه Xray مشترک.
      // runBatch حالا داخلیتاً تست‌ها را ترتیبی (Sequential) اجرا می‌کند.
      const probes = await runBatch(outbounds, options)

      for (let j = 0; j < chunk.length; j++) {
        const item = chunk[j]
        const probe = probes[j]

        // اندازه‌گیری TCP Ping برای هر کانفیگ (بدون نیاز به Xray)
        const tcpPing = (item.parsed.address && item.parsed.port)
          ? await measureTcpPing(item.parsed.address, item.parsed.port, options.timeoutMs)
          : null

        out.push({
          configId: item.config.id,
          fingerprint: item.config.fingerprint,
          result: toTestResult(item.config.fingerprint, { ...probe, tcp_ping_ms: tcpPing }),
        })
      }
    } catch (error) {
      if (error instanceof Error && error.message === XRAY_NOT_FOUND) throw error

      // در صورت شکست کلی دسته، هر کانفیگ را به صورت ایزوله تست می‌کنیم
      // اما برای جلوگیری از کندی، این کار را فقط در موارد اضطراری انجام می‌دهیم.
      for (const item of chunk) {
        try {
          const [probe] = await runBatch([item.parsed.outbound], options)
          out.push({
            configId: item.config.id,
            fingerprint: item.config.fingerprint,
            result: toTestResult(item.config.fingerprint, probe),
          })
        } catch (e) {
          out.push({
            configId: item.config.id,
            fingerprint: item.config.fingerprint,
            result: toTestResult(item.config.fingerprint, failResult('unknown')),
          })
        }
      }
    }
  }

  return out
}

function toTestResult(fingerprint: string, probe: ProbeResult | undefined): TestResult {
  if (!probe) {
    return {
      fingerprint,
      ok: false,
      latency_ms: null,
      tcp_ping_ms: null,
      ttfb_ms: null,
      http_status: null,
      error: 'unknown',
    }
  }
  return {
    fingerprint,
    ok: probe.ok,
    latency_ms: probe.latency_ms,
    tcp_ping_ms: probe.tcp_ping_ms,
    ttfb_ms: probe.ttfb_ms,
    http_status: probe.http_status,
    error: probe.error,
  }
}

function failResult(kind: ErrorKind): ProbeResult {
  return { ok: false, latency_ms: null, tcp_ping_ms: null, ttfb_ms: null, http_status: null, error: kind }
}
