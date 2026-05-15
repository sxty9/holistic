#!/usr/bin/env bash
#
# Holistic Homeserver - Samba Install Script
#
# Runs as part of `holistic setup`. Installs and configures Samba.
# Idempotent: safe to run multiple times.
#

set -euo pipefail

echo "[Holistic Setup] Starte Samba Installation..."

# 1. Samba installieren
echo "Installiere samba paket..."
sudo apt-get update -y
sudo apt-get install -y samba smbclient

# 2. Storage Verzeichnisse erstellen
echo "Erstelle Storage Verzeichnisse in /srv/storage/..."
sudo mkdir -p /srv/storage/users
sudo mkdir -p /srv/storage/family

# 3. Gruppen anlegen (falls noch nicht vorhanden)
echo "Erstelle Gruppen 'smbusers' und 'family'..."
getent group smbusers >/dev/null || sudo groupadd smbusers
getent group family >/dev/null || sudo groupadd family

# 4. Berechtigungen setzen
echo "Setze Berechtigungen für /srv/storage/family..."
sudo chown root:family /srv/storage/family
sudo chmod 2770 /srv/storage/family  # SetGID bit

echo "Setze Berechtigungen für /srv/storage/users..."
sudo chmod 0755 /srv/storage/users
# Hinweis: Die Nutzerordner (0700) müssen bei der Nutzererstellung angelegt werden (z.B. useradd -m -d /srv/storage/users/$USER)

# 5. Einmaliges Backup der originalen Konfiguration (idempotent:
#    nur sichern, wenn noch kein Holistic-Backup existiert, damit
#    ein zweiter Lauf nicht die echte Original-Config überschreibt)
if [ -f /etc/samba/smb.conf ] && [ ! -f /etc/samba/smb.conf.holistic-backup ]; then
    sudo cp /etc/samba/smb.conf /etc/samba/smb.conf.holistic-backup
fi

# 6. Neue smb.conf schreiben
echo "Schreibe neue /etc/samba/smb.conf..."
sudo bash -c 'cat << "SMBEOF" > /etc/samba/smb.conf
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
    comment = Privater Ordner von %U
    path = /srv/storage/users/%S
    browseable = no
    read only = no
    create mask = 0600
    directory mask = 0700
    valid users = %S

[family]
    comment = Familien-Medien
    path = /srv/storage/family
    browseable = yes
    read only = no
    valid users = @family
    write list = @family
    create mask = 0660
    directory mask = 2770
    force group = family
    inherit permissions = yes
SMBEOF'

# 7. Services neustarten und aktivieren
echo "Starte smb und nmb neu..."
sudo systemctl restart smbd nmbd
sudo systemctl enable smbd nmbd


echo "Hinweis: Nutzer muessen separat ueber das holistic dashboard/user management der gruppe 'smbusers' hinzugefügt werden und ein smbpasswd angelegt werden."

# Vertrags-Statuszeile (siehe Service-Vertrag in README.md / CLAUDE.md)
echo "[samba] installed and started"
