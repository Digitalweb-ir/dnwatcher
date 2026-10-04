import type { Metadata, Viewport } from 'next'
import { Vazirmatn } from 'next/font/google'

import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

import './globals.css'

const vazirmatn = Vazirmatn({
  subsets: ['latin', 'arabic'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
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
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster position="bottom-left" closeButton />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}