const faNum = new Intl.NumberFormat('fa-IR')

export function toFa(input: number | string): string {
  if (typeof input === 'number') return faNum.format(input)
  return input.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}

const dateFmt = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

const timeFmt = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const dateTimeFmt = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export const faDate = (ts: number | Date) => dateFmt.format(ts)
export const faTime = (ts: number | Date) => timeFmt.format(ts)
export const faDateTime = (ts: number | Date) => dateTimeFmt.format(ts)

export function faDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${toFa(d)} روز و ${toFa(h)} ساعت`
  if (h > 0) return `${toFa(h)} ساعت و ${toFa(m)} دقیقه`
  if (m > 0) return `${toFa(m)} دقیقه`
  return `${toFa(Math.floor(seconds))} ثانیه`
}

export function faRelative(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'همین حالا'
  if (diff < 3600) return `${toFa(Math.floor(diff / 60))} دقیقه پیش`
  if (diff < 86400) return `${toFa(Math.floor(diff / 3600))} ساعت پیش`
  return `${toFa(Math.floor(diff / 86400))} روز پیش`
}

export const faPercent = (v: number, digits = 2) =>
  `${new Intl.NumberFormat('fa-IR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v)}٪`

export const faMs = (ms: number | null | undefined) =>
  ms == null ? '—' : `${faNum.format(Math.round(ms))} ms`
