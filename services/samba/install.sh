#!/usr/bin/env bash
set -euo pipefail

# Samba install — runs as part of `holistic setup` (already root).
# System prep (groups, /srv/storage) is handled by the orchestrator.

apt-get install -y -qq samba smbclient > /dev/null

# Backup original config once
if [[ -f /etc/samba/smb.conf && ! -f /etc/samba/smb.conf.holistic-backup ]]; then
    cp /etc/samba/smb.conf /etc/samba/smb.conf.holistic-backup
fi

# Deploy config
cat > /etc/samba/smb.conf << 'SMBEOF'
[global]
    workgroup = WORKGROUP
    server string = Holistic Homeserver
    server role = standalone server

    security = user
    map to guest = never

    unix password sync = yes
    passwd program = /usr/bin/passwd %u
    passwd chat = *Enter\snew\s*\spassword:* %n\n *Retype\snew\s*\spassword:* %n\n *password\supdated\ssuccessfully* .
    pam password change = yes

    valid users = @smbusers

    socket options = TCP_NODELAY IPTOS_LOWDELAY
    use sendfile = yes

    log file = /var/log/samba/log.%m
    max log size = 1000
    log level = 1

[homes]
    comment = Private drive
    path = /srv/storage/users/%S
    browseable = no
    read only = no
    create mask = 0600
    directory mask = 0700
    valid users = %S

[family]
    comment = Family share
    path = /srv/storage/family
    browseable = yes
    read only = no
    valid users = @family
    write list = @family
    create mask = 0660
    directory mask = 2770
    force group = family
    inherit permissions = yes
SMBEOF

systemctl restart smbd nmbd
systemctl enable smbd nmbd

echo "[samba] installed and started"
