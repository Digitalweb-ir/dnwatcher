/**
 * API خلاصه داشبورد — داده‌ی اولیه برای رندر سمت سرور / hydration.
 */
import { NextResponse } from 'next/server'

import { dashboardSummary } from '@/lib/db/queries'

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ summary: dashboardSummary() })
}