'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={mounted && isDark ? 'تغییر به پوسته‌ی روشن' : 'تغییر به پوسته‌ی تاریک'}
      title={mounted && isDark ? 'پوسته‌ی روشن' : 'پوسته‌ی تاریک'}
      className={cn('rounded-full', className)}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {/* تا پیش از mount شدن، آیکن ثابت می‌ماند تا hydration mismatch رخ ندهد */}
      {mounted && isDark ? <Sun /> : <Moon />}
    </Button>
  )
}
