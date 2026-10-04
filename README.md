# DigitalNetworkWatcher — پایش شبانه‌روزی کانفیگ‌های Xray

سیستم مانیتورینگ ۲۴ ساعته برای سرورهای Xray که لینک‌های ساب (Subscription) را دریافت، کانفیگ‌ها را استخراج و به‌صورت دوره‌ای تست می‌کند. تمام رابط کاربری به زبان فارسی است.

## ✨ ویژگی‌ها

- **افزودن سرور با لینک ساب**: یک URL ساب (vless/vmess/trojan/shadowsocks) وارد کنید — همه کانفیگ‌ها به‌صورت خودکار استخراج می‌شوند.
- **کشور و نام سرور**: هر سرور نام و کشور (با پرچم ایموجی) دارد.
- **تایم‌لاین ۲۴ ساعته / هفتگی / ماهانه / سالانه**: نوارهای رنگی وضعیت هر کانفیگ (سبز = موفق، قرمز = خطا، زرد = ترکیبی).
- **بررسی دوره‌ای**: پیش‌فرض هر ۲ دقیقه (قابل تنظیم) — تست تأخیر و TTFB از طریق تونل SOCKS5.
- **آستانه قطعی**: N شکست پیاپی = ثبت رخداد (Incident).
- **آمار تجمیعی**: آپ‌تایم، میانه، صدک ۹۵، MTBF، MTTR، طولانی‌ترین بازه سالم.
- **به‌روزرسانی زنده (SSE)**: داشبورد و تایم‌لاین بدون رفرش به‌روز می‌شوند.
- **احراز هویت امن**: رمز مدیر با scrypt، نشست JWT (jose HS256)، کوکی HttpOnly.
- **رمزنگاری لینک ساب**: AES-256-GCM، کلید در `ENCRYPTION_KEY`.
- **Docker Ready**: Image standalone با xray-core از پیش نصب شده.

## 🚀 راه‌اندازی سریع (Docker)

```bash
# ۱. مخزن را کلون کنید
git clone <repo-url>
cd DigitalNetworkWatcher

# ۲. متغیرهای محیطی را ست کنید (مقادیر خودتان را جایگزین کنید)
ENCRYPTION_KEY=$(openssl rand -hex 32)
ADMIN_PASSWORD="رمز_قوی_مورد_نظر_شما"
SESSION_SECRET=$(openssl rand -hex 32)

# ۳. اجرا
ENCRYPTION_KEY="$ENCRYPTION_KEY" \
ADMIN_PASSWORD="$ADMIN_PASSWORD" \
SESSION_SECRET="$SESSION_SECRET" \
docker compose up -d

# ۴. پنل در http://localhost:3000 در دسترس است
```

## 🛠 راه‌اندازی توسعه (بدون Docker)

```bash
# پیش‌نیاز: Node.js 22+، pnpm (یا npm/yarn)
pnpm install

# متغیرهای محیطی (فایل .env بسازید)
cp .env.example .env
# مقادیر ENCRYPTION_KEY، ADMIN_PASSWORD، SESSION_SECRET را پر کنید

# باینری Xray (اختیاری — اگر در PATH نباشد)
bash scripts/install-xray.sh

# اجرا در حالت توسعه
pnpm dev
```

## 📁 ساختار پروژه

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # Route Handlers
│   │   ├── auth/          # login, logout, me
│   │   ├── servers/       # CRUD سرورها + actions
│   │   ├── configs/       # جزئیات کانفیگ
│   │   ├── timeline/      # داده تایم‌لاین
│   │   ├── dashboard/     # خلاصه داشبورد
│   │   ├── check/         # اجرای دور بررسی
│   │   ├── stream/        # SSE
│   │   └── settings/      # تنظیمات
│   ├── servers/           # صفحات سرورها
│   ├── configs/           # صفحات کانفیگ‌ها
│   ├── timeline/          # صفحه تایم‌لاین
│   ├── settings/          # صفحه تنظیمات
│   ├── login/             # ورود
│   └── page.tsx           # داشبورد
├── components/            # React Components
│   ├── ui/                # shadcn/ui (RTL, radix-nova)
│   ├── app-shell.tsx      # لایه_app + ناوبری
│   ├── server-form.tsx    # فرم افزودن/ویرایش سرور
│   ├── servers-view.tsx   # فهرست سرورها
│   ├── server-detail-client.tsx
│   ├── timeline-view.tsx  # نمای تایم‌لاین
│   ├── timeline-grid.tsx  # شبکه تایم‌لاین (SVG-like div)
│   ├── config-detail-client.tsx
│   ├── stat-card.tsx      # کارت آمار
│   └── status-dot.tsx     # نقطه وضعیت
├── lib/
│   ├── auth/              # password, session, guard, store
│   ├── crypto/            # secret.ts (AES-256-GCM)
│   ├── db/                # SQLite (node:sqlite)
│   │   ├── index.ts       # singleton + PRAGMA + migrations
│   │   ├── schema.ts      # جداول
│   │   ├── queries.ts     # توابع کوئری
│   │   └── settings.ts    # تنظیمات
│   ├── xray/              # موتور تست Xray
│   │   ├── binary.ts      # یافتن باینری
│   │   ├── build.ts       # ساخت config批次
│   │   ├── runner.ts      # spawn + probe
│   │   ├── socks5.ts      # کلاینت SOCKS5 + TLS + TTFB
│   │   └── tester.ts      # orchestrator batch/one-by-one
│   ├── sub/               # ساب‌کریپشن
│   │   ├── fetch.ts       # دریافت با timeout
│   │   ├── parse.ts       # پارس URIها
│   │   └── reconcile.ts   # همگام‌سازی با fingerprint
│   ├── service/
│   │   └── check.ts       # سرویس بررسی + CycleState
│   ├── countries.ts       # لیست کشورها + پرچم
│   ├── format.ts          # اعداد/تاریخ فارسی (Jalali)
│   └── types.ts           # Types مشترک
└── instrumentation.ts     # زمان‌بند پس‌زمینه (Next.js 16)
```

## ⚙️ متغیرهای محیطی

| متغیر | پیش‌فرض | توضیح |
|--------|----------|-------|
| `ENCRYPTION_KEY` | — | **الزامی**. ۳۲ بایت hex برای AES-256-GCM. |
| `ADMIN_PASSWORD` | `admin` | رمز مدیر. در اجرا هش می‌شود. |
| `SESSION_SECRET` | — | **الزامی در تولید**. کلید امضای JWT (۳۲ بایت hex). |
| `DB_PATH` | `./data/watch.db` | مسیر فایل SQLite. |
| `XRAY_BINARY` | auto | مسیر باینری xray (اختیاری). |
| `NODE_ENV` | `development` | `production` در استقرار. |

## 🔐 امنیت

- **لینک ساب**: هرگز در متن ساده ذخیره نمی‌شود. رمزنگاری AES-256-GCM با nonce تصادفی ۱۲ بایتی.
- **رمز مدیر**: هش scrypt (N=16384, r=8, p=1) با salt ۱۶ بایتی. مقایسه `timingSafeEqual`.
- **نشست**: JWT HS256 امضا شده با `jose`، ۳۰ روز انقضا، کوکی `HttpOnly; Secure; SameSite=Lax`.
- **بدون middleware**: در Next.js 16 از `middleware.ts` استفاده نمی‌شود؛ احراز هویت در Server Components و Route Handlers.

## 🧪 تست دستی

```bash
# اجرای یک دور بررسی اجباری
curl -X POST http://localhost:3000/api/check \
  -H "Content-Type: application/json" \
  -d '{"force": true}' \
  -b "dnw_session=<cookie>"

# مشاهده وضعیت چرخه
curl http://localhost:3000/api/check -b "dnw_session=<cookie>"

# اتصال SSE (در ترمینال)
curl -N http://localhost:3000/api/stream -b "dnw_session=<cookie>"
```

## 📊 API اصلی

| متد | مسیر | توضیح |
|-----|------|-------|
| GET | `/api/servers` | لیست سرورها با آمار |
| POST | `/api/servers` | افزودن سرور (name, country, sub_url, check_interval_sec) |
| PUT | `/api/servers` | ویرایش سرور |
| DELETE | `/api/servers?id=1` | حذف سرور |
| POST | `/api/servers/1` | `{action: "check"}` یا `{action: "refresh"}` |
| GET | `/api/timeline?window=24h&serverId=1` | داده تایم‌لاین |
| GET | `/api/configs/1` | جزئیات کانفیگ + آمار + تایم‌لاین |
| GET | `/api/dashboard` | خلاصه داشبورد |
| POST | `/api/auth/login` | `{password}` → کوکی نشست |
| POST | `/api/auth/logout` | حذف کوکی |
| GET | `/api/auth/me` | وضعیت احراز هویت |
| GET | `/api/stream` | SSE (cycle:state, config:check, heartbeat) |

## 🗃 اسکیمای دیتابیس (خلاصه)

- `servers` — id, name, country, sub_url(encrypted), check_interval_sec, enabled, last_fetch_at, last_fetch_error, created_at
- `configs` — id, server_id, fingerprint(SHA256), uri, protocol, address, port, label, enabled, status(up/down/idle), fail_streak, last_ok, last_latency_ms, last_check_at, first_seen_at, last_seen_at
- `checks` — id, config_id, ts, ok, status, latency_ms, ttfb_ms, http_status, error
- `incidents` — id, config_id, started_at, ended_at, fail_count, last_error
- `daily_stats` — config_id, day, total, up_count, avg_latency, min_latency, max_latency, p95_latency, downtime_sec
- `settings` — key, value (تنظیمات سیستمی)

## 🔧 تنظیمات پیش‌فرض (قابل تغییر از `/settings`)

```json
{
  "check_interval_sec": 120,
  "request_timeout_ms": 5000,
  "test_url": "https://www.gstatic.com/generate_204",
  "fail_threshold": 2,
  "retention_days": 30,
  "daily_retention_days": 365,
  "port_base": 20000,
  "max_batch": 50,
  "sub_refresh_sec": 3600,
  "scheduler_tick_sec": 15
}
```

## 📝 نکات مهم

1. **باینری Xray**: در کانتینر از پیش نصب است. در هاست مستقیم `scripts/install-xray.sh` را اجرا کنید یا `XRAY_BINARY` ست کنید.
2. **پورت‌های SOCKS5**: از `port_base` (پیش‌فرض ۲۰۰۰۰) استفاده می‌شود. هر batch حداکثر `max_batch` کانفیگ تست می‌کند.
3. **حذف داده**: `retention_days` برای checks خام، `daily_retention_days` برای آمار روزانه.
4. **کشور**: کد ISO دوحرفی ذخیره می‌شود. پرچم از روی کد ساخته می‌شود (بدون نیاز به فایل تصویر).

## 🤝 مشارکت

این پروژه در حال توسعه فعال است. Issues و PRها خوش‌آمده‌اند.

## 📄 مجوز

MIT License — استفاده آزاد.