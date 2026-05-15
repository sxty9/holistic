# Samba Service

> Native Samba (SMB/CIFS) integration for the Holistic Homeserver — private per-user drives and a
> shared family drive.

This directory holds only the **integration wrapper** for Samba. Deep configuration and extended
documentation live in a separate service repository; here you find the automated setup script that
the core repo runs.

> **Status:** ✅ Installed and running. `install.sh` is implemented and idempotent.

## Overview

Samba runs **natively** (not containerized) for performance and clean PAM integration. Linux users
are the Samba users — there is no separate user store.

## Prerequisites

- Ubuntu Server with `sudo` privileges
- Network access for APT (`samba`, `smbclient` packages)

## Usage

Run via the orchestrator (preferred) or the script directly. Safe to re-run.

```bash
sudo ./holistic setup samba          # via orchestrator
sudo bash services/samba/install.sh  # directly
```

## What `install.sh` does

1. Installs `samba` and `smbclient` via APT.
2. Creates the storage layout under `/srv/storage/` (`users/`, `family/`).
3. Creates the `smbusers` and `family` groups if missing.
4. Sets ownership and permissions, including the SetGID bit (`2770`) on `family/`.
5. Backs up any existing `/etc/samba/smb.conf` and deploys the Holistic configuration.
6. Restarts and enables `smbd` / `nmbd`.

## Storage layout

```text
/srv/storage/
├── users/<name>/   # owner <name>:<name>, mode 0700 — private per-user drive
└── family/          # owner root:family,  mode 2770 (SetGID) — shared family drive
```

The SetGID bit on `family/` ensures new files inherit the `family` group, so every family member
can read and write shared content regardless of who created it.

## Shares

| Share | Path | Visibility | Access |
|---|---|---|---|
| `[homes]` | `/srv/storage/users/%S` | Hidden (`browseable = no`) | Owning user only |
| `[family]` | `/srv/storage/family` | Browseable | `@family` group |

The `[homes]` block serves every user's private share automatically via `%S` — adding a new user
requires **no** `smb.conf` change.

## User provisioning

User creation is currently **manual** (a `holistic-user-add` helper is planned). A new user must be
created, added to the `family` and `smbusers` groups, and given an SMB password
(`smbpasswd -a`, then `smbpasswd -e`). See `CLAUDE.md` for the exact command sequence.

## Dashboard integration

The planned dashboard will, per logged-in user:

- Display ready-to-use SMB paths, e.g. `\\<server-ip>\<username>` (Windows) and
  `smb://<server-ip>/<username>` (macOS).
- Pass password changes through to Samba. Note: `unix password sync` only syncs
  Samba → Linux, **not** the reverse — the dashboard must set both explicitly.

## Notes & caveats

- Inline comments after values in `smb.conf` break the service — keep comments on their own line.
- Group membership changes only take effect after the SMB/SSH session is rebuilt.
- After config changes: validate with `sudo testparm`, then `sudo systemctl reload smbd`.
