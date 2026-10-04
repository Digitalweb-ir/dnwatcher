'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { LockKeyhole, Loader2, Radio } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!password.trim()) {
      toast.error('رمز عبور را وارد کنید.')
      return
    }

    setPending(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error ?? 'رمز عبور نادرست است.')
        return
      }

      toast.success('ورود موفق.')
      router.refresh()
      router.push('/')
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <Card className="card-glow-primary w-full max-w-sm border-border/70 bg-card/70">
        <CardHeader className="items-center text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/55 text-primary-foreground shadow-lg shadow-primary/25">
            <Radio className="size-6" />
          </span>
          <CardTitle className="mt-2 text-lg">ورود مدیر</CardTitle>
          <CardDescription>برای مشاهده‌ی داشبورد پایش، رمز مدیر را وارد کنید.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="password">رمز عبور</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={pending}
              />
            </div>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? <Loader2 className="animate-spin" /> : <LockKeyhole />}
              ورود
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}