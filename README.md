# Holistic Homeserver

> A self-hosted, intelligent hub for the home network — running on a native Ubuntu server (`lakehost`).

Holistic provides network services for the whole family (file sharing, smart home, game
streaming, and — later — AI automation) behind a single web dashboard. This repository is the
**core orchestrator**: it manages the system and integrates services. It does **not** contain the
full source of the individual services.

> **Status:** Foundation in place. Samba is installed and running, and the `holistic` CLI
> orchestrator works (Bash). The dashboard is planned and not yet implemented — see
> [Roadmap](#roadmap).

## Overview

- **Single source of truth for users:** Linux/PAM accounts *are* the service accounts. No separate
  user database (no LDAP/Authelia for now).
- **Core repo + outsourced service repos:** This repo orchestrates and integrates only. Deep
  per-service configuration lives in separate repositories. Each `services/<name>/` directory holds
  just a thin `install.sh` wrapper.
- **Containerized by default:** Everything runs in Docker except Samba, which runs natively for
  performance and clean PAM integration.
- **Self-built dashboard:** FastAPI backend + React frontend. No Cockpit/Webmin.

## Repository structure

```text
holistic/
├── README.md                  # This file — project overview & setup
├── CLAUDE.md                  # Full context for AI assistants / new contributors
├── holistic                   # CLI orchestrator (Bash entry point)
├── dashboard/
│   └── README.md              # User portal: vision, architecture, API (planned)
└── services/
    ├── manifest               # Service install order (one name per line)
    └── samba/
        ├── README.md          # Samba integration
        └── install.sh         # Automated, idempotent service setup
```

Planned additions: `bin/` user-provisioning helpers, `docs/`, and further services
(`jellyfin`, `home-assistant`, `sunshine`, …).

## Getting started

Clone the repo and run the orchestrator. It iterates the services listed in `services/manifest`
(in order) and runs each service's idempotent `install.sh` — safe to re-run.

```bash
git clone <repo-url> holistic
cd holistic
sudo ./holistic setup            # install/repair all services (manifest order)
sudo ./holistic setup samba      # install/repair a single service
./holistic list                  # services in install order
./holistic status                # which services have an install.sh
```

Adding a service: create `services/<name>/install.sh` (see [Service contract](#service-contract))
and add `<name>` to `services/manifest` at the desired position.

## Services

| Service | Purpose | Status |
|---|---|---|
| `samba` | Private + shared family network drives (SMB/CIFS) | ✅ Installed & running |
| `jellyfin` | Media server | ⏳ Planned |
| `home-assistant` | Smart home | ⏳ Planned |
| `sunshine` | Game streaming | ⏳ Planned |

## Service contract

Every `services/<name>/install.sh` must:

1. Start with `set -euo pipefail`.
2. Be **idempotent** — safe to run multiple times.
3. Check and install its own prerequisites (e.g. APT packages).
4. Set its own permissions and configuration.
5. Print one status line to stdout on success, e.g. `[samba] installed and started`.

## Roadmap

**High priority**

- ✅ `holistic setup` CLI orchestrator (Bash, manifest-driven)
- `bin/holistic-user-add` provisioning script (`holistic user add <name>`)
- Backup strategy for `/srv/storage`

**Medium**

- Dashboard backend (FastAPI) + frontend (React)
- Dedicated `holistic` service user with minimal sudo rights
- Per-user disk quotas

**Later**

- Jellyfin, Home Assistant, Sunshine
- Remote access (WireGuard/Tailscale)

## Documentation

- [`services/samba/README.md`](services/samba/README.md) — Samba integration
- [`dashboard/README.md`](dashboard/README.md) — user portal vision & architecture
- [`CLAUDE.md`](CLAUDE.md) — full project context, conventions, and design decisions

## Contributing

Read [`CLAUDE.md`](CLAUDE.md) first — it documents the architecture decisions, conventions, and the
service-integration model. Keep deep service configuration in separate repos; this core repo only
holds thin integration wrappers.
