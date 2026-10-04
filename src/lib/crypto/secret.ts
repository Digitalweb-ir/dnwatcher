import crypto from 'node:crypto'

/**
 * رمزنگاری متقارن لینک‌های ساب با AES-256-GCM.
 *
 * قالب خروجی: `v1.<iv_b64url>.<tag_b64url>.<ciphertext_b64url>`
 * کلید از `ENCRYPTION_KEY` (۶۴ کاراکتر hex = ۳۲ بایت) خوانده می‌شود.
 */

const PREFIX = 'v1'
const ALGO = 'aes-256-gcm'
const IV_BYTES = 12

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey

  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'متغیر محیطی ENCRYPTION_KEY تنظیم نشده است. یک مقدار ۶۴ کاراکتری hex بسازید: openssl rand -hex 32',
    )
  }

  // اجازه می‌دهیم کلید به‌صورت base64 یا hex داده شود
  let key: Buffer
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex')
  } else {
    key = Buffer.from(raw, 'base64')
  }

  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY باید ۳۲ بایت باشد (۶۴ کاراکتر hex یا base64 معادل آن).')
  }

  cachedKey = key
  return key
}

/** آیا کلید رمزنگاری در دسترس است؟ (برای پیام‌های راهنمای UI) */
export function hasEncryptionKey(): boolean {
  try {
    getKey()
    return true
  } catch {
    return false
  }
}

export function encryptSecret(plain: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(
    '.',
  )
}

export function decryptSecret(payload: string): string {
  const parts = payload.split('.')
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error('قالب داده‌ی رمزنگاری‌شده نامعتبر است.')
  }

  const [, ivPart, tagPart, dataPart] = parts
  const key = getKey()
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivPart, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

/** تلاش برای رمزگشایی؛ در صورت خطا مقدار null برمی‌گرداند (برای مسیرهای نمایشی) */
export function tryDecryptSecret(payload: string): string | null {
  try {
    return decryptSecret(payload)
  } catch {
    return null
  }
}

/** پوشاندن بخش حساس لینک ساب برای نمایش در UI */
export function maskSubUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean)
    if (segments.length > 0) {
      const last = segments[segments.length - 1]
      segments[segments.length - 1] = last.length > 6 ? `${last.slice(0, 3)}•••${last.slice(-3)}` : '•••'
    }
    parsed.pathname = `/${segments.join('/')}`
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return '••••••'
  }
}
