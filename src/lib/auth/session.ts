/**
 * سیستم مدیریت نشست (Session Management)
 *
 * استراتژی: Stateless JWT در HttpOnly Cookie
 * امنیت: امضا شده با HS256 و کلید مخفی سرور
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

const SESSION_COOKIE = 'dnw_session'
const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback-secret-must-be-32-chars-long-12345'
const secret = new TextEncoder().encode(SESSION_SECRET)

export interface SessionPayload extends JWTPayload {
  userId: string
  role: 'admin'
}

/**
 * ایجاد توکن JWT امضا شده
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d') // اعتبار ۳۰ روزه
    .sign(secret)
}

/**
 * بررسی صحت توکن و بازگرداندن دیتای کاربر
 */
export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

// Alias for backward compatibility with guard.ts and other files
export { verifySessionToken as verifySession }

/**
 * تعیین مقدار secure برای کوکی
 * - اگر FORCE_SECURE_COOKIE=true باشد همیشه secure
 * - اگر NEXT_PUBLIC_USE_HTTPS=true باشد secure
 * - در غیر این صورت در production هم secure نیست (برای HTTP locale/dev)
 */
function getCookieSecure(): boolean {
  if (process.env.FORCE_SECURE_COOKIE === 'true') return true
  if (process.env.NEXT_PUBLIC_USE_HTTPS === 'true') return true
  // در development/dev container معمولاً HTTP است
  return false
}

export const COOKIE_CONFIG = {
  name: SESSION_COOKIE,
  httpOnly: true,
  secure: getCookieSecure(),
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // ۳۰ روز
}

export { SESSION_COOKIE }
