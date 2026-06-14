# Holistic

## Commands

```bash
sudo ./holistic setup                 # system prep + all services
sudo ./holistic setup dashboard       # single service
sudo ./holistic user add <name>       # new user (Linux + Samba + groups)
sudo ./holistic user passwd <name>    # change password (Linux + Samba)
sudo ./holistic user delete <name>    # remove user
sudo ./holistic invite new            # mint a dashboard registration code
sudo ./holistic update                # git pull + re-run setup
./holistic list                       # services in install order
./holistic status                     # check install state
```

After `holistic setup`, the dashboard is at `https://holistic.local`. Users sign in with
their Linux account; registration needs an `invite new` code.

## Connect (Samba)

| Platform | Path |
|---|---|
| Windows | `\\<server-ip>\<username>` or `\\<server-ip>\family` |
| macOS | `smb://<server-ip>/<username>` or `smb://<server-ip>/family` |
| Linux | `smb://<server-ip>/<username>` (GNOME) or mount via `cifs-utils` (below) |

### Linux (cifs-utils)

```bash
sudo apt install cifs-utils
sudo mkdir -p /mnt/holistic
sudo mount -t cifs //<server-ip>/<username> /mnt/holistic \
  -o user=<username>,uid=$(id -u),gid=$(id -g),iocharset=utf8
```

GNOME/Nautilus: `gio mount smb://<server-ip>/<username>` (or *Files → Other Locations*).

Persistent mount — keep the password in a root-only credentials file:

```bash
sudo install -m600 /dev/stdin /etc/holistic-smb.cred <<'CRED'
username=<username>
password=<your-password>
CRED
# /etc/fstab line:
# //<server-ip>/<username> /mnt/holistic cifs credentials=/etc/holistic-smb.cred,uid=1000,gid=1000,_netdev 0 0
sudo mount -a
```

## Add a service

Create `services/<name>/install.sh`, add `<name>` to `services/manifest`.
Runs as root, must be idempotent, must print `[<name>] installed and started`.

## Declare permissions (rights standard)

Admin = the `sudo` group and can do everything. To grant **non-admin** users
fine-grained rights, a service *declares* them through a holistic-wide standard;
the `privleg` service then lets admins toggle them per user.

A service drops a manifest at install time to `/etc/holistic/permissions.d/<id>.json`
(like its Caddy and sudoers drop-ins). Each right is backed 1:1 by a Linux group
named `hp_*`; the service creates the groups (`groupadd -f`) and **enforces** the
right itself with `isAdmin || group ∈ user.groups`:

```jsonc
{
  "service": "hostek", "version": 1,
  "categories": [{
    "id": "system", "label": "System",
    "permissions": [{
      "id": "power", "label": "Power control",
      "description": "Turn the server on/off, toggle headless",
      "group": "hp_hostek_power", "default": false, "dangerous": true
    }]
  }]
}
```

Rules: groups must match `^hp_[a-z0-9][a-z0-9_-]{0,27}$` (the `hp_` prefix is a
security boundary — privleg only ever touches `hp_*` groups) and each group backs
exactly one right. Pick `default` so a host *without* privleg behaves exactly as
today: `default:false` for an action that is admin-only now (group stays empty ⇒
admin-only; privleg grants it per user), or `default:true` for an action open to
everyone now (provisioning grants it to all users ⇒ unchanged; privleg revokes it
per user). Enforce with `isAdmin || group ∈ user.groups` either way. The TypeScript
shapes are `PermissionManifest`/`PermissionCategory`/`PermissionDecl` in
`@holistic/ui`. Validate with `holistic perms validate`.

## Layout

```
holistic                        CLI entry point
services/manifest               install order
services/<name>/install.sh      per-service setup
services/<name>/ui/             optional dashboard UI (a @holistic/ui plugin)
frontend/                       dashboard SPA + @holistic/ui SDK
```
