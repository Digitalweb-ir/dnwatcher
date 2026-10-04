/**
 * API جزئیات یک سرور + اکشن‌های مخصوص (چک فوری، تازه‌سازی ساب).
 */
import { NextRequest, NextResponse } from 'next/server'

import { getServer, listEnabledConfigsByServer } from '@/lib/db/queries'
import { checkServer } from '@/lib/service/check'
import { reconcileServer } from '@/lib/sub/reconcile'
import type { Server } from '@/lib/types'
import { isAuthedRequest } from '@/lib/auth/guard'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const authed = await isAuthedRequest(request)
  if (!authed) {
    return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })
  }

  const { id } = await params
  const server = getServer(Number(id))
  if (!server) {
    return NextResponse.json({ error: 'سرور یافت نشد' }, { status: 404 })
  }
  return NextResponse.json({ server })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const authed = await isAuthedRequest(request)
  if (!authed) {
    return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })
  }

  const { id } = await params
  const serverId = Number(id)
  const body = await request.json()
  const { action } = body as { action: 'check' | 'refresh' }

  if (action === 'refresh') {
    const result = await reconcileServer(serverId)
    const server = getServer(serverId)
    return NextResponse.json({ server, reconcile: result })
  }

  if (action === 'check') {
    const result = await checkServer(serverId, { refresh: false })
    const server = getServer(serverId)
    return NextResponse.json({ server, result })
  }

  return NextResponse.json({ error: 'اکشن نامعتبر' }, { status: 400 })
}