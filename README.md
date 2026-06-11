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

## Layout

```
holistic                        CLI entry point
services/manifest               install order
services/<name>/install.sh      per-service setup
services/<name>/ui/             optional dashboard UI (a @holistic/ui plugin)
frontend/                       dashboard SPA + @holistic/ui SDK
```
