/**
 * پیدا کردن و مدیریت باینری Xray.
 *
 * ترتیب جستوجو:
 *   ۱. متغیر محیطی `XRAY_BINARY` (مسیر کامل)
 *   ۲. `./bin/xray` در ریشه‌ی پروژه (استقرار Docker)
 *   ۳. `xray` روی PATH سیستم
 */
import { accessSync, constants } from 'node:fs'
import { join } from 'node:path'

export function findXrayBinary(): string | null {
  const candidates: string[] = []

  if (process.env.XRAY_BINARY) candidates.push(process.env.XRAY_BINARY)
  candidates.push(join(process.cwd(), 'bin', 'xray'))
  candidates.push(join(process.cwd(), 'xray', 'xray'))
  candidates.push('/usr/bin/xray')
  candidates.push('/usr/local/bin/xray')
  candidates.push('xray')

  for (const candidate of candidates) {
    if (candidate === 'xray') {
      // جست‌وجو روی PATH
      const path = process.env.PATH ?? ''
      for (const dir of path.split(':')) {
        const full = join(dir, 'xray')
        if (isExecutable(full)) return full
      }
      continue
    }
    if (isExecutable(candidate)) return candidate
  }

  return null
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** آیا Xray در دسترس است؟ برای نمایش وضعیت در UI */
export function hasXray(): boolean {
  return findXrayBinary() !== null
}
