/**
 * کلاینت سبک SOCKS5 + HTTP/HTTPS برای تست کانفیگ‌ها.
 *
 * چرا بدون کتابخانه؟
 *   می‌خواهیم زمان‌بندی دقیق (TTFB) و کنترل کامل روی سوکت داشته باشیم و
 *   وابستگی سنگینی به پروژه اضافه نکنیم. هر inbound موتور Xray یک پروکسی
 *   SOCKS5 محلی است؛ کافی است از داخل آن تونل یک درخواست HTTP بزنیم.
 */
import net from 'node:net'
import tls from 'node:tls'

import type { ErrorKind } from '@/lib/types'

export interface ProbeResult {
  ok: boolean
  latency_ms: number | null
  ttfb_ms: number | null
  http_status: number | null
  error: ErrorKind | null
}

export interface TunnelOptions {
  proxyHost: string
  proxyPort: number
  targetHost: string
  targetPort: number
  timeoutMs: number
}

/** یک سوکت TCP که از طریق پروکسی SOCKS5 به مقصد تونل شده است. */
export function openSocks5Tunnel(options: TunnelOptions): Promise<net.Socket> {
  const { proxyHost, proxyPort, targetHost, targetPort, timeoutMs } = options

  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: proxyHost, port: proxyPort })
    let settled = false

    const fail = (error: ErrorKind) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      reject(new Error(error))
    }

    const timer = setTimeout(() => fail('timeout'), timeoutMs)

    socket.once('error', (err) => fail(classify(err)))
    socket.once('close', () => fail('refused'))
    socket.once('connect', () => socket.write(Buffer.from([0x05, 0x01, 0x00])))

    let stage: 'greeting' | 'connect' = 'greeting'
    let buffer = Buffer.alloc(0)

    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk])

      if (stage === 'greeting') {
        if (buffer.length < 2) return
        if (buffer[0] !== 0x05 || buffer[1] !== 0x00) return fail('protocol')
        buffer = buffer.subarray(2)
        stage = 'connect'
        socket.write(buildConnectRequest(targetHost, targetPort))
        return
      }

      if (buffer.length < 4) return
      if (buffer[1] !== 0x00) return fail('refused')

      const atyp = buffer[3]
      let needed = 0
      if (atyp === 0x01) needed = 4 + 4 + 2
      else if (atyp === 0x03) {
        if (buffer.length < 5) return
        needed = 5 + buffer[4] + 2
      } else if (atyp === 0x04) needed = 4 + 16 + 2
      else return fail('protocol')

      if (buffer.length < needed) return

      settled = true
      clearTimeout(timer)
      socket.removeAllListeners('data')
      socket.removeAllListeners('close')
      socket.removeAllListeners('error')
      resolve(socket)
    })
  })
}

function buildConnectRequest(host: string, port: number): Buffer {
  const portBuffer = Buffer.alloc(2)
  portBuffer.writeUInt16BE(port)
  const hostBuffer = Buffer.from(host, 'utf8')
  return Buffer.concat([
    Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuffer.length]),
    hostBuffer,
    portBuffer,
  ])
}

/**
 * یک درخواست HTTP/HTTPS از داخل تونل SOCKS5 می‌زند و متریک‌ها را برمی‌گرداند.
 */
export async function probeThroughSocks5(
  proxyPort: number,
  url: string,
  timeoutMs: number,
): Promise<ProbeResult> {
  const target = new URL(url)
  const isTls = target.protocol === 'https:'
  const targetPort = target.port ? Number(target.port) : isTls ? 443 : 80
  const path = `${target.pathname}${target.search}` || '/'

  const started = Date.now()
  let rawSocket: net.Socket
  try {
    rawSocket = await openSocks5Tunnel({
      proxyHost: '127.0.0.1',
      proxyPort,
      targetHost: target.hostname,
      targetPort,
      timeoutMs,
    })
  } catch (error) {
    return { ok: false, latency_ms: null, ttfb_ms: null, http_status: null, error: classify(error) }
  }

  let connection: net.Socket
  try {
    connection = isTls ? await wrapTls(rawSocket, target.hostname) : rawSocket
  } catch (error) {
    rawSocket.destroy()
    return { ok: false, latency_ms: null, ttfb_ms: null, http_status: null, error: classify(error) }
  }

  return new Promise<ProbeResult>((resolve) => {
    let settled = false
    let ttfb: number | null = null
    let received = ''

    const finish = (result: ProbeResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      connection.destroy()
      resolve(result)
    }

    const timer = setTimeout(
      () =>
        finish({
          ok: false,
          latency_ms: null,
          ttfb_ms: ttfb,
          http_status: null,
          error: 'timeout',
        }),
      timeoutMs,
    )

    connection.on('data', (chunk) => {
      if (ttfb === null) ttfb = Date.now() - started
      received += chunk.toString('latin1')
      const headerEnd = received.indexOf('\r\n\r\n')
      if (headerEnd === -1) return

      const statusLine = received.slice(0, received.indexOf('\r\n'))
      const match = statusLine.match(/^HTTP\/\d\.\d\s+(\d{3})/)
      const status = match ? Number(match[1]) : null
      const ok = status !== null && status >= 200 && status < 400

      finish({
        ok,
        latency_ms: Date.now() - started,
        ttfb_ms: ttfb,
        http_status: status,
        error: ok ? null : 'http',
      })
    })

    connection.once('error', (err) =>
      finish({ ok: false, latency_ms: null, ttfb_ms: ttfb, http_status: null, error: classify(err) }),
    )
    connection.once('close', () =>
      finish({ ok: false, latency_ms: null, ttfb_ms: ttfb, http_status: null, error: 'protocol' }),
    )

    connection.write(
      `GET ${path} HTTP/1.1\r\nHost: ${target.hostname}\r\nUser-Agent: dnw/1.0\r\nAccept: */*\r\nConnection: close\r\n\r\n`,
    )
  })
}

function wrapTls(socket: net.Socket, servername: string): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const tlsSocket = tls.connect({ socket, servername, rejectUnauthorized: false })
    tlsSocket.once('secureConnect', () => resolve(tlsSocket))
    tlsSocket.once('error', reject)
  })
}

function classify(error: unknown): ErrorKind {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  if (message.includes('timeout')) return 'timeout'
  if (message.includes('refused') || message.includes('econnrefused')) return 'refused'
  if (message.includes('tls') || message.includes('certificate')) return 'tls'
  if (message.includes('enotfound') || message.includes('dns')) return 'dns'
  if (message.includes('protocol') || message.includes('closed')) return 'protocol'
  return 'unknown'
}
