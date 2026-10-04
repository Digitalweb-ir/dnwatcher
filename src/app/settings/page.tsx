import { Metadata } from 'next'
import { Suspense } from 'react'
import { getDb } from '@/lib/db'
import { getSettings } from '@/lib/db/settings'
import SettingsClient from './settings-client'

export const metadata: Metadata = { title: 'تنظیمات' }

export default function SettingsPage() {
  const settings = getSettings(getDb())
  return (
    <Suspense fallback={<div className="flex h-[400px] items-center justify-center">بارگذاری…</div>}>
      <SettingsClient initialSettings={settings} />
    </Suspense>
  )
}