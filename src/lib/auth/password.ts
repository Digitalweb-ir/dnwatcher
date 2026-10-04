import crypto from 'node:crypto'

/**
 * هش کردن رمز عبور با scrypt — الگوریتمی که در هسته‌ی Node موجود است و
 * نیازی به وابستگی بومی (native) ندارد؛ برای Docker هم دردسری ایجاد نمی‌کند.
 *
 * قالب ذخیره‌سازی: `scrypt$N$r$p$salt_b64url$hash_b64url`
 * پارامترها عمداً کنار هش ذخیره می‌شوند تا اگر روزی سخت‌گیرترشان کردیم،
 * هش‌های قدیمی همچنان قابل بررسی بمانند.
 */
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEYLEN = 32
const SALT_BYTES = 16

/** نسخه‌ی همگام — برای مقداردهی اولیه در زمان باز شدن دیتابیس */
export function hashPasswordSync(password: string): string {
  const salt = crypto.randomBytes(SALT_BYTES)
  const derived = crypto.scryptSync(password, salt, KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${derived.toString('base64url')}`
}

/** بررسی رمز در برابر هش ذخیره‌شده — مقایسه‌ی زمان‌ثابت */
export function verifyPasswordSync(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const [, nStr, rStr, pStr, saltB64, hashB64] = parts
  const salt = Buffer.from(saltB64, 'base64url')
  const expected = Buffer.from(hashB64, 'base64url')
  if (expected.length === 0) return false

  let derived: Buffer
  try {
    derived = crypto.scryptSync(password, salt, expected.length, {
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
    })
  } catch {
    return false
  }

  if (derived.length !== expected.length) return false
  return crypto.timingSafeEqual(derived, expected)
}

/** نسخه‌ی async — همان الگوریتم، بدون قفل کردن حلقه‌ی رویداد */
export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SALT_BYTES)
    crypto.scrypt(
      password,
      salt,
      KEYLEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (error, derived) => {
        if (error) return reject(error)
        resolve(
          `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${derived.toString('base64url')}`,
        )
      },
    )
  })
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  return Promise.resolve(verifyPasswordSync(password, stored))
}
