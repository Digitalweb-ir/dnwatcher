/**
 * اجرای پروسه‌ی Xray برای یک دسته کانفیگ و تست همه‌ی inboundها.
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
import { LatencyQueue } from './queue'

export interface RunOptions {
  testUrl: string
  timeoutMs: number
  portBase: number
  /** حداکثر زمان انتظار برای آماده شدن Xray (میلی‌ثانیه) */
  readyTimeoutMs?: number
}

export const XRAY_NOT_FOUND = 'XRAY_NOT_FOUND'

const isDebug = process.env.DEBUG === 'true'
const debugLog = (...args: any[]) => isDebug && console.log(`[xray-runner]`, ...args)

// صف سراسری برای پردازش ترتیبی تست‌ها (جلوگیری از تداخل شبکه)
const globalQueue = new LatencyQueue<void, ProbeResult>()

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

    const results: ProbeResult[] = []
    for (const port of ports) {
      // هر تست را به صف می‌فرستیم تا ترتیبی اجرا شود
      const result = await globalQueue.add(async () => {
        // ۱. Warm-up: یک درخواست اولیه برای گرم کردن تونل (TLS Handshake)
        await probeThroughSocks5(port, options.testUrl, options.timeoutMs, true).catch(() => {})

        // ۲. تست اصلی (Best-of-2)
        const samples: ProbeResult[] = []
        for (let s = 0; s < 2; s++) {
          samples.push(await probeThroughSocks5(port, options.testUrl, options.timeoutMs))
        }

        const successful = samples.filter(p => p.ok).sort((a, b) => (a.latency_ms || 0) - (b.latency_ms || 0))

        if (successful.length === 0) return samples[0]
        return { ...successful[0], ok: true }
      })
      results.push(result)
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

async function waitForPorts(
  ports: number[],
  hasExited: () => boolean,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let attempts = 0
  while (Date.now() < deadline) {
    attempts++
    if (hasExited()) throw new Error('xray exited before ready')
    const statuses = await Promise.all(ports.map((port) => isPortOpen(port)))
    if (statuses.every(Boolean)) return
    await delay(120)
  }
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
