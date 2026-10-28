/**
 * تشخیص وضعیت ورود در کلاینت — از طریق /api/auth/me، نه متغیر محیطی.
 *
 * کوکی نشست httpOnly است و جاوااسکریپت مرورگر آن را نمی‌بیند؛ پس تنها راه
 * مطمئن، پرسیدن از سرور است که امضای کوکی را بررسی می‌کند.
 */

export interface AuthState {
  authenticated: boolean
  loading: boolean
}

export async function fetchAuthState(): Promise<boolean> {
  const response = await fetch('/api/auth/me', { cache: 'no-store' })
  if (!response.ok) return false
  const data = (await response.json()) as { authenticated?: boolean }
  return data.authenticated === true
}
