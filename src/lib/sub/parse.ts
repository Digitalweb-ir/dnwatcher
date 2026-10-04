import crypto from 'node:crypto'

import type { ParsedConfig, Protocol, XrayOutbound } from '@/lib/types'

/** پروتکل‌هایی که موتور می‌تواند تست کند */
const SUPPORTED: ReadonlySet<string> = new Set(['vless', 'vmess', 'trojan', 'ss', 'socks', 'http'])

/* ───────────────────────────── ابزارهای پایه ───────────────────────────── */

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function decodeComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** حذف fragment (`#name`) — چون نام بخشی از هویت کانفیگ نیست */
function stripFragment(uri: string): string {
  const index = uri.indexOf('#')
  return index === -1 ? uri : uri.slice(0, index)
}

function readFragment(uri: string): string | null {
  const index = uri.indexOf('#')
  if (index === -1) return null
  const label = decodeComponent(uri.slice(index + 1)).trim()
  return label.length > 0 ? label : null
}

/** حذف کلیدهای undefined/null/خالی تا کانفیگ Xray معتبر بماند */
function prune<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => prune(item)) as unknown as T
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined || item === null) continue
      if (typeof item === 'string' && item.length === 0) continue
      if (Array.isArray(item) && item.length === 0) continue
      out[key] = prune(item)
    }
    return out as T
  }
  return value
}

function toBool(value: string | null): boolean | undefined {
  if (value === null) return undefined
  return value === '1' || value.toLowerCase() === 'true'
}

/* ───────────────────────────── query params ───────────────────────────── */

/**
 * پوشش سبک روی query string کانفیگ‌ها.
 * به‌جای `URLParams` از یک نگاشت ساده استفاده می‌کنیم چون:
 * کلیدها بی‌اهمیت به بزرگی/کوچکی‌اند، کلید تکراری آخرین مقدار را می‌گیرد،
 * و لینک‌هایی که `?` ندارند یا مقدارشان خالی است هم بدون خطا کار می‌کنند.
 */
class URLParams {
  private readonly map = new Map<string, string>()

  constructor(query?: string) {
    if (!query) return
    const raw = query.startsWith('?') ? query.slice(1) : query
    if (!raw) return

    for (const pair of raw.split('&')) {
      if (!pair) continue
      const eq = pair.indexOf('=')
      const key = eq === -1 ? pair : pair.slice(0, eq)
      const value = eq === -1 ? '' : pair.slice(eq + 1)
      if (!key) continue
      this.map.set(decodeComponent(key).toLowerCase(), decodeComponent(value))
    }
  }

  /** مقدار یک کلید؛ کلید ناموجود یا مقدار خالی → null */
  get(key: string): string | null {
    const value = this.map.get(key.toLowerCase())
    return value === undefined || value === '' ? null : value
  }

  set(key: string, value: string): this {
    this.map.set(key.toLowerCase(), value)
    return this
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }
}

/* ───────────────────────────── streamSettings ───────────────────────────── */

/**
 * ساخت `streamSettings` از پارامترهای query.
 * پوشش: tcp / ws / grpc / http(h2) / quic / kcp و امنیت‌های tls / reality / none
 */
function buildStreamSettings(params: URLParams): Record<string, unknown> {
  const rawNetwork = (params.get('type') ?? params.get('net') ?? 'tcp').toLowerCase()
  const network = rawNetwork === 'h2' ? 'http' : rawNetwork
  const security = (params.get('security') ?? 'none').toLowerCase()

  const host = params.get('host') ?? undefined
  const path = params.get('path') ?? undefined
  const sni = params.get('sni') ?? params.get('peer') ?? undefined
  const alpn = params.get('alpn')
  const fingerprint = params.get('fp') ?? undefined
  const headerType = (params.get('headerType') ?? params.get('type'))?.toLowerCase()

  const stream: Record<string, unknown> = { network }

  switch (network) {
    case 'ws': {
      stream.wsSettings = {
        path: path ?? '/',
        headers: host ? { Host: host } : undefined,
      }
      break
    }
    case 'grpc': {
      stream.grpcSettings = {
        serviceName: params.get('serviceName') ?? path ?? '',
        multiMode: params.get('mode') === 'multi',
      }
      break
    }
    case 'http': {
      stream.httpSettings = {
        host: host ? host.split(',').map((h) => h.trim()) : undefined,
        path: path ?? '/',
      }
      break
    }
    case 'xhttp': {
      // XHTTP یک transport است (نه یک scheme). فقط فیلدهای شناخته‌شده را می‌فرستیم و
      // `extra` را به‌کل حذف می‌کنیم چون مقادیرش در لینک‌های ساب اغلب نامعتبر است و
      // باعث می‌شود Xray کانفیگ را رد کند.
      stream.xhttpSettings = {
        host: host ?? undefined,
        path: path ?? '/',
        mode: params.get('mode') ?? undefined,
      }
      break
    }
    case 'quic': {
      stream.quicSettings = {
        security: params.get('quicSecurity') ?? 'none',
        key: params.get('key') ?? '',
        header: { type: params.get('headerType') ?? 'none' },
      }
      break
    }
    case 'kcp': {
      stream.kcpSettings = {
        header: { type: params.get('headerType') ?? 'none' },
        seed: params.get('seed') ?? undefined,
      }
      break
    }
    case 'tcp': {
      if (headerType === 'http') {
        stream.tcpSettings = {
          header: {
            type: 'http',
            request: {
              path: path ? [path] : ['/'],
              headers: host ? { Host: host.split(',').map((h) => h.trim()) } : undefined,
            },
          },
        }
      }
      break
    }
  }

  if (security === 'tls') {
    stream.security = 'tls'
    stream.tlsSettings = {
      serverName: sni,
      allowInsecure: toBool(params.get('allowInsecure') ?? params.get('insecure')) ?? false,
      alpn: alpn ? alpn.split(',').map((a) => a.trim()) : undefined,
      fingerprint,
    }
  } else if (security === 'reality') {
    stream.security = 'reality'
    stream.realitySettings = {
      serverName: sni,
      fingerprint: fingerprint ?? 'chrome',
      publicKey: params.get('pbk') ?? '',
      shortId: params.get('sid') ?? '',
      spiderX: params.get('spx') ?? '',
      alpn: alpn ? alpn.split(',').map((a) => a.trim()) : undefined,
    }
  } else {
    stream.security = 'none'
  }

  return prune(stream)
}

/** استخراج host/port با پشتیبانی از IPv6 داخل براکت */
function splitHostPort(authority: string): { address: string; port: number } | null {
  let address = ''
  let portText = ''

  if (authority.startsWith('[')) {
    const close = authority.indexOf(']')
    if (close === -1) return null
    address = authority.slice(1, close)
    portText = authority.slice(close + 1).replace(/^:/, '')
  } else {
    const lastColon = authority.lastIndexOf(':')
    if (lastColon === -1) return null
    address = authority.slice(0, lastColon)
    portText = authority.slice(lastColon + 1)
  }

  const port = Number.parseInt(portText, 10)
  if (!address || !Number.isFinite(port) || port <= 0 || port > 65535) return null
  return { address, port }
}

/* ───────────────────────────── پارسر هر پروتکل ───────────────────────────── */

interface BuildResult {
  protocol: Protocol
  address: string | null
  port: number | null
  outbound: Omit<XrayOutbound, 'tag'>
}

function buildVless(uri: string, tag: string, label: string | null): BuildResult | null {
  const rest = uri.slice('vless://'.length)
  const [authorityAndQuery] = rest.split('#')
  const [authority, query = ''] = authorityAndQuery.split('?')
  const at = authority.lastIndexOf('@')
  if (at === -1) return null

  const uuid = decodeComponent(authority.slice(0, at))
  const target = splitHostPort(authority.slice(at + 1))
  if (!target || !uuid) return null

  const params = new URLParams(query)
  const flow = params.get('flow') ?? undefined

  return {
    protocol: 'vless',
    address: target.address,
    port: target.port,
    outbound: {
      protocol: 'vless',
      settings: {
        vnext: [
          {
            address: target.address,
            port: target.port,
            users: [{ id: uuid, encryption: params.get('encryption') ?? 'none', flow, level: 0 }],
          },
        ],
      },
      streamSettings: buildStreamSettings(params),
    },
  }
}

interface VmessJson {
  v?: string
  ps?: string
  add?: string
  port?: string | number
  id?: string
  aid?: string | number
  scy?: string
  net?: string
  type?: string
  host?: string
  path?: string
  tls?: string
  sni?: string
  alpn?: string
  fp?: string
}

function buildVmess(uri: string): BuildResult | null {
  const payload = uri.slice('vmess://'.length).split('#')[0]
  let json: VmessJson

  try {
    json = JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as VmessJson
  } catch {
    return null
  }

  const address = json.add
  const port = Number(json.port)
  const id = json.id
  if (!address || !Number.isFinite(port) || !id) return null

  const params = new URLParams()
  const net = (json.net ?? 'tcp').toLowerCase()
  params.set('type', net === 'h2' ? 'http' : net)
  if (json.tls) params.set('security', json.tls.toLowerCase())
  if (json.host) params.set('host', json.host)
  if (json.path) params.set('path', json.path)
  if (json.sni) params.set('sni', json.sni)
  if (json.alpn) params.set('alpn', json.alpn)
  if (json.fp) params.set('fp', json.fp)
  if (json.type) params.set('headerType', json.type)

  return {
    protocol: 'vmess',
    address,
    port,
    outbound: {
      protocol: 'vmess',
      settings: {
        vnext: [
          {
            address,
            port,
            users: [
              {
                id,
                alterId: Number(json.aid ?? 0) || 0,
                security: json.scy ?? 'auto',
                level: 0,
              },
            ],
          },
        ],
      },
      streamSettings: buildStreamSettings(params),
    },
  }
}

function buildTrojan(uri: string): BuildResult | null {
  const rest = uri.slice('trojan://'.length).split('#')[0]
  const [authority, query = ''] = rest.split('?')
  const at = authority.lastIndexOf('@')
  if (at === -1) return null

  const password = decodeComponent(authority.slice(0, at))
  const target = splitHostPort(authority.slice(at + 1))
  if (!target || !password) return null

  const params = new URLParams(query)
  // trojan عملاً همیشه TLS است؛ اگر پنل ذکر نکرده باشد، پیش‌فرض tls می‌گذاریم
  if (!params.has('security')) params.set('security', 'tls')

  return {
    protocol: 'trojan',
    address: target.address,
    port: target.port,
    outbound: {
      protocol: 'trojan',
      settings: {
        servers: [{ address: target.address, port: target.port, password, level: 0 }],
      },
      streamSettings: buildStreamSettings(params),
    },
  }
}

function buildShadowsocks(uri: string): BuildResult | null {
  const rest = uri.slice('ss://'.length).split('#')[0]
  const [body, query = ''] = rest.split('?')

  let method = ''
  let password = ''
  let address = ''
  let port = 0

  if (body.includes('@')) {
    // قالب SIP002: ss://BASE64(method:password)@host:port
    const at = body.lastIndexOf('@')
    const credentials = Buffer.from(body.slice(0, at), 'base64').toString('utf8')
    const colon = credentials.indexOf(':')
    if (colon === -1) return null
    method = credentials.slice(0, colon)
    password = credentials.slice(colon + 1)

    const target = splitHostPort(body.slice(at + 1))
    if (!target) return null
    address = target.address
    port = target.port
  } else {
    // قالب قدیمی: ss://BASE64(method:password@host:port)
    const decoded = Buffer.from(body, 'base64').toString('utf8')
    const at = decoded.lastIndexOf('@')
    if (at === -1) return null
    const credentials = decoded.slice(0, at)
    const colon = credentials.indexOf(':')
    if (colon === -1) return null
    method = credentials.slice(0, colon)
    password = credentials.slice(colon + 1)

    const target = splitHostPort(decoded.slice(at + 1))
    if (!target) return null
    address = target.address
    port = target.port
  }

  if (!method || !address || !port) return null

  const params = new URLParams(query)
  const plugin = params.get('plugin')

  return {
    protocol: 'ss',
    address,
    port,
    outbound: {
      protocol: 'shadowsocks',
      settings: {
        servers: [
          {
            address,
            port,
            method,
            password,
            uot: false,
            level: 0,
            // پلاگین SIP003 فقط اگر Xray از آن پشتیبانی کند
            ...(plugin ? { plugin: decodeComponent(plugin) } : {}),
          },
        ],
      },
    },
  }
}

function buildSocksOrHttp(uri: string, kind: 'socks' | 'http'): BuildResult | null {
  const schemeLength = `${kind}://`.length
  const rest = uri.slice(schemeLength).split('#')[0]
  const [authority, query = ''] = rest.split('?')
  const at = authority.lastIndexOf('@')
  if (at === -1) return null

  let username = ''
  let password = ''
  const credentials = authority.slice(0, at)

  if (credentials.includes(':')) {
    const colon = credentials.indexOf(':')
    username = decodeComponent(credentials.slice(0, colon))
    password = decodeComponent(credentials.slice(colon + 1))
  } else {
    // ممکن است base64 یوزر:پس باشد
    const decoded = Buffer.from(credentials, 'base64').toString('utf8')
    const colon = decoded.indexOf(':')
    if (colon === -1) return null
    username = decoded.slice(0, colon)
    password = decoded.slice(colon + 1)
  }

  const target = splitHostPort(authority.slice(at + 1))
  if (!target || !username) return null

  const params = new URLParams(query)
  const users = [{ user: username, pass: password, level: 0 }]

  return {
    protocol: kind,
    address: target.address,
    port: target.port,
    outbound: {
      protocol: kind,
      settings: { servers: [{ address: target.address, port: target.port, users }] },
      ...(params.get('security') === 'tls'
        ? { streamSettings: { network: 'tcp', security: 'tls' } }
        : {}),
    },
  }
}

/* ───────────────────────────── API عمومی ───────────────────────────── */

/** تبدیل یک URI به کانفیگ قابل تست؛ در صورت پشتیبانی‌نشدن، null */
export function parseUri(uri: string, index = 0): ParsedConfig | null {
  const trimmed = uri.trim()
  if (!trimmed) return null

  const scheme = trimmed.slice(0, trimmed.indexOf('://')).toLowerCase()
  if (!SUPPORTED.has(scheme)) return null

  const label = readFragment(trimmed)
  const tag = `out-${index}`

  let built: BuildResult | null = null
  switch (scheme) {
    case 'vless':
      built = buildVless(trimmed, tag, label)
      break
    case 'vmess':
      built = buildVmess(trimmed)
      break
    case 'trojan':
      built = buildTrojan(trimmed)
      break
    case 'ss':
      built = buildShadowsocks(trimmed)
      break
    case 'socks':
      built = buildSocksOrHttp(trimmed, 'socks')
      break
    case 'http':
      built = buildSocksOrHttp(trimmed, 'http')
      break
  }

  if (!built) return null

  return {
    fingerprint: sha256(stripFragment(trimmed)),
    uri: trimmed,
    protocol: built.protocol,
    address: built.address,
    port: built.port,
    label,
    outbound: { tag, ...built.outbound },
  }
}

/**
 * تجزیه‌ی متن پاسخ لینک ساب.
 * برخی پنل‌ها کل پاسخ را Base64 می‌کنند و برخی متن ساده می‌دهند؛ هر دو پشتیبانی می‌شوند.
 */
export function parseSubscription(body: string): ParsedConfig[] {
  const decoded = decodeSubscriptionBody(body)
  const lines = decoded
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.includes('://'))

  const out: ParsedConfig[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    const parsed = parseUri(line, out.length)
    if (!parsed) continue
    if (seen.has(parsed.fingerprint)) continue
    seen.add(parsed.fingerprint)
    out.push(parsed)
  }

  return out
}

/** اگر متن پاسخ Base64 باشد، دیکد می‌کند؛ وگرنه همان را برمی‌گرداند */
export function decodeSubscriptionBody(body: string): string {
  const trimmed = body.trim()
  if (trimmed.includes('://')) return trimmed

  const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '')
  if (normalized.length === 0 || !/^[A-Za-z0-9+/=]+$/.test(normalized)) return trimmed

  try {
    const decoded = Buffer.from(normalized, 'base64').toString('utf8')
    return decoded.includes('://') ? decoded : trimmed
  } catch {
    return trimmed
  }
}
