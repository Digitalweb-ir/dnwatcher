const USER_AGENT = 'v2rayNG/1.8.5'

export interface FetchResult {
  ok: boolean
  body: string | null
  error: string | null
  status: number | null
}

/**
 * دریافت لینک ساب با هدر مرورگر v2rayNG.
 * بسیاری از پنل‌ها (از جمله Marzban) بدون این هدر پاسخ HTML یا ۴۰۳ می‌دهند.
 */
export async function fetchSubscription(
  url: string,
  options: { timeoutMs?: number; retries?: number } = {},
): Promise<FetchResult> {
  const timeoutMs = options.timeoutMs ?? 15_000
  const retries = options.retries ?? 2

  let lastError = 'خطای نامشخص'

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: '*/*',
          'Accept-Encoding': 'identity',
        },
        signal: controller.signal,
        cache: 'no-store',
        redirect: 'follow',
      })

      if (!response.ok) {
        lastError = `پاسخ ${response.status} از سرور ساب`
        // خطاهای ۴xx با تلاش مجدد درست نمی‌شوند
        if (response.status >= 400 && response.status < 500) {
          return { ok: false, body: null, error: lastError, status: response.status }
        }
        continue
      }

      const body = await response.text()
      if (body.trim().length === 0) {
        lastError = 'پاسخ لینک ساب خالی بود'
        continue
      }

      return { ok: true, body, error: null, status: response.status }
    } catch (error) {
      const name = (error as { name?: string }).name
      if (name === 'AbortError' || name === 'TimeoutError') {
        lastError = 'مهلت درخواست لینک ساب به پایان رسید'
      } else {
        lastError = error instanceof Error ? error.message : String(error)
      }
    } finally {
      clearTimeout(timer)
    }

    if (attempt < retries) {
      // backoff نمایی: ۵۰۰ms، ۱s
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
    }
  }

  return { ok: false, body: null, error: lastError, status: null }
}
