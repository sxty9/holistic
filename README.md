# Holistic Homeserver

Self-hosted home network hub on Ubuntu. Manages services (file sharing, media, smart home) through a single CLI.

## Quick start

```bash
sudo ./holistic setup              # system prep + install all services
sudo ./holistic setup samba        # install/repair one service
sudo ./holistic user add <name>    # create family user (Linux + Samba)
sudo ./holistic update             # git pull + re-run setup
./holistic list                    # show services in install order
./holistic status                  # check install state
```

## Adding a service

1. Create `services/<name>/install.sh` (idempotent, starts with `set -euo pipefail`, prints `[<name>] installed and started` on success)
2. Add `<name>` to `services/manifest`

## Structure

- `holistic` — CLI entry point
- `services/manifest` — ordered list of services to install
- `services/<name>/install.sh` — per-service installer
- `dashboard/` — web portal (planned)

Full architecture docs: [CLAUDE.md](CLAUDE.md)
