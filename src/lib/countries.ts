/**
 * فهرست کشورها برای انتخاب هنگام افزودن سرور.
 *
 * کد ISO دوحرفی ذخیره می‌شود و پرچم از روی همان ساخته می‌شود؛
 * این‌طور اگر بعداً نام فارسی تغییر کند، داده دست‌نخورده می‌ماند.
 */
export interface Country {
  code: string
  name: string
}

/** کشورهای رایج برای سرورهای Xray — قابل گسترش */
export const COUNTRIES: Country[] = [
  { code: 'IR', name: 'ایران' },
  { code: 'DE', name: 'آلمان' },
  { code: 'NL', name: 'هلند' },
  { code: 'TR', name: 'ترکیه' },
  { code: 'AE', name: 'امارات' },
  { code: 'FI', name: 'فینلاند' },
  { code: 'SE', name: 'سوئد' },
  { code: 'FR', name: 'فرانسه' },
  { code: 'GB', name: 'بریتانیا' },
  { code: 'US', name: 'آمریکا' },
  { code: 'CA', name: 'کانادا' },
  { code: 'PL', name: 'لهستان' },
  { code: 'RU', name: 'روسیه' },
  { code: 'LT', name: 'لیتوانی' },
  { code: 'LV', name: 'لتونی' },
  { code: 'EE', name: 'استونی' },
  { code: 'AT', name: 'اتریش' },
  { code: 'CH', name: 'سوئیس' },
  { code: 'RO', name: 'رومانی' },
  { code: 'CZ', name: 'چک' },
  { code: 'ES', name: 'اسپانیا' },
  { code: 'IT', name: 'ایتالیا' },
  { code: 'JP', name: 'ژاپن' },
  { code: 'SG', name: 'سنگاپور' },
  { code: 'IN', name: 'هند' },
  { code: 'HK', name: 'هنگ‌کنگ' },
  { code: 'KR', name: 'کره جنوبی' },
  { code: 'AU', name: 'استرالیا' },
  { code: 'BR', name: 'برزیل' },
  { code: 'UA', name: 'اوکراین' },
  { code: 'MD', name: 'مولداوی' },
  { code: 'BG', name: 'بلغارستان' },
  { code: 'HU', name: 'مجارستان' },
  { code: 'NO', name: 'نروژ' },
  { code: 'DK', name: 'دانمارک' },
  { code: 'BE', name: 'بلژیک' },
  { code: 'IE', name: 'ایرلند' },
  { code: 'PT', name: 'پرتغال' },
  { code: 'GR', name: 'یونان' },
  { code: 'RS', name: 'صربستان' },
  { code: 'GE', name: 'گرجستان' },
  { code: 'AM', name: 'ارمنستان' },
  { code: 'KZ', name: 'قزاقستان' },
  { code: 'CN', name: 'چین' },
  { code: 'MY', name: 'مالزی' },
  { code: 'TH', name: 'تایلند' },
  { code: 'ID', name: 'اندونزی' },
  { code: 'IL', name: 'اسرائیل' },
  { code: 'SA', name: 'عربستان' },
  { code: 'QA', name: 'قطر' },
  { code: 'KW', name: 'کویت' },
  { code: 'OM', name: 'عمان' },
  { code: 'BH', name: 'بحرین' },
  { code: 'EG', name: 'مصر' },
  { code: 'ZA', name: 'آفریقای جنوبی' },
]

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c.name]))

/** پرچم ایموجی از کد دوحرفی ISO */
export function flagOf(code: string | null | undefined): string {
  if (!code || code.length !== 2) return ''
  const upper = code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(upper)) return ''
  return String.fromCodePoint(
    ...[...upper].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  )
}

/** نام فارسی کشور؛ اگر کد ناشناس بود، خود کد برگردانده می‌شود */
export function countryName(code: string | null | undefined): string {
  if (!code) return 'نامشخص'
  return BY_CODE.get(code.toUpperCase()) ?? code
}
