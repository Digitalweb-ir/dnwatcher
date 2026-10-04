/**
 * API تنظیمات — خواندن و نوشتن.
 */
import { NextRequest, NextResponse } from 'next/server'

import { getDb } from '@/lib/db'
import { DEFAULT_SETTINGS, getSettings, updateSettings, SettingKey } from '@/lib/db/settings'
import { isAuthedRequest } from '@/lib/auth/guard'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authed = await isAuthedRequest(request)
  if (!authed) {
    return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })
  }
  const settings = getSettings(getDb())
  return NextResponse.json({ settings, defaults: DEFAULT_SETTINGS })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authed = await isAuthedRequest(request)
  if (!authed) {
    return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })
  }

  const body = await request.json()
  const patch: Partial<Record<SettingKey, string | number>> = {}

  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
    if (body[key] !== undefined) {
      patch[key] = body[key]
    }
  }

  updateSettings(getDb(), patch)
  const settings = getSettings(getDb())
  return NextResponse.json({ settings })
}