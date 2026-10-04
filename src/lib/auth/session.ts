/**
 * مدیریت نشست (session) با کوکی امضا شده با jose (JWS HS256).
 *
 * کوکی: `dnw_session` — شامل payload امضا شده.
 * تازه‌سازی: هر درخواست مجوز اعتبار را تمدید می‌کند (rolling expiry).
 */

import { SignJWT, jwtVerify } from 'jose'

let cachedSecret: Uint8Array | null = null

function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret

  const raw = process.env.SESSION_SECRET
  if (!raw) {
    throw new Error(
      'متغیر محیطی SESSION_SECRET تنظیم نشده است. یک کلید تصادفی بسازید: openssl rand -base64 32',
    )
  }
  // اجازه base64 یا hex
  let secret: Uint8Array
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    secret = Buffer.from(raw, 'hex')
  } else {
    secret = Buffer.from(raw, 'base64')
  }
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET باید حداقل ۳۲ بایت باشد.')
  }
  cachedSecret = secret
  return secret
}

/** payload نشست */
export interface SessionPayload {
  sub: string
  iat: number
  exp: number
}

/** امضا کردن نشست و برگرداندن رشته‌ی JWS */
export async function signSession(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  const secret = getSecret()
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60 * 24 * 30) // ۳۰ روز
    .sign(secret)
}

/** بررسی و رمزگشایی نشست؛ null اگر نامعتبر/منقضی باشد */
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const secret = getSecret()
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

/** نام کوکی */
export const SESSION_COOKIE = 'dnw_session'

/** گزینه‌های کوکی */
export const COOKIE_OPTIONS = {
  name: SESSION_COOKIE,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // ۳۰ روز
} as const