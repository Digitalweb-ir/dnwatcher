/**
 * توابع احراز هویت که می‌توان در کلاینت هم استفاده کرد
 * (بدون وابستگی به next/headers یا node modules)
 */

/** آیا احراز هویت فعال است؟ (یعنی SESSION_SECRET تنظیم شده) */
export function authEnabled(): boolean {
  return Boolean(process.env.SESSION_SECRET)
}