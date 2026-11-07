import { Metadata } from 'next'
import { Suspense } from 'react'
import { getDb } from '@/lib/db'
import { getSettings } from '@/lib/db/settings'
import { requireSession } from '@/lib/auth/guard'
import SettingsClient from './settings-client'

export const metadata: Metadata = { title: 'تنظیمات' }

export default async function SettingsPage() {
  await requireSession()
  const settings = getSettings(getDb())
  return (
    <Suspense fallback={<div className="flex h-[400px] items-center justify-center">بارگذاری…</div>}>
      <SettingsClient initialSettings={settings} />
    </Suspense>
  )
}