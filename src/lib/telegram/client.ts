import { SocksProxyAgent } from 'socks-proxy-agent'
import { getSettings } from '@/lib/db/settings'
import { getDb } from '@/lib/db'

/**
 * Telegram notification client with SOCKS5 proxy support for Iran.
 * Uses standard fetch with a SOCKS proxy agent.
 */

export interface TelegramMessage {
  chat_id: string | number
  text: string
  parse_mode?: 'HTML' | 'Markdown'
  disable_web_page_preview?: boolean
}

export interface TelegramResponse {
  ok: boolean
  result?: any
  error_code?: number
  description?: string
}

/** Get bot token from settings or env */
function getBotToken(): string | null {
  const db = getDb()
  const settings = getSettings(db)
  return settings.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN || null
}

/** Get admin IDs from settings or env (comma-separated) */
export function getAdminIds(): number[] {
  const db = getDb()
  const settings = getSettings(db)
  const idsStr = settings.telegram_admin_ids || process.env.TELEGRAM_ADMIN_IDS || ''
  return idsStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => !Number.isNaN(n))
}

/** Check if Telegram notifications are enabled */
export function isTelegramEnabled(): boolean {
  const db = getDb()
  const settings = getSettings(db)
  return settings.telegram_enabled === 1 && !!getBotToken()
}

/** Get proxy configuration */
function getProxyConfig(): { address: string; port: number } | null {
  const db = getDb()
  const settings = getSettings(db)

  // If explicitly disabled (empty address), return null
  if (!settings.telegram_proxy_address) return null

  return {
    address: settings.telegram_proxy_address,
    port: settings.telegram_proxy_port,
  }
}

/** Build fetch options with proxy if configured */
function buildFetchOptions(body: string): RequestInit {
  const proxy = getProxyConfig()
  const agent = proxy ? new SocksProxyAgent(`socks5://${proxy.address}:${proxy.port}`) : undefined

  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    // @ts-expect-error - agent is a valid option for Node.js fetch
    agent,
  }
}

/**
 * Send a message to a single chat ID
 */
export async function sendTelegramMessage(message: TelegramMessage): Promise<TelegramResponse> {
  const token = getBotToken()
  if (!token) {
    return { ok: false, error_code: 0, description: 'Bot token not configured' }
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`
  const options = buildFetchOptions(JSON.stringify(message))

  try {
    const response = await fetch(url, options)
    return (await response.json()) as TelegramResponse
  } catch (error) {
    console.error('[Telegram] Send failed:', error)
    return { ok: false, error_code: 0, description: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Send a message to all configured admin IDs
 */
export async function sendToAdmins(text: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<TelegramResponse[]> {
  if (!isTelegramEnabled()) {
    console.log('[Telegram] Not enabled or token missing, skipping')
    return []
  }

  const adminIds = getAdminIds()
  if (adminIds.length === 0) {
    console.log('[Telegram] No admin IDs configured')
    return []
  }

  const results: TelegramResponse[] = []
  for (const chatId of adminIds) {
    const result = await sendTelegramMessage({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    })
    results.push(result)

    if (!result.ok) {
      console.error(`[Telegram] Failed to send to ${chatId}:`, result.description)
    }
  }

  return results
}

/**
 * Format outage log for Telegram
 */
export function formatOutageLog(params: {
  event: 'config_down' | 'config_up' | 'ssh_recovery'
  configId: number
  serverId: number
  serverName?: string
  address: string | null
  port: number | null
  resolvedIps?: string[]
  sshServer?: { name: string; ip: string }
  command?: string
  result?: { code: number; stdout: string; stderr: string } | null
  timestamp: number
}): string {
  const { event, configId, serverId, serverName, address, port, resolvedIps, sshServer, command, result, timestamp } = params
  const date = new Date(timestamp).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })

  let emoji = '⚠️'
  let title = 'گزارش رویداد'

  switch (event) {
    case 'config_down':
      emoji = '🔴'
      title = 'کانفیگ قطع شد'
      break
    case 'config_up':
      emoji = '🟢'
      title = 'کانفیگ برقرار شد'
      break
    case 'ssh_recovery':
      emoji = '🔧'
      title = 'تلاش برای ریکاوری SSH'
      break
  }

  let text = `${emoji} <b>${title}</b>\n\n`
  text += `📅 <b>زمان:</b> ${date}\n`
  text += `🆔 <b>Config ID:</b> ${configId}\n`
  text += `🖥 <b>Server:</b> ${serverName ?? serverId}\n`
  text += `🌐 <b>آدرس:</b> ${address ?? 'نامشخص'}:${port ?? 'نامشخص'}\n`

  if (event === 'config_down' || event === 'ssh_recovery') {
    if (resolvedIps && resolvedIps.length > 0) {
      text += `🔍 <b>IP‌های حل‌شده:</b> ${resolvedIps.join(', ')}\n`
    }
  }

  if (event === 'ssh_recovery' && sshServer) {
    text += `🔐 <b>SSH سرور:</b> ${sshServer.name} (${sshServer.ip})\n`
    text += `⌨️ <b>دستور:</b> <code>${command ?? 'backpack -restart-all'}</code>\n`

    if (result) {
      const statusEmoji = result.code === 0 ? '✅' : '❌'
      text += `${statusEmoji} <b>نتیجه:</b> کد خروج ${result.code}\n`
      if (result.stdout) {
        const out = result.stdout.length > 500 ? result.stdout.slice(0, 500) + '...' : result.stdout
        text += `📤 <b>خروجی:</b> <code>${out}</code>\n`
      }
      if (result.stderr) {
        const err = result.stderr.length > 500 ? result.stderr.slice(0, 500) + '...' : result.stderr
        text += `📥 <b>خطا:</b> <code>${err}</code>\n`
      }
    } else {
      text += `❌ <b>نتیجه:</b> اتصال SSH ناموفق\n`
    }
  }

  return text
}