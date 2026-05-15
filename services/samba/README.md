# Samba

SMB/CIFS file shares — private drive per user, shared family drive.

## Install

```bash
sudo ./holistic setup samba
```

## Shares

| Share | Path | Visible | Access |
|---|---|---|---|
| `[homes]` | `/srv/storage/users/<username>` | hidden | owner only |
| `[family]` | `/srv/storage/family` | yes | `@family` group |

`[homes]` serves every user automatically via Samba's `%S` variable — no per-user config needed.

`/srv/storage/family` has the SetGID bit (`chmod 2770`), so new files inherit the `family` group regardless of who created them.

## Connect

| Platform | Path |
|---|---|
| Windows | `\\<server-ip>\<username>` or `\\<server-ip>\family` |
| macOS | `smb://<server-ip>/<username>` or `smb://<server-ip>/family` |

## Add a user

```bash
sudo holistic user add <name>
```

This creates the Linux account, sets up `/srv/storage/users/<name>`, adds the user to `family` and `smbusers`, and sets the Samba password interactively.

## Notes

**Password sync is one-way.** `unix password sync = yes` syncs Samba → Linux when `smbpasswd` is used, but *not* Linux → Samba. Anything that changes passwords (e.g. the dashboard) must update both explicitly.

**Inline comments in `smb.conf` break the service.** Put comments on their own line.

**Group changes take effect after the session is rebuilt.** Disconnect and reconnect SMB after `usermod`.
