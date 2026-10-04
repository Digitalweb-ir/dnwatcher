#!/usr/bin/env bash
# اسکریپت نصب Xray-core در محیط‌های لینوکس (خارج از کانتینر)
# اجرا: bash scripts/install-xray.sh [version]

set -euo pipefail

VERSION="${1:-v25.9.30}"
INSTALL_DIR="${2:-/usr/local/bin}"
BINARY_NAME="xray"

# تشخیص معماری
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) XRAY_ARCH="64" ;;
  aarch64) XRAY_ARCH="arm64-v8a" ;;
  armv7l) XRAY_ARCH="arm32-v7a" ;;
  *) echo "معماری پشتیبانی نمی‌شود: $ARCH" >&2; exit 1 ;;
esac

URL="https://github.com/XTLS/Xray-core/releases/download/${VERSION}/Xray-linux-${XRAY_ARCH}.zip"

echo "دانلود Xray ${VERSION} برای ${XRAY_ARCH}..."
echo "URL: ${URL}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

wget -qO "${TMP_DIR}/xray.zip" "$URL"
unzip -q "${TMP_DIR}/xray.zip" -d "${TMP_DIR}"
install -m 755 "${TMP_DIR}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"

echo "نصب شد: ${INSTALL_DIR}/${BINARY_NAME}"
"${INSTALL_DIR}/${BINARY_NAME}" version