# Dockerfile for DigitalNetworkWatcher
# Lightweight standalone image bundling Next.js, node:sqlite, and xray

# ------------------------------------------------------------
# Build stage
# ------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# System dependencies needed to build
RUN apk add --no-cache python3 make g++ sqlite-dev

# Copy package.json and lockfile
COPY package*.json ./

# Install dependencies (including devDependencies for the build)
RUN npm ci

# Copy the source code
COPY . .

# Produce the standalone build
RUN npm run build

# ------------------------------------------------------------
# Runtime stage
# ------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Runtime packages: tini for signal handling, sqlite-libs, ca-certificates,
# curl for the healthcheck, and wget and unzip for installing xray
RUN apk add --no-cache \
    tini \
    sqlite-libs \
    ca-certificates \
    curl \
    bash \
    wget \
    unzip

# Copy the standalone output from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Database directory (volume mount point)
RUN mkdir -p //var/lib/dn-watcher && chown root:root /var/lib/dn-watcher

# Install xray-core (binary fetched from GitHub Releases)
ARG XRAY_VERSION=v26.3.27
ENV XRAY_BINARY=/usr/local/bin/xray
RUN set -eux; \
    arch="$(uname -m)"; \
    case "$arch" in \
    x86_64) XRAY_ARCH="64" ;; \
    aarch64) XRAY_ARCH="arm64-v8a" ;; \
    *) echo "Unsupported arch: $arch" && exit 1 ;; \
    esac; \
    curl -L -o /tmp/xray.zip "https://github.com/XTLS/Xray-core/releases/download/${XRAY_VERSION}/Xray-linux-${XRAY_ARCH}.zip"; \
    unzip -q /tmp/xray.zip -d /tmp/xray; \
    install -m 755 /tmp/xray/xray "${XRAY_BINARY}"; \
    rm -rf /tmp/xray /tmp/xray.zip; \
    "${XRAY_BINARY}" version

# Default environment variables
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DB_PATH=/var/lib/dn-watcher/sqldb.db \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Default port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS "http://localhost:3000/" || exit 1

# Use tini for signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the Next.js standalone server
CMD ["node", "server.js"]