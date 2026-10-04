import { Suspense } from 'react'
import { Metadata } from 'next'
import { getServer, listConfigs } from '@/lib/db/queries'
import { ServerDetailClient } from '@/components/server-detail-client'

export const metadata: Metadata = { title: 'جزئیات سرور' }

async function ServerDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const serverId = Number(id)
  const server = getServer(serverId)

  if (!server) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 py-14 text-center max-w-sm">
          <span className="grid size-12 place-items-center rounded-2xl bg-destructive/12 text-destructive">
            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </span>
          <p className="font-semibold">سرور یافت نشد</p>
          <p className="text-sm text-muted-foreground">احتمالا حذف شده یا شناسه نامعتبر است.</p>
        </div>
      </main>
    )
  }

  const configs = listConfigs({ serverId, includeDisabled: false })

  return <ServerDetailClient server={server} configs={configs} />
}

export default function ServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="flex h-[400px] items-center justify-center">بارگذاری…</div>}>
      <ServerDetailContent params={params} />
    </Suspense>
  )
}