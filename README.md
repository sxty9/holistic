# Holistic

## Commands

```bash
sudo ./holistic setup              # system prep + all services
sudo ./holistic setup samba        # single service
sudo ./holistic user add <name>    # new user (Linux + Samba + groups)
sudo ./holistic update             # git pull + re-run setup
./holistic list                    # services in install order
./holistic status                  # check install state
```

## Connect (Samba)

| Platform | Path |
|---|---|
| Windows | `\\<server-ip>\<username>` or `\\<server-ip>\family` |
| macOS | `smb://<server-ip>/<username>` or `smb://<server-ip>/family` |

## Add a service

Create `services/<name>/install.sh`, add `<name>` to `services/manifest`.
Runs as root, must be idempotent, must print `[<name>] installed and started`.

## Layout

```
holistic                        CLI entry point
services/manifest               install order
services/<name>/install.sh      per-service setup
```
