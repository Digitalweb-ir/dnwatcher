# DigitalNetworkWatcher — 24/7 Xray Config Monitoring

A round-the-clock monitoring system for Xray servers that fetches subscription links, extracts configurations, and tests them periodically. The entire UI is in Persian (RTL).

## ✨ Features

- **Add servers via subscription URL**: Provide a sub URL (vless/vmess/trojan/shadowsocks) — all configs are extracted automatically.
- **Server name & country**: Each server has a name and ISO country code (with flag emoji).
- **24h / 7d / 30d / 365d timelines**: Colored bars show per-config status (green = success, red = failure, yellow = mixed).
- **Periodic checks**: Default every 2 minutes (configurable) — latency + TTFB tests via SOCKS5 tunnels.
- **Failure threshold**: N consecutive failures = incident recorded.
- **Aggregated stats**: Uptime, median, p95, MTBF, MTTR, longest healthy streak.
- **Live updates (SSE)**: Dashboard and timeline update in real time without refresh.
- **Secure authentication**: Admin password hashed with scrypt, JWT sessions (jose HS256), HttpOnly cookies.
- **Subscription link encryption**: AES-256-GCM, key stored in `ENCRYPTION_KEY`.
- **Docker ready**: Standalone image with xray-core pre-installed.

## 🚀 Quick Install (One Line)

```bash
# Replace with your domain and Docker Hub image
sudo bash -c "$(curl -sL https://github.com/Digitalweb-ir/dnwatcher/raw/main/dn-watcher.sh)" @ install
```

The script will:
- Generate secure keys (`ENCRYPTION_KEY`, `SESSION_SECRET`)
- Prompt for admin password (or generate one)
- Create `docker-compose.yml`, `Caddyfile`, and `.env`
- Pull the image from Docker Hub
- Start containers with Caddy reverse proxy (auto SSL via Let's Encrypt)
- Output the panel URL and admin credentials

---

## 🚀 Quick Start (Docker - Manual)

```bash
# 1. Clone the repository
git clone <repo-url>
cd DigitalNetworkWatcher

# 2. Set environment variables (replace with your own values)
ENCRYPTION_KEY=$(openssl rand -hex 32)
ADMIN_PASSWORD="your_strong_password"
SESSION_SECRET=$(openssl rand -hex 32)

# 3. Run
ENCRYPTION_KEY="$ENCRYPTION_KEY" \
ADMIN_PASSWORD="$ADMIN_PASSWORD" \
SESSION_SECRET="$SESSION_SECRET" \
docker compose up -d

# 4. Panel available at http://localhost:3000
```

## 🛠 Development Setup (No Docker)

```bash
# Prerequisites: Node.js 22+, pnpm (or npm/yarn)
pnpm install

# Environment variables (create .env)
cp .env.example .env
# Fill in ENCRYPTION_KEY, ADMIN_PASSWORD, SESSION_SECRET

# Xray binary (optional — if not in PATH)
bash scripts/install-xray.sh

# Run in dev mode
pnpm dev
```

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # Route Handlers
│   │   ├── auth/          # login, logout, me
│   │   ├── servers/       # Servers CRUD + actions
│   │   ├── configs/       # Config details
│   │   ├── timeline/      # Timeline data
│   │   ├── dashboard/     # Dashboard summary
│   │   ├── check/         # Check cycle trigger
│   │   ├── stream/        # SSE
│   │   └── settings/      # Settings
│   ├── servers/           # Servers pages
│   ├── configs/           # Configs pages
│   ├── timeline/          # Timeline page
│   ├── settings/          # Settings page
│   ├── login/             # Login
│   └── page.tsx           # Dashboard
├── components/            # React Components
│   ├── ui/                # shadcn/ui (RTL, radix-nova)
│   ├── app-shell.tsx      # App shell + navigation
│   ├── server-form.tsx    # Add/edit server form
│   ├── servers-view.tsx   # Servers list
│   ├── server-detail-client.tsx
│   ├── timeline-view.tsx  # Timeline view
│   ├── timeline-grid.tsx  # Timeline grid (SVG-like div)
│   ├── config-detail-client.tsx
│   ├── stat-card.tsx      # Stat card
│   └── status-dot.tsx     # Status indicator
├── lib/
│   ├── auth/              # password, session, guard, store
│   ├── crypto/            # secret.ts (AES-256-GCM)
│   ├── db/                # SQLite (node:sqlite)
│   │   ├── index.ts       # singleton + PRAGMA + migrations
│   │   ├── schema.ts      # Tables
│   │   ├── queries.ts     # Query functions
│   │   └── settings.ts    # Settings
│   ├── xray/              # Xray test engine
│   │   ├── binary.ts      # Binary discovery
│   │   ├── build.ts       # Batch config builder
│   │   ├── runner.ts      # spawn + probe
│   │   ├── socks5.ts      # SOCKS5 client + TLS + TTFB
│   │   └── tester.ts      # Batch/one-by-one orchestrator
│   ├── sub/               # Subscription handling
│   │   ├── fetch.ts       # Fetch with timeout
│   │   ├── parse.ts       # URI parsing
│   │   └── reconcile.ts   # Fingerprint-based sync
│   ├── service/
│   │   └── check.ts       # Check service + CycleState
│   ├── countries.ts       # Country list + flags
│   ├── format.ts          # Persian numbers/dates (Jalali)
│   └── types.ts           # Shared types
└── instrumentation.ts     # Background scheduler (Next.js 16)
```

## ⚙️ Environment Variables

| Variable         | Default           | Description                                                      |
| ---------------- | ----------------- | ---------------------------------------------------------------- |
| `ENCRYPTION_KEY` | —                 | **Required**. 32-byte hex for AES-256-GCM.                       |
| `ADMIN_PASSWORD` | `admin`           | Admin password. Hashed on first run.                             |
| `SESSION_SECRET` | —                 | **Required in production**. JWT HS256 signing key (32-byte hex). |
| `DB_PATH`        | `./data/watch.db` | SQLite file path.                                                |
| `XRAY_BINARY`    | auto              | Xray binary path (optional).                                     |
| `NODE_ENV`       | `development`     | Set to `production` for deployment.                              |

## 🔐 Security

- **Subscription links**: Never stored in plaintext. AES-256-GCM with random 12-byte nonce.
- **Admin password**: scrypt hash (N=16384, r=8, p=1) with 16-byte salt. Compared via `timingSafeEqual`.
- **Sessions**: JWT HS256 signed with `jose`, 30-day expiry, `HttpOnly; Secure; SameSite=Lax` cookie.
- **No middleware**: Next.js 16 — auth handled in Server Components and Route Handlers, not `middleware.ts`.

## 🧪 Manual Testing

```bash
# Force a check cycle
curl -X POST http://localhost:3000/api/check \
  -H "Content-Type: application/json" \
  -d '{"force": true}' \
  -b "dnw_session=<cookie>"

# Check cycle status
curl http://localhost:3000/api/check -b "dnw_session=<cookie>"

# SSE stream (in terminal)
curl -N http://localhost:3000/api/stream -b "dnw_session=<cookie>"
```

## 📊 Main API

| Method | Path                                  | Description                                             |
| ------ | ------------------------------------- | ------------------------------------------------------- |
| GET    | `/api/servers`                        | List servers with stats                                 |
| POST   | `/api/servers`                        | Add server (name, country, sub_url, check_interval_sec) |
| PUT    | `/api/servers`                        | Update server                                           |
| DELETE | `/api/servers?id=1`                   | Delete server                                           |
| POST   | `/api/servers/1`                      | `{action: "check"}` or `{action: "refresh"}`            |
| GET    | `/api/timeline?window=24h&serverId=1` | Timeline data                                           |
| GET    | `/api/configs/1`                      | Config details + stats + timeline                       |
| GET    | `/api/dashboard`                      | Dashboard summary                                       |
| POST   | `/api/auth/login`                     | `{password}` → session cookie                           |
| POST   | `/api/auth/logout`                    | Clear cookie                                            |
| GET    | `/api/auth/me`                        | Auth status                                             |
| GET    | `/api/stream`                         | SSE (cycle:state, config:check, heartbeat)              |

## 🗃 Database Schema (Summary)

- `servers` — id, name, country, sub_url(encrypted), check_interval_sec, enabled, last_fetch_at, last_fetch_error, created_at
- `configs` — id, server_id, fingerprint(SHA256), uri, protocol, address, port, label, enabled, status(up/down/idle), fail_streak, last_ok, last_latency_ms, last_check_at, first_seen_at, last_seen_at
- `checks` — id, config_id, ts, ok, status, latency_ms, ttfb_ms, http_status, error
- `incidents` — id, config_id, started_at, ended_at, fail_count, last_error
- `daily_stats` — config_id, day, total, up_count, avg_latency, min_latency, max_latency, p95_latency, downtime_sec
- `settings` — key, value (system settings)

## 🔧 Default Settings (Changeable via `/settings`)

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

## 📝 Important Notes

1. **Xray binary**: Pre-installed in container. On bare metal run `scripts/install-xray.sh` or set `XRAY_BINARY`.
2. **SOCKS5 ports**: Uses `port_base` (default 20000). Each batch tests up to `max_batch` configs.
3. **Data retention**: `retention_days` for raw checks, `daily_retention_days` for daily aggregates.
4. **Country**: ISO 2-letter code stored. Flag rendered from code (no image files needed).

## 🤝 Contributing

This project is under active development. Issues and PRs are welcome.

## 📄 License

MIT License — free to use.