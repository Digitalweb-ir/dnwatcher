import { Suspense } from 'react'
import { Metadata } from 'next'
import { getConfig, configStats } from '@/lib/db/queries'
import { ConfigDetailClient } from '@/components/config-detail-client'

export const metadata: Metadata = { title: 'جزئیات کانفیگ' }

async function ConfigDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const configId = Number(id)
  const config = getConfig(configId)

  if (!config) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 py-14 text-center max-w-sm">
          <span className="grid size-12 place-items-center rounded-2xl bg-destructive/12 text-destructive">
            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </span>
          <p className="font-semibold">کانفیگ یافت نشد</p>
          <p className="text-sm text-muted-foreground">احتمالا حذف شده یا شناسه نامعتبر است.</p>
        </div>
      </main>
    )
  }

  // Fetch initial stats for the 24-hour window
  const stats = configStats(configId, Date.now() - 24 * 3600 * 1000)

  return <ConfigDetailClient config={{ ...config, stats }} />
}

export default function ConfigDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="flex flex-col gap-2"><div className="h-12 w-full rounded animate-pulse bg-muted" /><div className="h-[300px] w-full rounded animate-pulse bg-muted" /></div>}>
      <ConfigDetailContent params={params} />
    </Suspense>
  )
}