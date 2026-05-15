# Dashboard

Web portal for the home network. Not yet implemented.

## What it does

- Login with Linux username + password (PAM auth against `/etc/shadow`)
- Overview of all services with status
- Per-service info — e.g. ready-to-use SMB paths (`\\<ip>\<username>`, `smb://<ip>/<username>`)
- Self-service password change (updates both Linux and Samba passwords)

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + TypeScript, Tailwind, shadcn/ui |
| Backend | FastAPI (Python 3.12+), PAM auth via `python-pam`, JWT in HttpOnly cookie |
| Proxy | Caddy (Docker), TLS via mkcert |

The backend runs as a **native systemd service** (not Docker) — it needs access to PAM and calls privileged host scripts via `sudo`.

## Security

The backend runs as an unprivileged `holistic` user. A `/etc/sudoers.d/holistic` entry grants passwordless sudo for specific wrapper scripts only:

```
holistic ALL=(root) NOPASSWD: /usr/local/sbin/holistic-user-passwd
holistic ALL=(root) NOPASSWD: /usr/local/sbin/holistic-user-add
```

## Planned API

| Endpoint | Purpose |
|---|---|
| `POST /login` | PAM auth, issue JWT cookie |
| `GET /services` | List services + status |
| `GET /services/samba` | SMB paths for the logged-in user |
| `POST /account/password` | Change Linux + Samba password |
