import { getDb } from '@/lib/db'
import { getSettings } from '@/lib/db/settings'
import { getBotToken, getAdminIds, isTelegramEnabled, sendTelegramMessage, formatOutageLog } from './client'

// Re-export for external use
export { isTelegramEnabled }

/**
 * Telegram Bot Core — Extensible architecture for future commands
 * Currently: Log receiver only
 * Future: Commands, callbacks, inline queries, etc.
 */

export interface BotContext {
  chatId: number
  userId: number
  isAdmin: boolean
  messageId?: number
  text?: string
  data?: string // for callback queries
}

export type CommandHandler = (ctx: BotContext) => Promise<void>

export interface BotCommand {
  command: string
  description: string
  adminOnly: boolean
  handler: CommandHandler
}

export interface BotCallback {
  pattern: string | RegExp
  adminOnly: boolean
  handler: (ctx: BotContext) => Promise<void>
}

/** Registry for commands and callbacks — extensible */
class BotRegistry {
  private commands = new Map<string, BotCommand>()
  private callbacks: BotCallback[] = []

  registerCommand(cmd: BotCommand) {
    this.commands.set(cmd.command, cmd)
  }

  registerCallback(cb: BotCallback) {
    this.callbacks.push(cb)
  }

  getCommand(name: string): BotCommand | undefined {
    return this.commands.get(name)
  }

  findCallback(data: string): BotCallback | undefined {
    return this.callbacks.find((cb) =>
      typeof cb.pattern === 'string' ? cb.pattern === data : cb.pattern.test(data)
    )
  }

  getAllCommands(): BotCommand[] {
    return Array.from(this.commands.values())
  }
}

export const botRegistry = new BotRegistry()

/** Core bot processor — handles updates */
export async function processUpdate(update: {
  message?: { chat: { id: number }; from: { id: number }; text?: string; message_id: number }
  callback_query?: { message: { chat: { id: number } }; from: { id: number }; data: string; id: string }
}): Promise<void> {
  if (!isTelegramEnabled()) return

  const adminIds = getAdminIds()
  const isAdmin = (userId: number) => adminIds.includes(userId)

  // Handle message
  if (update.message) {
    const { chat, from, text, message_id } = update.message
    const ctx: BotContext = {
      chatId: chat.id,
      userId: from.id,
      isAdmin: isAdmin(from.id),
      messageId: message_id,
      text: text?.trim(),
    }

    if (ctx.text?.startsWith('/')) {
      const [cmdName] = ctx.text.split(/\s+/)
      const cmd = botRegistry.getCommand(cmdName)
      if (cmd) {
        if (cmd.adminOnly && !ctx.isAdmin) {
          await sendTelegramMessage({
            chat_id: ctx.chatId,
            text: '⛔ این دستور فقط برای ادمین‌هاست.',
          })
          return
        }
        try {
          await cmd.handler(ctx)
        } catch (e) {
          console.error(`[Bot] Command ${cmdName} error:`, e)
          await sendTelegramMessage({
            chat_id: ctx.chatId,
            text: '❌ خطا در اجرای دستور.',
          })
        }
      }
    }
  }

  // Handle callback query
  if (update.callback_query) {
    const { message, from, data } = update.callback_query
    const ctx: BotContext = {
      chatId: message.chat.id,
      userId: from.id,
      isAdmin: isAdmin(from.id),
      data,
    }

    const cb = botRegistry.findCallback(data)
    if (cb) {
      if (cb.adminOnly && !ctx.isAdmin) {
        await sendTelegramMessage({
          chat_id: ctx.chatId,
          text: '⛔ دسترسی ادمین مورد نیاز.',
        })
        return
      }
      try {
        await cb.handler(ctx)
      } catch (e) {
        console.error(`[Bot] Callback ${data} error:`, e)
      }
    }
  }
}

/** Send startup notification to all admins */
export async function notifyStartup(): Promise<void> {
  if (!isTelegramEnabled()) return

  const adminIds = getAdminIds()
  if (adminIds.length === 0) return

  const db = getDb()
  const settings = getSettings(db)

  const text = `🤖 <b>Network Watcher Bot Started</b>\n\n` +
    `✅ Bot is online and ready to receive logs\n\n` +
    `📋 <b>Config:</b>\n` +
    `• Alerts: ${settings.telegram_enabled === 1 ? 'Enabled' : 'Disabled'}\n` +
    `• Proxy: ${settings.telegram_proxy_address}:${settings.telegram_proxy_port}\n` +
    `• Recovery cmd: <code>${settings.ssh_recovery_command || 'backpack -restart-all'}</code>\n` +
    `• Threshold: ${settings.fail_threshold} failures\n` +
    `• Admins: ${adminIds.length}`

  for (const chatId of adminIds) {
    await sendTelegramMessage({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    })
  }
}

/** Send outage log (called from webhook) */
export async function sendOutageLog(params: Parameters<typeof formatOutageLog>[0]): Promise<void> {
  if (!isTelegramEnabled()) return

  const text = formatOutageLog(params)
  await sendToAdmins(text)
}

/** Helper to send to all admins */
async function sendToAdmins(text: string): Promise<void> {
  const adminIds = getAdminIds()
  for (const chatId of adminIds) {
    await sendTelegramMessage({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    })
  }
}

/** Register built-in commands (extensible — add more in separate files) */
export function registerBuiltinCommands(): void {
  // /start command
  botRegistry.registerCommand({
    command: '/start',
    description: 'Welcome message and system status',
    adminOnly: false,
    handler: async (ctx) => {
      const db = getDb()
      const settings = getSettings(db)

      let text = `🤖 <b>Network Watcher</b>\n\n`
      text += `✅ <b>Bot connected successfully</b>\n\n`
      text += `📋 <b>System Status:</b>\n`
      text += `• Alerts: ${settings.telegram_enabled === 1 ? '✅ Enabled' : '❌ Disabled'}\n`
      text += `• Proxy: ${settings.telegram_proxy_address}:${settings.telegram_proxy_port}\n`
      text += `• Recovery: <code>${settings.ssh_recovery_command || 'backpack -restart-all'}</code>\n`
      text += `• Threshold: ${settings.fail_threshold} failures\n\n`

      if (ctx.isAdmin) {
        text += `👑 <b>Admin access granted</b>\n`
        text += `Use <code>/help</code> to see available commands.`
      } else {
        text += `ℹ️ You'll receive outage/recovery notifications here.`
      }

      await sendTelegramMessage({
        chat_id: ctx.chatId,
        text,
        parse_mode: 'HTML',
      })
    },
  })

  // /help command
  botRegistry.registerCommand({
    command: '/help',
    description: 'Show help message',
    adminOnly: false,
    handler: async (ctx) => {
      const cmds = botRegistry.getAllCommands().filter((c) => !c.adminOnly || ctx.isAdmin)
      let text = `📖 <b>Available Commands</b>\n\n`
      for (const cmd of cmds) {
        text += `• <code>${cmd.command}</code> — ${cmd.description}\n`
      }
      await sendTelegramMessage({
        chat_id: ctx.chatId,
        text,
        parse_mode: 'HTML',
      })
    },
  })

  // /status command (admin only)
  botRegistry.registerCommand({
    command: '/status',
    description: 'System status: servers, configs, recent incidents',
    adminOnly: true,
    handler: async (ctx) => {
      await sendStatusMessage(ctx.chatId)
    },
  })

  // /admins command (admin only)
  botRegistry.registerCommand({
    command: '/admins',
    description: 'List configured admin IDs',
    adminOnly: true,
    handler: async (ctx) => {
      const db = getDb()
      const settings = getSettings(db)
      const adminIds = settings.telegram_admin_ids
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean) || []

      let text = `👥 <b>Admin List</b> (${adminIds.length})\n\n`
      if (adminIds.length === 0) {
        text += `No admins configured. Add in Settings → Telegram.`
      } else {
        for (const id of adminIds) {
          text += `• <code>${id}</code>\n`
        }
      }
      await sendTelegramMessage({
        chat_id: ctx.chatId,
        text,
        parse_mode: 'HTML',
      })
    },
  })
}

/** Send detailed system status */
async function sendStatusMessage(chatId: number): Promise<void> {
  const db = getDb()

  try {
    const servers = db.prepare(`
      SELECT s.*,
        COUNT(c.id) as config_count,
        SUM(CASE WHEN c.status = 'up' THEN 1 ELSE 0 END) as up_count,
        SUM(CASE WHEN c.status = 'down' THEN 1 ELSE 0 END) as down_count,
        SUM(CASE WHEN c.status = 'idle' THEN 1 ELSE 0 END) as idle_count
      FROM servers s
      LEFT JOIN configs c ON c.server_id = s.id AND c.enabled = 1
      WHERE s.enabled = 1
      GROUP BY s.id
      ORDER BY s.name
    `).all() as any[]

    const since = Date.now() - 24 * 3600 * 1000
    const incidents = db.prepare(`
      SELECT i.*, c.address, c.port, s.name as server_name
      FROM incidents i
      JOIN configs c ON c.id = i.config_id
      JOIN servers s ON s.id = c.server_id
      WHERE i.started_at >= ?
      ORDER BY i.started_at DESC
      LIMIT 10
    `).all(since) as any[]

    let text = `📊 <b>System Status (24h)</b>\n\n`

    if (servers.length === 0) {
      text += `No active servers.`
    } else {
      for (const s of servers) {
        const emoji = s.down_count > 0 ? '🔴' : (s.up_count > 0 ? '🟢' : '⚪')
        text += `${emoji} <b>${s.name}</b> (${s.country || 'N/A'})\n`
        text += `   Configs: ${s.config_count} | ✅ ${s.up_count} | 🔴 ${s.down_count} | ⚪ ${s.idle_count}\n`
        if (s.last_check_at) {
          const t = new Date(s.last_check_at).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })
          text += `   Last check: ${t}\n`
        }
        text += `\n`
      }
    }

    if (incidents.length > 0) {
      text += `⚠️ <b>Recent Incidents:</b>\n`
      for (const inc of incidents) {
        const status = inc.ended_at ? '✅ Resolved' : '🔴 Ongoing'
        const st = new Date(inc.started_at).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })
        text += `• ${inc.server_name} — ${inc.address}:${inc.port}\n`
        text += `  ${st} | ${status} | ${inc.last_error || 'N/A'}\n`
      }
    }

    await sendTelegramMessage({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    })
  } catch (e) {
    console.error('[Bot] Status error:', e)
    await sendTelegramMessage({
      chat_id: chatId,
      text: '❌ Failed to fetch status.',
    })
  }
}

// Initialize built-in commands
registerBuiltinCommands()