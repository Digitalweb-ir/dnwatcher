/**
 * اجرای پروسه‌ی Xray برای یک دسته کانفیگ و تست همه‌ی inboundها.
 *
 * چرخه‌ی کار:
 *   ۱. نوشتن کانفیگ JSON در یک پوشه‌ی موقت
 *   ۲. spawn کردن باینری Xray
 *   ۳. انتظار تا باز شدن پورت‌های SOCKS5 (یا شکست)
 *   ۴. تست هم‌زمان همه‌ی پورت‌ها از داخل تونل
 *   ۵. kill پروسه و پاک‌سازی فایل موقت
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { XrayOutbound } from '@/lib/types'

import { findXrayBinary } from './binary'
import { buildBatchConfig } from './build'
import { probeThroughSocks5, type ProbeResult } from './socks5'

export interface RunOptions {
  testUrl: string
  timeoutMs: number
  portBase: number
  /** حداکثر زمان انتظار برای آماده شدن Xray (میلی‌ثانیه) */
  readyTimeoutMs?: number
}

/** خطای نبود باینری — تا لایه‌ی بالاتر بتواند پیام مناسب نشان دهد */
export const XRAY_NOT_FOUND = 'XRAY_NOT_FOUND'

const isDebug = process.env.DEBUG === 'true'
const debugLog = (...args: any[]) => isDebug && console.log(`[xray-runner]`, ...args)

/**
 * یک دسته outbound را تست می‌کند و نتیجه‌ی هر کدام را به ترتیب برمی‌گرداند.
 * اگر Xray در دسترس نباشد، خطای `XRAY_NOT_FOUND` پرتاب می‌شود.
 */
export async function runBatch(
  outbounds: XrayOutbound[],
  options: RunOptions,
): Promise<ProbeResult[]> {
  if (outbounds.length === 0) return []

  const binary = findXrayBinary()
  if (!binary) {
    debugLog('Binary not found')
    throw new Error(XRAY_NOT_FOUND)
  }

  const { config, ports } = buildBatchConfig(outbounds, options.portBase)
  const dir = mkdtempSync(join(tmpdir(), 'dnw-xray-'))
  const configPath = join(dir, 'config.json')
  writeFileSync(configPath, JSON.stringify(config), 'utf8')

  debugLog(`Spawning Xray binary: ${binary} with config: ${configPath}`)
  const child = spawn(binary, ['run', '-c', configPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let logs = ''
  child.stdout?.on('data', (chunk: Buffer) => {
    const s = chunk.toString()
    logs += s
    if (isDebug) console.log(`[xray-stdout] ${s}`)
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    const s = chunk.toString()
    logs += s
    if (isDebug) console.error(`[xray-stderr] ${s}`)
  })

  let exited = false
  child.once('exit', (code) => {
    exited = true
    debugLog(`Xray process exited with code: ${code}`)
  })

  try {
    debugLog(`Waiting for ports to open: ${ports.join(', ')}`)
    await waitForPorts(ports, () => exited || child.exitCode !== null, options.readyTimeoutMs ?? 8000)
    debugLog('Ports are ready, starting probes...')
    // مهم: داخل یک Xray مشترک باقی می‌مانیم، اما پروب‌ها را ترتیبی اجرا می‌کنیم
    // تا latency هر کانفیگ از هم‌زمانی/تداخل شبکه تحت‌تأثیر قرار نگیرد.
    const results: ProbeResult[] = []
    for (const port of ports) {
      results.push(await probeThroughSocks5(port, options.testUrl, options.timeoutMs))
    }
    return results
  } catch (error) {
    if (logs.trim()) {
      debugLog(`Xray logs on error: ${logs.trim()}`)
    }
    throw error
  } finally {
    debugLog('Killing Xray process and cleaning up...')
    child.kill('SIGKILL')
    rmSync(dir, { recursive: true, force: true })
  }
}

/** انتظار تا باز شدن همه‌ی پورت‌ها؛ با تایم‌اوت و تشخیص خروج زودهنگام پروسه */
async function waitForPorts(
  ports: number[],
  hasExited: () => boolean,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let attempts = 0

  while (Date.now() < deadline) {
    attempts++
    if (hasExited()) {
      debugLog(`Process exited prematurely at attempt ${attempts}`)
      throw new Error('xray exited before ready')
    }
    const statuses = await Promise.all(ports.map((port) => isPortOpen(port)))
    if (statuses.every(Boolean)) {
      debugLog(`All ports opened in ${attempts} attempts`)
      return
    }
    await delay(120)
  }

  debugLog(`Timeout reached after ${attempts} attempts`)
  throw new Error('xray ready timeout')
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    const done = (value: boolean) => {
      socket.destroy()
      resolve(value)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    socket.setTimeout(400, () => done(false))
  })
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
