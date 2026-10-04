import { tryDecryptSecret } from '@/lib/crypto/secret'
import { getDb } from '@/lib/db'
import { reconcileConfigs, updateServer, type ReconcileResult } from '@/lib/db/queries'
import type { Server } from '@/lib/types'

import { fetchSubscription } from './fetch'
import { parseSubscription } from './parse'

export interface ReconcileServerResult extends ReconcileResult {
  /** تعداد کانفیگ‌های استخراج‌شده از ساب */
  parsed: number
  /** پیام خطا در صورت شکست (ساب در دسترس نبود، دیکد نشد، ...) */
  error: string | null
}

/**
 * دریافت تازه‌ی لینک ساب یک سرور و همگام‌سازی کانفیگ‌هایش.
 *
 * مراحل:
 *   ۱. رمزگشایی `sub_url` (AES-256-GCM)
 *   ۲. دریافت بدنه‌ی ساب با UA مخصوص v2rayNG و تلاش مجدد
 *   ۳. پارس بدنه → لیست کانفیگ + outbound
 *   ۴. همگام‌سازی با دیتابیس (افزودن/فعال‌سازی/غیرفعال‌سازی)
 *
 * خطاها در `servers.last_fetch_error` ثبت می‌شوند تا در UI نشان داده شوند.
 */
export async function reconcileServer(
  serverId: number,
  options: { timeoutMs?: number } = {},
): Promise<ReconcileServerResult> {
  const db = getDb()
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as
    | Server
    | undefined

  if (!server) {
    return { added: 0, reactivated: 0, disabled: 0, unchanged: 0, parsed: 0, error: 'سرور پیدا نشد.' }
  }

  const subUrl = tryDecryptSecret(server.sub_url)
  if (!subUrl) {
    const error = 'رمزگشایی لینک ساب ناموفق بود (کلید رمزنگاری نامعتبر است).'
    updateServer(serverId, { last_fetch_error: error })
    return { added: 0, reactivated: 0, disabled: 0, unchanged: 0, parsed: 0, error }
  }

  let parsed
  try {
    const response = await fetchSubscription(subUrl, { timeoutMs: options.timeoutMs })
    if (!response.ok || response.body === null) {
      const error = response.error ?? 'دریافت لینک ساب ناموفق بود.'
      updateServer(serverId, { last_fetch_at: Date.now(), last_fetch_error: error })
      return { added: 0, reactivated: 0, disabled: 0, unchanged: 0, parsed: 0, error }
    }
    parsed = parseSubscription(response.body)
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : 'دریافت لینک ساب ناموفق بود.'
    updateServer(serverId, { last_fetch_at: Date.now(), last_fetch_error: error })
    return { added: 0, reactivated: 0, disabled: 0, unchanged: 0, parsed: 0, error }
  }

  if (parsed.length === 0) {
    const error = 'هیچ کانفیگ معتبری در لینک ساب پیدا نشد.'
    updateServer(serverId, { last_fetch_at: Date.now(), last_fetch_error: error })
    return { added: 0, reactivated: 0, disabled: 0, unchanged: 0, parsed: 0, error }
  }

  const result = reconcileConfigs(
    serverId,
    parsed.map((item) => ({
      fingerprint: item.fingerprint,
      uri: item.uri,
      protocol: item.protocol,
      address: item.address,
      port: item.port,
      label: item.label,
    })),
  )

  updateServer(serverId, { last_fetch_at: Date.now(), last_fetch_error: null })

  return { ...result, parsed: parsed.length, error: null }
}
