/**
 * API اجرای یک دور بررسی (trigger دستی).
 * POST /api/check  { force?: boolean }
 */
import { NextRequest, NextResponse } from 'next/server'
import { runCheckCycle, getCycleState } from '@/lib/service/check'
import { isAuthedRequest } from '@/lib/auth/guard'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authed = await isAuthedRequest(request)
  if (!authed) {
    return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })
  }
  return NextResponse.json({ state: getCycleState() })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authed = await isAuthedRequest(request)
  if (!authed) {
    return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { force } = body as { force?: boolean }

  const state = await runCheckCycle({ force })
  return NextResponse.json({ state })
}