# Holistic Homeserver

Ubuntu-based home server hub. Services run via a single CLI — Samba for file sharing now, media/smart home/game streaming later. Family users are native Linux accounts; no separate user database.

## Commands

```bash
sudo ./holistic setup              # system prep + all services
sudo ./holistic setup samba        # single service
sudo ./holistic user add <name>    # new family user (Linux + Samba + groups)
sudo ./holistic update             # git pull + re-run setup
./holistic list                    # services in install order
./holistic status                  # check install state
```

## Adding a service

Create `services/<name>/install.sh` and add `<name>` to `services/manifest`. The script runs as root, must be idempotent, and must print `[<name>] installed and started` on success.

```bash
#!/usr/bin/env bash
set -euo pipefail
# ... setup logic ...
echo "[myservice] installed and started"
```

## Layout

```
holistic                        CLI entry point
services/manifest               install order
services/<name>/install.sh      per-service setup
dashboard/                      web portal (planned)
```
