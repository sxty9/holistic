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

# Node 22+ for the frontend build (the pnpm/corepack toolchain uses node:sqlite, added in
# Node 22.5). Install/upgrade via NodeSource if node is missing OR too old — note an existing
# old node must NOT be left in place, so we check the major version, not just presence.
NODE_MAJOR="$(node -v 2>/dev/null | sed -n 's/^v\([0-9][0-9]*\).*/\1/p')"
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 22 ]; then
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null 2>&1 || true
    apt-get install -y -qq nodejs >/dev/null
fi
corepack enable >/dev/null 2>&1 || npm install -g pnpm >/dev/null 2>&1

# File broker — root-owned, group smbusers, not group/other-writable. It runs AS the target
# family user (`sudo -u <user>`), so that user must be able to EXECUTE it; group MUST be the
# sudoers runas ceiling (%smbusers), NOT holistic — family users aren't in holistic, so a
# holistic-group binary fails to exec with EACCES ("cannot execute … Permission denied").
install -m 0750 -o root -g smbusers "$HERE/sbin/holistic-fs" /usr/local/sbin/holistic-fs

# Validate the sudoers drop-in written by system_prep before relying on it.
visudo -cf /etc/sudoers.d/holistic >/dev/null

# JWT signing secret (32 bytes), readable only by the backend user.
if [[ ! -s /etc/holistic/jwt-secret ]]; then
    ( umask 077; openssl rand -hex 32 > /etc/holistic/jwt-secret )
    chown holistic:holistic /etc/holistic/jwt-secret
    chmod 600 /etc/holistic/jwt-secret
fi

echo "[dashboard] building frontend..."
# pnpm runs as root here, and the build intentionally reaches sibling paths
# (e.g. ../../services/*/ui), so it must run inside the repo — not an isolated copy.
# Building in-tree as root would otherwise leave root-owned node_modules/dist in the
# user's working copy, and a pre-existing one then blocks the next `pnpm install` with
# a no-TTY purge prompt. Guard both: CI=true keeps pnpm non-interactive, and an EXIT
# trap hands the tree back to the repo owner even if the build fails — so nothing
# root-owned is ever left behind (this also self-heals trees from older installs).
REPO_OWNER="$(stat -c '%u:%g' "$REPO_ROOT")"
trap 'chown -R "$REPO_OWNER" "$REPO_ROOT/frontend" 2>/dev/null || true' EXIT
# export (not just a prefix) so CI=true covers BOTH pnpm calls — the build step runs
# an implicit deps-status-check that would otherwise re-enter install interactively and
# abort on the no-TTY purge prompt.
( cd "$REPO_ROOT/frontend" && export CI=true && pnpm install --silent && pnpm --filter @holistic/app build )
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

# Rights standard: declare samba's permissions (drop-in) + create their backing groups.
# `holistic setup` reconciles default-on rights for existing users afterwards.
echo "[dashboard] declaring samba permissions..."
install -d -o holistic -g holistic -m 0755 /etc/holistic/permissions.d
install -m 0644 "$HERE/permissions/samba.json" /etc/holistic/permissions.d/samba.json
python3 "$HERE/lib/holistic-perms.py" ensure-groups /etc/holistic/permissions.d

echo "[dashboard] configuring Caddy..."
install -d /etc/caddy
install -d /etc/caddy/conf.d   # drop-in dir for per-service routes (e.g. hostek); imported by the Caddyfile
install -m 0644 "$HERE/caddy/Caddyfile" /etc/caddy/Caddyfile
systemctl reload caddy 2>/dev/null || systemctl restart caddy || true

echo "[dashboard] installed and started"
