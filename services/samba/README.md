# Samba

Network file shares (SMB/CIFS) — private per-user drives and a shared family drive.

## Install

```bash
sudo ./holistic setup samba
```

## Shares

| Share | Path | Access |
|---|---|---|
| `[homes]` (hidden) | `/srv/storage/users/<you>` | Owner only |
| `[family]` | `/srv/storage/family` | `@family` group |

## Connect

| Platform | Private drive | Family drive |
|---|---|---|
| Windows | `\\<server-ip>\<username>` | `\\<server-ip>\family` |
| macOS | `smb://<server-ip>/<username>` | `smb://<server-ip>/family` |

## Add a user

```bash
sudo useradd -m -d /srv/storage/users/NAME -s /usr/sbin/nologin -U NAME
sudo usermod -aG family,smbusers NAME
sudo smbpasswd -a NAME
sudo smbpasswd -e NAME
```
