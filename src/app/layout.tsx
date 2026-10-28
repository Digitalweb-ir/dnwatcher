import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LiveUpdateProvider } from '@/components/providers/live-update-provider'
import { AuthProvider } from '@/components/providers/auth-provider'

import './globals.css'

const vazirmatn = localFont({
  src: '../../public/fonts/Vazirmatn-Variable.woff2',
  variable: '--font-vazirmatn',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'دیجیتال نت‌واچر', template: '%s · دیجیتال نت‌واچر' },
  description: 'مانیتورینگ شبانه‌روزی کانفیگ‌های Xray و بررسی سلامت و تأخیر',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f7fa' },
    { media: '(prefers-color-scheme: dark)', color: '#070a0f' },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <AuthProvider>
            <LiveUpdateProvider>
              <TooltipProvider delayDuration={200}>
                {children}
                <Toaster position="bottom-left" closeButton />
              </TooltipProvider>
            </LiveUpdateProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}