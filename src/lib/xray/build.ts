/**
 * ساخت کانفیگ JSON برای اجرای دسته‌جمعی Xray.
 *
 * ایده: یک پروسه‌ی Xray با N inbound محلی (SOCKS5) و N outbound؛
 * هر inbound با یک قانون routing به outbound متناظرش وصل می‌شود.
 * این‌طور همه‌ی کانفیگ‌ها با یک بار اجرای Xray تست می‌شوند.
 */
import type { XrayOutbound } from '@/lib/types'

export interface XrayConfig {
  log: { loglevel: string }
  inbounds: unknown[]
  outbounds: XrayOutbound[]
  routing: { domainStrategy: string; rules: unknown[] }
  dns?: {
    servers: Array<{
      address: string
      port: number
      domains?: string[]
    }>
  }
}

export interface BatchConfigResult {
  config: XrayConfig
  /** پورت SOCKS5 هر کانفیگ، به همان ترتیب ورودی */
  ports: number[]
}

export function buildBatchConfig(outbounds: XrayOutbound[], portBase: number): BatchConfigResult {
  const ports = outbounds.map((_, index) => portBase + index)

  const inbounds = outbounds.map((_, index) => ({
    tag: `in-${index}`,
    listen: '127.0.0.1',
    port: ports[index],
    protocol: 'socks',
    settings: { auth: 'noauth', udp: false },
    sniffing: { enabled: false },
  }))

  const outs = outbounds.map((outbound, index) => ({ ...outbound, tag: `out-${index}` }))

  const rules = outbounds.map((_, index) => ({
    type: 'field',
    inboundTag: [`in-${index}`],
    outboundTag: `out-${index}`,
  }))

  return {
    config: {
      log: { loglevel: 'warning' },
      inbounds,
      outbounds: outs,
      routing: {
        domainStrategy: 'IPIfNonexistent',
        rules
      },
      dns: {
        servers: [
          {
            address: '8.8.8.8',
            port: 53,
          },
          {
            address: '1.1.1.1',
            port: 53,
          },
        ],
      },
    },
    ports,
  }
}
