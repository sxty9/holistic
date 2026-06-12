#!/usr/bin/env bash
set -euo pipefail

# Runs as root via `holistic setup dashboard`. system_prep has already created the
# `holistic` user + groups, /etc/holistic + /var/lib/holistic, and installed the user
# wrappers + sudoers (including the holistic-fs line) + the PAM service. This script
# adds the file broker, builds the frontend, installs the backend, and wires systemd + Caddy.

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
APP=/opt/holistic
WWW="$APP/www"
VENV="$APP/venv"

echo "[dashboard] installing system packages..."
# Caddy is not in Ubuntu's default repos — add the official Caddy apt repo first,
# otherwise `apt-get install caddy` fails and the dashboard has no reverse proxy.
if ! command -v caddy >/dev/null; then
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gnupg >/dev/null
    curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
        | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
        > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
fi
apt-get install -y -qq python3-venv caddy openssl >/dev/null

# Node 20 + pnpm for the frontend build.
if ! command -v node >/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1 || true
    apt-get install -y -qq nodejs >/dev/null
fi
corepack enable >/dev/null 2>&1 || npm install -g pnpm >/dev/null 2>&1

# File broker — root-owned, group holistic, not group/other-writable.
install -m 0750 -o root -g holistic "$HERE/sbin/holistic-fs" /usr/local/sbin/holistic-fs

# Validate the sudoers drop-in written by system_prep before relying on it.
visudo -cf /etc/sudoers.d/holistic >/dev/null

# JWT signing secret (32 bytes), readable only by the backend user.
if [[ ! -s /etc/holistic/jwt-secret ]]; then
    ( umask 077; openssl rand -hex 32 > /etc/holistic/jwt-secret )
    chown holistic:holistic /etc/holistic/jwt-secret
    chmod 600 /etc/holistic/jwt-secret
fi

echo "[dashboard] building frontend..."
( cd "$REPO_ROOT/frontend" && pnpm install --silent && pnpm --filter @holistic/app build )
install -d -o holistic -g holistic "$WWW"
rm -rf "${WWW:?}/"*
cp -r "$REPO_ROOT/frontend/app/dist/." "$WWW/"

echo "[dashboard] installing backend (venv)..."
python3 -m venv "$VENV"
"$VENV/bin/pip" install -q --upgrade pip
"$VENV/bin/pip" install -q "$HERE"
chown -R holistic:holistic "$APP"

echo "[dashboard] configuring systemd..."
install -m 0644 "$HERE/systemd/holistic-dashboard.service" /etc/systemd/system/holistic-dashboard.service
systemctl daemon-reload
systemctl enable holistic-dashboard >/dev/null 2>&1 || true
systemctl restart holistic-dashboard

echo "[dashboard] configuring Caddy..."
install -d /etc/caddy
install -d /etc/caddy/conf.d   # drop-in dir for per-service routes (e.g. hostek); imported by the Caddyfile
install -m 0644 "$HERE/caddy/Caddyfile" /etc/caddy/Caddyfile
systemctl reload caddy 2>/dev/null || systemctl restart caddy || true

echo "[dashboard] installed and started"
