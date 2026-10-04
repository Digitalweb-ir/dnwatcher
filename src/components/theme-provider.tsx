'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ComponentProps } from 'react'

/** پوسته‌ی سیستم: کلاس `dark` روی <html>، پیش‌فرض بر اساس تنظیمات سیستم‌عامل */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="dnw-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
