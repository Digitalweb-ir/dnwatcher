# پلن پروژه: Digital Network Watcher

سیستم مانیتورینگ شبانه‌روزی کانفیگ‌های Xray با هسته‌ی واقعی Xray، رابط Next.js، دیتابیس SQLite و استقرار با Docker.

---

## ۱. خلاصه‌ی تصمیم‌ها

| موضوع | تصمیم |
|---|---|
| فریم‌ورک | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| تست | هسته‌ی واقعی Xray — هر کانفیگ از داخل تونل تست می‌شود |
| دیتابیس | SQLite (better-sqlite3) روی volume |
| استقرار | Docker روی یکی از سرورها |
| امنیت | یک رمز عبور ادمین + کوکی امضاشده |
| بازه‌ی چک | پیش‌فرض ۵ دقیقه، قابل تغییر |
| آستانه‌ی قرمز | ۲ فِیل پیاپی |
| ماندگاری | ۳۰ روز داده‌ی خام + آمار روزانه‌ی بلندمدت |
| تایم‌فریم‌ها | ۲۴ ساعته / هفتگی / ماهانه / سالانه |
| زبان | فارسی، RTL، فونت وزیرمتن، تاریخ شمسی، اعداد فارسی |

**درباره‌ی «بدون بکند»:** مرورگر نمی‌تواند اتصال TCP خام بزند و پروتکل‌های Xray را تست کند. پس همان پروژه‌ی Next.js نقش سرور را هم بازی می‌کند (Route Handlers + یک حلقه‌ی زمان‌بند در `instrumentation.ts`). نتیجه: **یک پروژه، یک `docker compose up`، بدون سرویس جداگانه.**

---

## ۲. معماری

```
┌──────────────────────────────────────────────────────────┐
│  Docker Container                                         │
│                                                           │
│  ┌──────────────┐        ┌───────────────────────────┐   │
│  │  Next.js     │◄──────►│  Scheduler                │   │
│  │  UI + API    │        │  (instrumentation.ts)     │   │
│  └──────┬───────┘        └─────────┬─────────────────┘   │
│         │                          │                      │
│         │                  ┌───────▼─────────┐            │
│         │                  │  Xray Runner    │            │
│         │                  │  یک پروسه،      │            │
│         │                  │  N inbound      │            │
│         │                  └───────┬─────────┘            │
│         │                          │ SOCKS5 (127.0.0.1)   │
│         ▼                          ▼                      │
│   SQLite /data/watch.db      تست واقعی HTTP              │
└──────────────────────────────────────────────────────────┘
```

---

## ۳. موتور تست (قلب سیستم)

### ۳.۱ دریافت و پارس کانفیگ‌ها

1. لینک ساب هر سرور از دیتابیس خوانده می‌شود (`https://host/sub/TOKEN`)
2. درخواست با `User-Agent: v2rayNG/1.8.5` (بعضی پنل‌ها بدون UA پاسخ نمی‌دهند)
3. پاسخ Base64 دیکد می‌شود → لیست URI
4. پشتیبانی از پروتکل‌ها: `vless://`, `vmess://`, `trojan://`, `ss://`, `socks://`, `http://`
5. هر URI → یک **outbound JSON** مخصوص Xray
6. **Fingerprint**: هش SHA-256 از URI بدون `#name` → شناسه‌ی پایدار کانفیگ
   - کانفیگ جدید → اضافه
   - غایب در ساب → غیرفعال (تاریخچه حفظ می‌شود)

### ۳.۲ اجرای تست (حالت Batch — سریع)

به‌جای یک پروسه‌ی Xray برای هر کانفیگ (کند)، **یک پروسه با N inbound**:

```jsonc
{
  "log": { "loglevel": "warning" },
  "inbounds": [
    { "tag": "in-0", "listen": "127.0.0.1", "port": 20000, "protocol": "socks", "settings": { "auth": "noauth", "udp": false } },
    { "tag": "in-1", "listen": "127.0.0.1", "port": 20001, "protocol": "socks", "settings": { "auth": "noauth", "udp": false } }
  ],
  "outbounds": [
    { "tag": "out-0", "protocol": "vless", "settings": { /* ... */ }, "streamSettings": { /* ... */ } },
    { "tag": "out-1", "protocol": "vmess", "settings": { /* ... */ }, "streamSettings": { /* ... */ } }
  ],
  "routing": {
    "rules": [
      { "type": "field", "inboundTag": ["in-0"], "outboundTag": "out-0" },
      { "type": "field", "inboundTag": ["in-1"], "outboundTag": "out-1" }
    ]
  }
}
```

- پورت‌ها از بازه‌ی `20000..20000+N` انتخاب می‌شوند (قابل تنظیم)
- قبل از اجرا چک می‌شود پورت آزاد است
- بعد از تست، پروسه kill و پورت‌ها آزاد می‌شوند
- **Fallback**: اگر batch شکست خورد، یک‌به‌یک تست می‌شود

### ۳.۳ سنجش در هر تست

از طریق SOCKS5 به پورت مربوطه، با تایم‌اوت قابل تنظیم (پیش‌فرض ۵ ثانیه):

| متریک | توضیح |
|---|---|
| `ok` | موفق / ناموفق |
| `latency_ms` | زمان کل تا دریافت پاسخ |
| `ttfb_ms` | زمان تا اولین بایت |
| `http_status` | کد پاسخ (انتظار: ۲۰۴) |
| `error` | نوع خطا: timeout / refused / tls / protocol / http |

آدرس تست پیش‌فرض: `https://www.gstatic.com/generate_204` (قابل تغییر در تنظیمات — مثلاً به `https://cp.cloudflare.com/generate_204`)

### ۳.۴ ضد هشدار کاذب

- وضعیت نمایش‌داده‌شده فقط بعد از **۲ فِیل پیاپی** قرمز می‌شود
- تعداد fail از تنظیمات خوانده می‌شود
- در دیتابیس هر دو نگه داشته می‌شود: نتیجه‌ی خام و وضعیت نهایی (تا آمار دقیق باشد)

---

## ۴. دیتابیس

فایل `/data/watch.db` — `better-sqlite3` + `WAL mode`

### جداول

**`servers`**
| ستون | نوع | توضیح |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | نام دلخواه |
| sub_url | TEXT | رمزنگاری‌شده AES-256-GCM |
| check_interval_sec | INTEGER | بازه‌ی چک این سرور |
| enabled | INTEGER | ۰/۱ |
| last_fetch_at | INTEGER | آخرین دریافت ساب |
| last_fetch_error | TEXT | |
| created_at | INTEGER | |

**`configs`**
| ستون | نوع | توضیح |
|---|---|---|
| id | INTEGER PK | |
| server_id | INTEGER FK | |
| fingerprint | TEXT UNIQUE | هش SHA-256 |
| uri | TEXT | کانفیگ کامل |
| protocol | TEXT | vless/vmess/... |
| address | TEXT | host |
| port | INTEGER | |
| label | TEXT | نام از `#fragment` |
| enabled | INTEGER | غیرفعال = از ساب حذف شده |
| first_seen_at | INTEGER | |
| last_seen_at | INTEGER | |

**`checks`** (داده‌ی خام)
| ستون | نوع | توضیح |
|---|---|---|
| id | INTEGER PK | |
| config_id | INTEGER FK | |
| ts | INTEGER | Unix ms |
| ok | INTEGER | نتیجه‌ی خام |
| status | TEXT | up / down |
| latency_ms | INTEGER | NULL اگر ناموفق |
| ttfb_ms | INTEGER | |
| http_status | INTEGER | |
| error | TEXT | |

ایندکس: `(config_id, ts)` و `(ts)`

**`incidents`**
| ستون | نوع |
|---|---|
| id | INTEGER PK |
| config_id | INTEGER FK |
| started_at | INTEGER |
| ended_at | INTEGER NULL |
| fail_count | INTEGER |
| last_error | TEXT |

**`daily_stats`** (آمار بلندمدت — بعد از پاکسازی داده‌ی خام می‌ماند)
| ستون | نوع | توضیح |
|---|---|---|
| config_id | INTEGER | |
| day | TEXT | YYYY-MM-DD |
| total | INTEGER | تعداد تست |
| up_count | INTEGER | |
| avg_latency | REAL | |
| min_latency | INTEGER | |
| max_latency | INTEGER | |
| p95_latency | INTEGER | |
| downtime_sec | INTEGER | |

PK: `(config_id, day)`

**`settings`** — key/value: بازه‌ی پیش‌فرض، تایم‌اوت، URL تست، آستانه‌ی fail، ماندگاری، بازه‌ی پورت

**`locks`** — جلوگیری از اجرای همزمان چکر (row با heartbeat)

### ماندگاری

- داده‌ی خام `checks`: ۳۰ روز
- `incidents` و `daily_stats`: ۱ سال
- Job پاکسازی روزانه، قبل از حذف `daily_stats` را آپدیت می‌کند

---

## ۵. آمار و محاسبات

برای هر کانفیگ و هر سرور، در هر تایم‌فریم (۲۴س / ۷روز / ۳۰روز / ۱سال):

| متریک | فرمول |
|---|---|
| Uptime % | `up_count / total * 100` |
| میانگین تأخیر | میانگین وزنی از `daily_stats` یا محاسبه‌ی مستقیم |
| میانه / صدک ۹۵ | از داده‌ی خام (۲۴س) یا تخمین از daily |
| کمینه / بیشینه | از `daily_stats` |
| تعداد قطعی‌ها | `count(incidents)` |
| مجموع زمان قطعی | `sum(ended_at - started_at)` |
| **طولانی‌ترین بازه‌ی سالم** | بزرگ‌ترین فاصله‌ی بین دو incident |
| میانگین زمان بین قطعی‌ها (MTBF) | `(بازه - مجموع قطعی) / تعداد قطعی` |
| میانگین زمان ریکاوری (MTTR) | `مجموع قطعی / تعداد قطعی` |
| روند تأخیر | sparkline از آگرگیشن ساعتی/روزانه |

---

## ۶. تایم‌لاین

نمای اصلی: **grid** — هر سطر یک کانفیگ، هر ستون یک بازه.

```
            00:00  02:00  04:00  06:00  08:00  10:00 ...
 server-1
  ├ config A  🟩🟩🟩🟩  🟩🟩🟥🟥  🟩🟩🟩🟩  🟩🟩🟩🟩
  └ config B  🟩🟩🟩🟩  🟩🟩🟩🟩  🟩🟩🟩🟩  🟩🟩🟩🟩
 server-2
  ├ config C  🟩🟩🟩🟩  🟥🟥🟥🟥  🟩🟩🟩🟩  🟩🟩🟩🟩
```

**تب‌های تایم‌فریم** با آگرگیشن خودکار:

| تایم‌فریم | اندازه‌ی سلول | تعداد سلول |
|---|---|---|
| ۲۴ ساعته | ۵ دقیقه | ۲۸۸ |
| هفتگی | ۱ ساعت | ۱۶۸ |
| ماهانه | ۱ روز | ۳۰ |
| سالانه | ۱ هفته | ۵۲ |

- رنگ سلول بر اساس نسبت uptime در آن بازه (سبز کامل → زرد → قرمز)
- **Hover** → tooltip با زمان دقیق، وضعیت، میانگین تأخیر، تعداد fail
- **کلیک** → پنل جزئیات آن بازه
- نوار Uptime و sparkline تأخیر در کنار هر سطر
- اعداد فارسی، تاریخ و ساعت شمسی

---

## ۷. رابط کاربری

**فونت:** Vazirmatn (لوکال، woff2، بدون CDN)
**جهت:** `<html lang="fa" dir="rtl">`
**تم:** مدرن، دارک‌فرست، شیشه‌ای (glassmorphism) + گرادیان، سوییچ روز/شب، توکن‌های رنگی

### صفحات

| مسیر | محتوا |
|---|---|
| `/login` | ورود با رمز ادمین |
| `/` | **داشبورد**: کارت‌های خلاصه (تعداد کانفیگ، سالم، قطع، آپتایم کل، میانگین تأخیر)، وضعیت زنده با SSE، آخرین قطعی‌ها، نمودار کلی |
| `/timeline` | تایم‌لاین کامل با تب‌های ۲۴س/۷ر/۳۰ر/۱س + نوار uptime |
| `/servers` | افزودن/ویرایش سرور، لینک ساب، بازه‌ی چک، دکمه‌ی «چک فوری» |
| `/servers/[id]` | جزئیات سرور: لیست کانفیگ‌ها، آمار سرور |
| `/configs/[id]` | جزئیات کانفیگ: نمودار تأخیر، لیست incidentها، جدول آمار، تاریخچه |
| `/settings` | بازه‌ی پیش‌فرض، تایم‌اوت، URL تست، آستانه‌ی fail، ماندگاری، امنیت |

### کامپوننت‌های اصلی

`StatusDot` · `TimelineGrid` · `LatencyChart` (SVG سبک) · `StatCard` · `UptimeBar` · `IncidentList` · `ServerForm` · `ThemeToggle`

### به‌روزرسانی زنده

`GET /api/stream` (Server-Sent Events): هر بار چک تمام شد، رخداد جدید به UI پوش می‌شود. بدون polling سنگین.

---

## ۸. API Routes

| متد | مسیر | کار |
|---|---|---|
| POST | `/api/auth/login` | ورود، ست کوکی امضاشده |
| POST | `/api/auth/logout` | خروج |
| GET | `/api/servers` | لیست سرورها + خلاصه‌ی وضعیت |
| POST | `/api/servers` | افزودن سرور |
| PATCH/DELETE | `/api/servers/[id]` | ویرایش/حذف |
| POST | `/api/servers/[id]/check` | اجرای چک فوری |
| GET | `/api/configs` | لیست کانفیگ‌ها (فیلتر سرور/وضعیت) |
| GET | `/api/configs/[id]` | جزئیات + تاریخچه |
| GET | `/api/timeline` | داده‌ی تایم‌لاین (`?range=24h\|7d\|30d\|1y`) |
| GET | `/api/stats` | آمار کلی و هر کانفیگ (`?range=`) |
| GET | `/api/stats/[configId]` | آمار تفصیلی یک کانفیگ |
| GET | `/api/incidents` | لیست قطعی‌ها |
| GET | `/api/stream` | SSE |
| GET/PATCH | `/api/settings` | تنظیمات |

---

## ۹. زمان‌بند

در `instrumentation.ts` (فقط در runtime نود، نه edge):

```
هر ۱۵ ثانیه:
  ├─ قفل را چک کن (اگر قفل آزاد نیست، رد شو)
  ├─ سرورهایی که موعد چک‌شان رسیده را پیدا کن
  ├─ برای هر سرور:
  │    ├─ اگر ساب قدیمی است (>۱ ساعت) → رفرش و reconcile
  │    ├─ ساخت کانفیگ batch Xray
  │    ├─ اجرای Xray + تست همه‌ی inboundها
  │    ├─ ثبت نتایج در checks
  │    ├─ آپدیت incidents
  │    └─ آپدیت daily_stats
  ├─ پاکسازی داده‌ی قدیمی (یک بار در روز)
  └─ ارسال رخداد به SSE
```

- قفل با heartbeat → اگر پروسه کرش کرد، قفل بعد از تایم‌اوت آزاد می‌شود
- تلاش مجدد با backoff نمایی روی خطای شبکه در fetch ساب

---

## ۱۰. ساختار پوشه‌ها

```
digital-network-watcher/
├── PLAN.md
├── README.md
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── xray/                     # باینری + کانفیگ تمپلت
│   └── .gitkeep
├── data/                     # volume → watch.db
├── src/
│   ├── app/
│   │   ├── layout.tsx        # RTL + فونت + تم
│   │   ├── page.tsx          # داشبورد
│   │   ├── login/page.tsx
│   │   ├── timeline/page.tsx
│   │   ├── servers/
│   │   ├── configs/[id]/page.tsx
│   │   ├── settings/page.tsx
│   │   └── api/              # route handlers
│   ├── components/
│   │   ├── ui/               # Button, Card, Input, Dialog…
│   │   ├── timeline/
│   │   ├── charts/
│   │   └── layout/
│   ├── lib/
│   │   ├── db/               # schema, migrations, queries
│   │   ├── xray/             # parser, runner, tester
│   │   ├── sub/              # fetch + decode + reconcile
│   │   ├── stats/            # aggregations
│   │   ├── crypto/           # AES-256-GCM
│   │   ├── auth/             # session cookie
│   │   └── scheduler/
│   ├── instrumentation.ts    # شروع زمان‌بند
│   └── styles/globals.css
├── public/fonts/             # Vazirmatn woff2
└── scripts/
    └── install-xray.sh
```

---

## ۱۱. Docker

```dockerfile
FROM node:22-bookworm-slim
# نصب xray-core از ریلیز رسمی
# بیلد Next.js با output: 'standalone'
# اجرای node server.js
```

```yaml
services:
  watcher:
    build: .
    restart: unless-stopped
    ports: ["3000:3000"]
    volumes: ["./data:/data"]
    environment:
      - TZ=Asia/Tehran
      - DB_PATH=/data/watch.db
      - ENCRYPTION_KEY=<32 بایت hex>
      - ADMIN_PASSWORD=<رمز>
      - SESSION_SECRET=<hex>
```

**نکته:** چکر باید بتواند به اینترنت آزاد وصل شود. اگر روی خود سرور Xray اجرا شود، هر کانفیگ از سرور به IP خودش وصل می‌شود — سالم بودن کانفیگ را می‌فهمی ولی تأخیر واقعی کاربر را نه. بهترین حالت: یک VPS سوم ارزان.

---

## ۱۲. مراحل اجرا (قدم به قدم)

| # | مرحله | خروجی قابل تست |
|---|---|---|
| ۱ | اسکافولد Next.js + Tailwind + RTL + فونت وزیرمتن + تم + پوسته | اپ بالا می‌آید، صفحه‌ی فارسی |
| ۲ | لایه‌ی دیتابیس: اسکیما، migration، کوئری‌ها | جداول ساخته می‌شوند |
| ۳ | پارسر لینک ساب → outbound + fingerprint + reconcile | لیست کانفیگ‌ها از ساب استخراج می‌شود |
| ۴ | موتور تست Xray (batch + SOCKS + متریک‌ها) | یک کانفیگ واقعاً تست و تأخیرش ثبت می‌شود |
| ۵ | زمان‌بند + قفل + آستانه‌ی fail + incident detection | چک خودکار هر ۵ دقیقه |
| ۶ | API Routes + SSE | داده به UI می‌رسد |
| ۷ | محاسبات آماری (uptime، میانگین، p95، MTBF، طولانی‌ترین بازه‌ی سالم) | آمار درست |
| ۸ | صفحات UI: داشبورد، تایم‌لاین، سرورها، جزئیات، تنظیمات | رابط کامل |
| ۹ | احراز هویت + رمزنگاری لینک ساب | امنیت |
| ۱۰ | Docker + Compose + README | استقرار روی سرور |
| ۱۱ | پالایش: اعداد فارسی، تاریخ شمسی، حالت‌های خالی، خطاها | آماده‌ی استفاده |

هر مرحله جدا تحویل داده می‌شود و می‌توانی همان‌جا تست کنی.

---

## ۱۳. ریسک‌ها و راه‌حل

| ریسک | راه‌حل |
|---|---|
| مرورگر نمی‌تواند TCP خام بزند | سرور-ساید با Xray core (در همین پروژه) |
| Xray core در Docker اجرا نمی‌شود | نصب در مرحله‌ی build + تست سلامت در startup |
| بعضی پنل‌ها بدون UA جواب نمی‌دهند | هدر `User-Agent: v2rayNG/1.8.5` |
| ساب بزرگ (صدها کانفیگ) | محدودیت تعداد inbound در هر batch + تقسیم به چند دسته |
| قطعی لحظه‌ای → هشدار کاذب | آستانه‌ی ۲ فِیل پیاپی |
| رشد دیتابیس | ماندگاری ۳۰ روز + آمار روزانه‌ی دائمی |
| اجرای همزمان دو چک | قفل با heartbeat |
| کانفیگ منقضی/حذف‌شده در ساب | غیرفعال می‌شود، تاریخچه می‌ماند |
| اجرای چکر روی خود سرور Xray → تأخیر غیرواقعی | توصیه به VPS سوم در README |

---

## ۱۴. وابستگی‌ها

| بسته | کاربرد |
|---|---|
| `next`, `react`, `react-dom` | فریم‌ورک |
| `typescript`, `@types/*` | تایپ |
| `tailwindcss`, `postcss`, `autoprefixer` | استایل |
| `better-sqlite3` | دیتابیس |
| `jose` | امضای کوکی نشست |
| `zod` | اعتبارسنجی ورودی |
| `lucide-react` | آیکون |

نمودارها با SVG دستی — بدون کتابخانه‌ی سنگین.

---

## ۱۵. آماده‌ی شروع؟

اگر این پلن تأیید است، از **مرحله‌ی ۱** شروع می‌کنم و بعد از هر مرحله نتیجه را نشان می‌دهم تا تست کنی.
