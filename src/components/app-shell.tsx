'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, LayoutDashboard, Radio, Server, Settings, ShieldCheck, LogOut, LogIn, User, Loader2 } from 'lucide-react'

import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { MonitoringStatus } from '@/components/monitoring-status'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useAuth } from '@/components/providers/auth-provider'

const NAV = [
  { href: '/', label: 'داشبورد', icon: LayoutDashboard, auth: false },
  { href: '/timeline', label: 'تایم‌لاین', icon: Activity, auth: false },
  { href: '/servers', label: 'سرورها', icon: Server, auth: false },
  { href: '/ssh-servers', label: 'دسترسی SSH', icon: ShieldCheck, auth: true },
  { href: '/settings', label: 'تنظیمات', icon: Settings, auth: false },
] as const

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg outline-none">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/55 text-primary-foreground shadow-lg shadow-primary/25">
        <Radio className="size-[18px]" />
      </span>
      {!compact && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[15px] font-bold">دیجیتال نت‌واچر</span>
          <span className="truncate text-[11px] text-muted-foreground">پایش شبانه‌روزی Xray</span>
        </span>
      )}
    </Link>
  )
}

function NavLinks({ className, isAuthenticated }: { className?: string; isAuthenticated: boolean }) {
  const pathname = usePathname()

  return (
    <nav className={cn('flex flex-col gap-1', className)}>
      {NAV.map(({ href, label, icon: Icon, auth }) => {
        if (auth && !isAuthenticated) return null
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
            )}
          >
            {active && (
              <span className="absolute inset-y-1.5 -start-2 w-1 rounded-full bg-primary" aria-hidden />
            )}
            <Icon className={cn('size-[18px]', active && 'text-primary')} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function MobileNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border glass pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="grid grid-cols-4">
        {NAV.map(({ href, label, icon: Icon, auth }) => {
          if (auth && !isAuthenticated) return null
          const active = isActive(pathname, href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

export function AppShell({
  children,
  title,
  description,
  actions,
}: {
  children: React.ReactNode
  title?: string
  description?: string
  actions?: React.ReactNode
}) {
  const { isAuthenticated, loading, logout } = useAuth()
  const pathname = usePathname()

  async function handleLogout() {
    try {
      await logout()
      toast.success('با موفقیت خارج شدید')
    } catch {
      toast.error('خطا در خروج از حساب')
    }
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col gap-6 border-e border-sidebar-border bg-sidebar/70 p-4 backdrop-blur-xl lg:flex">
        <Brand />
        <NavLinks isAuthenticated={isAuthenticated} />
        <div className="mt-auto flex flex-col gap-3">
          <MonitoringStatus />

          <div className="rounded-2xl bg-muted/30 p-3 border border-border/50 flex flex-col gap-3">
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                <Loader2 className="size-3 animate-spin" /> بررسی وضعیت...
              </div>
            ) : isAuthenticated ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <User className="size-3 text-primary" /> مدیر سیستم
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="h-8 text-xs justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="size-3" /> خروج از حساب
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 text-xs gap-2"
              >
                <Link href="/login">
                  <LogIn className="size-3" /> ورود به پنل
                </Link>
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground">پوسته</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border glass px-4 py-2.5 lg:hidden">
          <Brand />
          <div className="ms-auto flex items-center gap-2">
            {isAuthenticated && (
              <Button variant="ghost" size="icon" onClick={handleLogout} className="size-8">
                <LogOut className="size-4" />
              </Button>
            )}
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-5 lg:px-8 lg:pb-12 lg:pt-8">
          <div className="mx-auto w-full max-w-[1400px]">
            {title && <PageHeader title={title} description={description} actions={actions} />}
            {children}
          </div>
        </main>
      </div>

      <MobileNav isAuthenticated={isAuthenticated} />
    </div>
  )
}
