# Holistic Dashboard

> The central web portal for the Holistic Homeserver — a single, friendly entry point on the home
> network for managing accounts and accessing services.

> **Status:** ⏳ Planned — not yet implemented. This document describes the intended design.

## Overview

The dashboard gives every family member a simple, central place — usable without IT knowledge — to
see the available services and manage their own account. It is built in-house (FastAPI + React) for
full control over the PAM/sudo integration.

## Planned features

1. **Central login** — users sign in with their Homeserver username and password; authentication
   validates directly against the native Linux users via PAM.
2. **Services overview** — all integrated services rendered as cards, with status.
3. **Service info & options** — per-service access details and links (e.g. copy-ready SMB network
   paths, web links to other service UIs).
4. **Account management** — self-service password change; the change is applied at the OS level
   (Linux + Samba) under the hood.

## Architecture

```text
Browser (home network)
   ↓
Caddy (reverse proxy, Docker) — TLS via mkcert
   ↓
   ├── Frontend (React + Vite + Tailwind + shadcn/ui, Docker)
   ├── Backend (FastAPI, native systemd service — NOT Docker, needs PAM/sudo)
   └── Other services (Jellyfin, Home Assistant, … — Docker)

Backend → limited sudo wrappers on the host:
   /usr/local/sbin/holistic-user-add
   /usr/local/sbin/holistic-user-passwd
   /usr/local/sbin/holistic-user-mod
```

### Auth flow

1. User submits username + password.
2. Backend validates via PAM against `/etc/shadow`.
3. A JWT (username + groups) is issued in an HttpOnly cookie.
4. Follow-up requests authenticate via the JWT.

### Security model

- Backend runs as an unprivileged `holistic` user.
- A `/etc/sudoers.d/holistic` file grants passwordless sudo **only** for the defined wrapper
  scripts — never full sudo.

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React + Vite + TypeScript, TailwindCSS, shadcn/ui, TanStack Query, React Router |
| Backend | Python 3.12+, FastAPI, Pydantic v2, `pydantic-settings`, `python-pam` |
| Proxy | Caddy (Docker), TLS via mkcert |

## Planned API

| Endpoint | Purpose |
|---|---|
| `POST /login` | PAM auth, issue JWT cookie |
| `GET /services` | List integrated services + status |
| `GET /services/samba` | Samba paths for the current user |
| `POST /account/password` | Change Linux + Samba password |

## Service plugin model

Each service is a Python class implementing a common interface (`status`, `user_has_access`,
`user_view`, `user_actions`). Registering a new class makes the frontend render a new card
automatically. See `CLAUDE.md` for the interface definition.
