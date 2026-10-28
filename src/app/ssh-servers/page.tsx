'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Plus, Trash2, Server, ShieldCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { AppShell } from '@/components/app-shell'
import { cn } from '@/lib/utils'
import { toFa } from '@/lib/format'

interface SSHServer {
  id: number
  name: string
  ip: string
  user: string
  password: string
  created_at: number
}

export default function SSHServersPage() {
  const router = useRouter()
  const [servers, setServers] = useState<SSHServer[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [newServer, setNewServer] = useState({ name: '', ip: '', user: '', password: '' })

  async function fetchServers() {
    try {
      const res = await fetch('/api/ssh-servers')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      setServers(data)
    } catch (error) {
      toast.error('خطا در دریافت لیست سرورهای SSH')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchServers()
  }, [])

  async function handleAdd() {
    setIsSaving(true)
    try {
      const res = await fetch('/api/ssh-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newServer),
      })
      if (!res.ok) throw new Error('خطا در ذخیره سرور')

      toast.success('سرور SSH با موفقیت اضافه شد')
      setNewServer({ name: '', ip: '', user: '', password: '' })
      setIsAdding(false)
      await fetchServers()
    } catch (error) {
      toast.error('عملیات ناموفق بود')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('آیا از حذف این سرور SSH مطمئن هستید؟')) return
    try {
      const res = await fetch(`/api/ssh-servers?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('خطا در حذف')
      toast.success('سرور حذف شد')
      await fetchServers()
    } catch (error) {
      toast.error('عملیات ناموفق بود')
    }
  }

  return (
    <AppShell
      title="مدیریت سرورهای SSH"
      description="تنظیمات دسترسی برای عملیات بازیابی خودکار"
      actions={
        <Button onClick={() => setIsAdding(true)} className="gap-2">
          <Plus className="size-4" /> افزودن سرور
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">لیست دسترسی‌ها</h2>
          <p className="text-sm text-muted-foreground">
            اطلاعات SSH در این بخش برای اجرای دستورات اصلاحی در هنگام قطعی کانفیگ‌ها استفاده می‌شود.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6 flex flex-col gap-3">
                  <div className="h-4 w-1/3 bg-muted rounded" />
                  <div className="h-3 w-1/2 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : servers.length === 0 ? (
          <Card className="border-dashed bg-card/40">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Server className="size-6" />
              </div>
              <div>
                <p className="font-semibold">هیچ سرور SSH تعریف نشده است</p>
                <p className="text-sm text-muted-foreground">برای فعال‌سازی سیستم بازیابی، ابتدا سرورهای خود را اضافه کنید.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.map((s) => (
              <Card key={s.id} className="group hover:border-primary/40 transition-all duration-300 bg-card/40 overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Server className="size-5" />
                      </div>
                      <div>
                        <h3 className="font-bold leading-none">{s.name}</h3>
                        <span className="text-[10px] text-muted-foreground">ایجاد شده در {toFa(new Date(s.created_at).toLocaleDateString('fa-IR'))}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => handleDelete(s.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground">IP Address</span>
                      <span className="font-mono font-medium">{s.ip}</span>
                    </div>
                    <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground">Username</span>
                      <span className="font-mono font-medium">{s.user}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <ShieldCheck className="size-3 text-up" />
                      اتصال رمزنگاری شده (SSH)
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>افزودن سرور SSH</DialogTitle>
              <DialogDescription>اطلاعات دسترسی را برای مدیریت سرور وارد کنید.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-xs font-medium">نام نمایشی</label>
                <Input
                  placeholder="مثلاً: سرور اصلی آلمان"
                  value={newServer.name}
                  onChange={e => setNewServer({...newServer, name: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium">آدرس IP</label>
                <Input
                  placeholder="1.2.3.4"
                  value={newServer.ip}
                  onChange={e => setNewServer({...newServer, ip: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-xs font-medium">کاربر</label>
                  <Input
                    placeholder="root"
                    value={newServer.user}
                    onChange={e => setNewServer({...newServer, user: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium">رمز عبور</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={newServer.password}
                    onChange={e => setNewServer({...newServer, password: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAdding(false)}>انصراف</Button>
              <Button onClick={handleAdd} disabled={isSaving}>
                {isSaving && <Loader2 className="size-4 animate-spin me-2" />}
                ذخیره سرور
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  )
}
