'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { LockKeyhole, Loader2, Radio, ArrowRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { loginSchema, type LoginFormData } from '@/lib/forms-schema'

function LoginForm() {
  const searchParams = useSearchParams()
  const [pending, setPending] = useState(false)

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: '' },
    mode: 'onChange',
  })

  async function onSubmit(data: LoginFormData) {
    setPending(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const result = await response.json()
        toast.error(result.error ?? 'رمز عبور نادرست است.')
        return
      }

      toast.success('خوش آمدید، در حال انتقال...')

      const next = searchParams.get('next')
      window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center px-4 overflow-hidden bg-background">
      {/* Background Decorative Elements */}
      <div className="absolute -top-24 -left-24 size-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 size-96 rounded-full bg-primary/10 blur-3xl" />

      <Card className="relative w-full max-w-md overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl shadow-2xl transition-all duration-500 hover:shadow-primary/10">
        {/* Top Gradient Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-primary to-transparent" />

        <CardHeader className="flex flex-col items-center text-center pt-10 pb-6">
          <div className="relative mb-4">
            <div className="absolute inset-0 animate-ping rounded-2xl bg-primary/20" />
            <span className="relative grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-xl transition-transform duration-500 hover:scale-110">
              <Radio className="size-8" />
            </span>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">ورود به پنل مدیریت</CardTitle>
          <CardDescription className="mt-2 text-muted-foreground max-w-[280px]">
            برای مدیریت سرورها و مشاهده تنظیمات پیشرفته، لطفاً رمز عبور را وارد کنید.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-10">
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div className="grid gap-2">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">رمز عبور مدیر</Label>
              <div className="relative group">
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={pending}
                  className="pl-10 h-12 rounded-xl border-border/50 bg-background/50 transition-all focus:border-primary/50 focus:ring-primary/20"
                  {...form.register('password')}
                  aria-invalid={!!form.formState.errors.password}
                  aria-describedby={form.formState.errors.password ? 'password-error' : undefined}
                />
                <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              </div>
              {form.formState.errors.password && (
                <p id="password-error" className="text-xs text-destructive" role="alert">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={pending}
              className="group relative h-12 rounded-xl font-bold transition-all duration-300 hover:shadow-lg hover:shadow-primary/25"
            >
              {pending ? (
                <Loader2 className="animate-spin size-5" />
              ) : (
                <>
                  <span>ورود به سیستم</span>
                  <ArrowRight className="me-2 size-4 transition-transform group-hover:-translate-x-1" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}