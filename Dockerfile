# Dockerfile برای DigitalNetworkWatcher
# تصویری سبک (standalone) که Next.js + node:sqlite + xray را در خود دارد

# ------------------------------------------------------------
# Build stage
# ------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# وابستگی‌های سیستمی برای نصب
RUN apk add --no-cache python3 make g++ sqlite-dev

# کپی package.json و lockfile
COPY package*.json ./

# نصب وابستگی‌ها (شامل devDependencies برای build)
RUN npm ci

# کپی کد منبع
COPY . .

# تولید باینری standalone
RUN npm run build

# ------------------------------------------------------------
# Runtime stage
# ------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# پکیج‌های زمان اجرا: tini برای مدیریت سیگنال، sqlite-libs، ca-certificates، curl برای healthcheck
RUN apk add --no-cache \
    tini \
    sqlite-libs \
    ca-certificates \
    curl \
    bash

# کپی خروجی standalone از builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# دایرکتوری دیتابیس (volume mount point)
RUN mkdir -p /data && chown node:node /data

# نصب xray-core (بازیابی باینری از GitHub Releases)
ARG XRAY_VERSION=v26.3.27
ENV XRAY_BINARY=/usr/local/bin/xray
RUN set -eux; \
    arch="$(uname -m)"; \
    case "$arch" in \
      x86_64) XRAY_ARCH="64" ;; \
      aarch64) XRAY_ARCH="arm64-v8a" ;; \
      *) echo "Unsupported arch: $arch" && exit 1 ;; \
    esac; \
    wget -qO /tmp/xray.zip "https://github.com/XTLS/Xray-core/releases/download/${XRAY_VERSION}/Xray-linux-${XRAY_ARCH}.zip"; \
    unzip -q /tmp/xray.zip -d /tmp/xray; \
    install -m 755 /tmp/xray/xray "${XRAY_BINARY}"; \
    rm -rf /tmp/xray /tmp/xray.zip; \
    "${XRAY_BINARY}" version

# کاربر غیر روت
USER node

# متغیرهای پیش‌فرض
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DB_PATH=/data/watch.db \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# پورت پیش‌فرض
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS "http://localhost:3000/" || exit 1

# استفاده از tini برای مدیریت سیگنال‌ها
ENTRYPOINT ["/sbin/tini", "--"]

# اجرای سرور Next.js standalone
CMD ["node", "server.js"]