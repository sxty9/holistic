# Samba-Setup auf dem Holistic Homeserver

> **Kontext:** Zentraler Ubuntu-Homeserver (`lakehost`) als Basis für Mediaserver, Smart-Home-Manager und Game-Streaming. Dieses Dokument beschreibt den aktuellen Stand der Samba-Installation als ersten Dienst.
>
> **Zielgruppe:** Erfahrene Windows-Programmierer, die neu auf Linux sind. Daher werden Linux-Konzepte mit Windows-Pendants verglichen.
>
> **Stand:** April 2026 — Samba läuft, drei User (`nanu`, `dada`, `mama`) sind eingerichtet.

---

## Inhaltsverzeichnis

1. [Architektur-Überblick](#1-architektur-überblick)
2. [Konzept-Mapping Windows ↔ Linux](#2-konzept-mapping-windows--linux)
3. [Verzeichnisstruktur](#3-verzeichnisstruktur)
4. [User & Gruppen](#4-user--gruppen)
5. [Samba-Konfiguration](#5-samba-konfiguration)
6. [Permissions im Detail](#6-permissions-im-detail)
7. [Verbindung vom Endgerät](#7-verbindung-vom-endgerät)
8. [Verwaltungs-Cheatsheet](#8-verwaltungs-cheatsheet)
9. [Troubleshooting](#9-troubleshooting)
10. [Bekannte Lücken & nächste Schritte](#10-bekannte-lücken--nächste-schritte)

---

## 1. Architektur-Überblick

```
┌────────────────────────────────────────────────────────────┐
│  Endgeräte im Heimnetz                                     │
│  Windows-PCs, MacBooks, Smartphones                        │
└──────────────────────────┬─────────────────────────────────┘
                           │ SMB3 (TCP 445)
                           │ Auth: Username + Passwort
                           ▼
┌────────────────────────────────────────────────────────────┐
│  lakehost — Ubuntu Server                                  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Samba (smbd, nmbd) — nativ installiert              │  │
│  │  Config: /etc/samba/smb.conf                         │  │
│  │  User-DB: /var/lib/samba/private/passdb.tdb          │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                    │
│                       ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Linux-Userverwaltung (Source of Truth)              │  │
│  │  /etc/passwd, /etc/group, /etc/shadow                │  │
│  │  Sync mit Samba via 'unix password sync = yes'       │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                    │
│                       ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Storage: /srv/storage/                              │  │
│  │  ├── users/<username>/  (privat, mode 0700)          │  │
│  │  └── family/            (geteilt, mode 2770)         │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**Designprinzipien:**

- **Linux-User = Samba-User:** Es gibt keine getrennte Userdatenbank. Wer auf dem Linux-System existiert und in Gruppe `smbusers` ist, kann Samba nutzen.
- **Passwort-Sync:** Über `unix password sync = yes` führt eine Linux-Passwortänderung automatisch zur Samba-Passwortänderung (sofern via Samba selbst geändert).
- **Service-User ohne Login:** Familienmitglieder haben Login-Shell `/usr/sbin/nologin`. Sie können sich nicht per SSH oder lokal einloggen, nur Samba (und später Dashboard) nutzen.

---

## 2. Konzept-Mapping Windows ↔ Linux

| Windows-Konzept | Linux-Pendant | Wo zu finden |
|---|---|---|
| Lokale Benutzerkonten (`lusrmgr.msc`) | `/etc/passwd` | `getent passwd` |
| Lokale Gruppen | `/etc/group` | `getent group` |
| Passwort-Hashes (SAM) | `/etc/shadow` | nur lesbar als root |
| Service-Konten | User mit Shell `/usr/sbin/nologin` | — |
| NTFS-ACL | POSIX-Permissions (`rwxrwxrwx`) | `ls -la` |
| NTFS-Vererbung | SetGID-Bit auf Verzeichnis (`chmod g+s`) | `ls -la` zeigt `s` statt `x` |
| AD-Domänenpasswort | Linux-Systempasswort + separate Samba-DB | `passwd` / `smbpasswd` |
| `\\server\share` | `//server/share` oder `smb://server/share` | — |
| `net use` | `mount -t cifs` oder `smbclient` | — |
| Computer Management → Shared Folders | `smbstatus` | CLI |
| Event Viewer (Samba-Logs) | `/var/log/samba/*.log` + `journalctl -u smbd` | — |

---

## 3. Verzeichnisstruktur

```
/srv/storage/
├── users/                  # Wurzel aller Privatverzeichnisse
│   ├── nanu/               # owner: nanu:nanu,   mode 0700
│   ├── dada/               # owner: dada:dada,   mode 0700
│   └── mama/               # owner: mama:mama,   mode 0700
└── family/                 # owner: root:family, mode 2770 (SetGID!)
```

**Warum `/srv/storage/` und nicht `/home/`?**
`/srv` ist der vom Linux-FHS (Filesystem Hierarchy Standard) vorgesehene Ort für "site-specific data served by this system". Saubere Trennung von Admin-Homes (`/home/nanu`) und User-Storage. Backup-Skripte können `/srv/storage` als atomare Einheit behandeln.

**Warum SetGID auf `family/`?**
Ohne SetGID gehört eine neue Datei der primären Gruppe des erstellenden Users (z.B. `dada:dada`). Dann könnte `mama` die Datei zwar lesen, aber nicht ändern. Mit SetGID erbt jede neue Datei die Gruppe `family` → alle Familienmitglieder können auf alle Inhalte schreiben.

---

## 4. User & Gruppen

### Gruppen

| Gruppe | Zweck | Mitglieder |
|---|---|---|
| `family` | Schreibzugriff auf `/srv/storage/family` | nanu, dada, mama |
| `smbusers` | Darf Samba überhaupt nutzen (`valid users = @smbusers` in `[global]`) | nanu, dada, mama |
| `nanu` (primary) | Standard-Eigengruppe | nanu |
| `dada` (primary) | Standard-Eigengruppe | dada |
| `mama` (primary) | Standard-Eigengruppe | mama |

### User

| User | Rolle | Login-Shell | Home | Samba-Zugang |
|---|---|---|---|---|
| `nanu` | Admin / Root-Sudoer | `/bin/bash` | `/home/nanu` (Standard-Admin-Home) | ja |
| `dada` | Familie | `/usr/sbin/nologin` | `/srv/storage/users/dada` | ja |
| `mama` | Familie | `/usr/sbin/nologin` | `/srv/storage/users/mama` | ja |

> **Wichtig:** `nanu` hat sein Home unter `/home/nanu` (Standard-Admin-Setup). Sein Samba-`[homes]`-Share zeigt aber auf `/srv/storage/users/nanu` — siehe `path = /srv/storage/users/%S` in der `smb.conf`. Das heißt, der Privat-Storage ist konsistent zwischen allen Usern, unabhängig vom Linux-Home.

### Wie die User angelegt wurden

```bash
# Beispiel für dada (analog für mama)
sudo useradd -m -d /srv/storage/users/dada -s /usr/sbin/nologin -U dada
sudo passwd dada
sudo usermod -aG family,smbusers dada
sudo chown dada:dada /srv/storage/users/dada
sudo chmod 0700 /srv/storage/users/dada
sudo smbpasswd -a dada
sudo smbpasswd -e dada
```

**Erklärung der Flags:**

- `-m` — Home-Verzeichnis anlegen
- `-d` — Pfad explizit setzen (statt `/home/dada`)
- `-s /usr/sbin/nologin` — keine interaktive Shell → kein SSH/Local-Login
- `-U` — gleichnamige primäre Gruppe anlegen
- `usermod -aG` — `-a` (append!) verhindert das Überschreiben bestehender Gruppen
- `smbpasswd -a` — User in Samba-DB neu anlegen
- `smbpasswd -e` — aktivieren

---

## 5. Samba-Konfiguration

**Datei:** `/etc/samba/smb.conf`

```ini
[global]
    workgroup = WORKGROUP
    server string = Holistic Homeserver
    server role = standalone server

    # Sicherheit
    security = user
    map to guest = never

    # Linux- und Samba-Passwort koppeln
    unix password sync = yes
    passwd program = /usr/bin/passwd %u
    passwd chat = *Enter\snew\s*\spassword:* %n\n *Retype\snew\s*\spassword:* %n\n *password\supdated\ssuccessfully* .
    pam password change = yes

    # Nur diese Gruppe darf Samba nutzen
    valid users = @smbusers

    # Performance
    socket options = TCP_NODELAY IPTOS_LOWDELAY
    use sendfile = yes

    # Logging
    log file = /var/log/samba/log.%m
    max log size = 1000
    log level = 1

# Privatordner-Share — automatisch pro User via %S
[homes]
    comment = Privater Ordner von %U
    path = /srv/storage/users/%S
    browseable = no
    read only = no
    create mask = 0600
    directory mask = 0700
    valid users = %S

# Familienordner-Share — geteilt für Gruppe 'family'
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
```

### Wichtige Variablen-Referenz

| Variable | Bedeutung |
|---|---|
| `%S` | Sharename (bei `[homes]` = Username) |
| `%U` | Session-Username (so wie der Client sich angemeldet hat) |
| `%u` | Effektiver Unix-Username nach Mapping |
| `%m` | NetBIOS-Name des Clients (für Logfile-Trennung) |

### Magie von `[homes]`

Der `[homes]`-Block ist Samba's eingebauter Mechanismus für "automatische Privat-Shares". Wenn ein User `\\server\dada` öffnet:

1. Samba prüft erst, ob ein Share namens `dada` explizit definiert ist → nein
2. Samba prüft `[homes]` → der Username `dada` wird als `%S` eingesetzt
3. `path = /srv/storage/users/dada` wird aufgelöst und zugänglich gemacht
4. `valid users = %S` (= `dada`) verhindert, dass jemand anderes auf `\\server\dada` zugreift

**Konsequenz:** Beim Anlegen neuer User muss die `smb.conf` **nicht** angepasst werden. Nur Linux-User + Samba-Passwort + `smbusers`-Gruppe — fertig.

### Validierung

```bash
sudo testparm -s          # Syntax prüfen
sudo testparm             # interaktiv mit Anzeige aller Defaults
```

> **Goldene Regel:** Nach jeder `smb.conf`-Änderung **erst** `testparm`, **dann** `systemctl reload smbd`. Inline-Kommentare hinter Werten (`browseable = no  # Kommentar`) sind verboten und führen zu Startfehlern.

---

## 6. Permissions im Detail

### Privatordner

```
$ ls -ld /srv/storage/users/dada
drwx------ 2 dada dada 4096 Apr 25 19:30 /srv/storage/users/dada
```

- `drwx------` = `0700` → nur Owner darf alles, Gruppe und Welt nichts
- Auch `nanu` als normaler User kann nicht reinschauen — nur via `sudo`
- `create mask = 0600`, `directory mask = 0700` in `[homes]` sorgt dafür, dass neu erstellte Dateien diese Restriktion erben

### Familienordner

```
$ ls -ld /srv/storage/family
drwxrws--- 2 root family 4096 Apr 25 19:30 /srv/storage/family
```

- `drwxrws---` = `2770` → Owner+Gruppe alles, Welt nichts
- Das **`s`** statt `x` bei der Gruppe = SetGID-Bit gesetzt
- Effekt: Neu erstellte Dateien gehören automatisch der Gruppe `family`
- `force group = family` in der Samba-Config verstärkt das auf SMB-Ebene

### Permission-Bits-Cheat-Sheet (für Windows-Programmierer)

```
  Owner   Group   Other
  rwx     rwx     rwx
  421     421     421

Beispiel 0700 = rwx ---- ---- = nur Owner alles, sonst nichts
Beispiel 2770 = rws rwx ---- = Owner+Group alles + SetGID, Other nichts
Beispiel 0644 = rw- r-- r-- = Owner schreiben+lesen, alle nur lesen (Default für Dateien)
Beispiel 0755 = rwx r-x r-x = Owner alles, alle lesen+ausführen (Default für Verzeichnisse)
```

Die führende vierte Stelle:
- `0` — keine Spezialbits
- `1` — Sticky Bit (für `/tmp`)
- `2` — SetGID
- `4` — SetUID

---

## 7. Verbindung vom Endgerät

### Server-Adresse ermitteln

Auf dem Server:
```bash
hostname -I
```

→ z.B. `192.168.1.42`. Statische DHCP-Lease im Router empfehlenswert.

### Windows

**Persistentes Netzlaufwerk:**
1. Explorer → "Dieser PC" → Rechtsklick → "Netzlaufwerk verbinden..."
2. Ordner: `\\192.168.1.42\dada` oder `\\192.168.1.42\family`
3. Häkchen "Verbindung mit anderen Anmeldeinformationen herstellen"
4. Login mit Samba-Username/Passwort

**Per CLI:**
```powershell
net use Z: \\192.168.1.42\dada /user:dada /persistent:yes
```

### macOS

1. Finder → ⌘K → `smb://192.168.1.42`
2. "Registrierter Benutzer", Login-Daten eingeben
3. Share auswählen
4. Auto-Mount: Systemeinstellungen → Anmeldeobjekte → Share hinzufügen

### Linux (Endgerät)

**Permanent via fstab:**
```bash
sudo apt install cifs-utils
sudo mkdir -p /mnt/server/dada

sudo tee /root/.smbcreds-dada > /dev/null <<EOF
username=dada
password=DEIN_PASSWORT
EOF
sudo chmod 600 /root/.smbcreds-dada

echo "//192.168.1.42/dada /mnt/server/dada cifs credentials=/root/.smbcreds-dada,uid=1000,gid=1000,iocharset=utf8,vers=3.0 0 0" | sudo tee -a /etc/fstab

sudo mount -a
```

### Sichtbarkeit der Shares

| User | Sieht beim Browsen `\\server\` | Kann zusätzlich direkt öffnen |
|---|---|---|
| nanu | `family` | `\\server\nanu` |
| dada | `family` | `\\server\dada` |
| mama | `family` | `\\server\mama` |

`[homes]` ist mit `browseable = no` versteckt, deshalb muss der Privatordner direkt per Pfad geöffnet werden. Das ist gewollt: Andere User sehen nicht mal, wie der eigene Share heißt.

---

## 8. Verwaltungs-Cheatsheet

### Status & Monitoring

```bash
# Service-Status
sudo systemctl status smbd nmbd

# Aktive Sessions, geöffnete Dateien, Locks
sudo smbstatus

# Live-Log mitlesen
sudo tail -f /var/log/samba/log.smbd

# Welche Shares würde User XY sehen?
smbclient -L //localhost -U dada
```

### Config-Workflow

```bash
sudo nano /etc/samba/smb.conf       # editieren
sudo testparm                        # validieren
sudo systemctl reload smbd           # ohne Disconnect der Clients
# oder
sudo systemctl restart smbd          # mit Disconnect (selten nötig)
```

### User-Verwaltung

```bash
# Linux-Gruppen eines Users anzeigen
groups dada

# Alle Samba-User auflisten
sudo pdbedit -L

# Detail zu einem Samba-User
sudo pdbedit -L -v -u dada

# Samba-User deaktivieren (ohne löschen)
sudo smbpasswd -d dada

# Samba-User reaktivieren
sudo smbpasswd -e dada

# Samba-Passwort ändern (als root für Admin-Reset)
sudo smbpasswd dada

# Samba-User komplett entfernen (Linux-User bleibt)
sudo smbpasswd -x dada

# Linux-User komplett entfernen (inkl. Home — Vorsicht!)
sudo userdel -r dada
```

### Permissions reparieren

Falls mal Rechte durcheinander geraten sind:

```bash
# Alle Privatordner reparieren
for u in nanu dada mama; do
  sudo chown -R "$u:$u" "/srv/storage/users/$u"
  sudo chmod 0700 "/srv/storage/users/$u"
done

# Familienordner reparieren
sudo chown -R root:family /srv/storage/family
sudo chmod 2770 /srv/storage/family
sudo find /srv/storage/family -type d -exec chmod 2770 {} \;
sudo find /srv/storage/family -type f -exec chmod 0660 {} \;
```

---

## 9. Troubleshooting

### Service startet nicht

```bash
sudo testparm                                       # Config-Syntax?
sudo systemctl status smbd --no-pager -l            # Fehlertext
sudo journalctl -xeu smbd.service --no-pager -n 50  # Detail-Log
```

**Häufigste Ursachen:**

| Symptom im Log | Ursache | Fix |
|---|---|---|
| `value is not boolean!` | Inline-Kommentar hinter Wert | Kommentar in eigene Zeile |
| `Can't find include file` | Tippfehler im Pfad | Pfad korrigieren |
| `unable to open... /srv/storage/...` | Verzeichnis fehlt | `mkdir -p` + `chown` |
| `Address already in use` | Alter Prozess hängt | `sudo pkill smbd; sudo systemctl start smbd` |
| `Unknown parameter encountered` | Tippfehler in Option | Aus `testparm`-Output entnehmen |

### Client kann sich nicht verbinden

| Symptom | Diagnose | Lösung |
|---|---|---|
| "Netzwerkpfad nicht gefunden" | Server unreachable | `ping 192.168.1.42`; Firewall: `sudo ufw status` |
| Login wird abgelehnt | Falsches Passwort oder User disabled | `sudo pdbedit -L -v -u dada` zeigt Status; ggf. `sudo smbpasswd -e dada` |
| Login klappt, aber Share leer | Permissions auf Filesystem | `ls -la /srv/storage/users/dada` als root |
| "Permission denied" beim Schreiben in `family` | User nicht in Gruppe | `sudo usermod -aG family <user>`; **Session neu aufbauen** |
| Windows merkt falsche Credentials | Credential Manager Cache | Systemsteuerung → Anmeldeinformationsverwaltung → Eintrag löschen |
| Verbindung sehr langsam | Default-Settings | siehe Performance-Tipps unten |

### Wichtig nach Gruppen-Änderung

Wenn ein User zu einer neuen Gruppe hinzugefügt wird (z.B. `family`), muss die **Samba-Session vollständig getrennt und neu aufgebaut** werden — Gruppen werden bei Session-Aufbau gelesen, nicht live aktualisiert. Auf dem Server zur Sicherheit:

```bash
sudo smbcontrol all reload-config
# oder härter:
sudo systemctl restart smbd
```

### Performance-Tuning (falls < 50 MB/s im GBit-LAN)

In `[global]` ergänzen:
```ini
    aio read size = 1
    aio write size = 1
    min protocol = SMB3
    max protocol = SMB3_11
```

---

## 10. Bekannte Lücken & nächste Schritte

### Aktueller Stand

✅ Samba läuft, drei User aktiv
✅ Privatordner und Familienordner funktionieren
✅ Gruppenmodell etabliert (`family`, `smbusers`)
✅ Linux-User = Samba-User (Source of Truth)

### Offene Punkte

- ⏳ **Backup-Strategie:** noch keine automatischen Backups von `/srv/storage`. Empfehlung: täglich `rsync` auf externe Platte oder zweiten Server, plus monatlicher Snapshot.
- ⏳ **Provisioning-Skript:** User werden noch manuell angelegt. Nächster Schritt: `holistic-user-add` Skript für einheitliche User-Erstellung (siehe Dashboard-Doku).
- ⏳ **Dashboard:** das geplante Web-Portal für User-Self-Service und Service-Übersicht ist noch nicht implementiert.
- ⏳ **Versionierung:** `/etc/samba/smb.conf` und Skripte gehören in ein Git-Repo (lokal oder Gitea auf dem Server).
- ⏳ **Monitoring:** Disk-Usage-Alerts pro User-Quota fehlen. Aktuell könnte ein einzelner User die ganze Platte vollschreiben.
- ⏳ **TLS / VPN:** Aktuell nur im LAN nutzbar. Externer Zugriff ist nicht vorgesehen — falls doch gewünscht, **niemals** Port 445 ins Internet öffnen, sondern WireGuard oder Tailscale davorschalten.

### Erweiterungs-Ideen

- **Disk-Quotas** (`quota` package) — pro User maximales Volumen festlegen
- **Recycle-Bin via vfs_recycle** — gelöschte Dateien landen in `.Recycle/` statt weg zu sein
- **Snapshots via vfs_shadow_copy2 + ZFS/Btrfs** — Windows "Vorgängerversionen" funktionieren nativ
- **WSDD-Service** — damit der Server in der Windows-Netzwerkumgebung sichtbar ist (sonst muss man die IP eintippen)

---

## Anhang A: Schneller Verifikations-Lauf

Nach jedem Reboot oder größeren Änderung kannst du in unter einer Minute prüfen, ob alles okay ist:

```bash
echo "=== Services ==="
systemctl is-active smbd nmbd

echo -e "\n=== Config valid? ==="
sudo testparm -s 2>&1 | head -20

echo -e "\n=== Listening on port 445? ==="
sudo ss -tlnp | grep :445

echo -e "\n=== Samba-User ==="
sudo pdbedit -L

echo -e "\n=== Storage-Permissions ==="
ls -la /srv/storage/
ls -la /srv/storage/users/

echo -e "\n=== Aktive Sessions ==="
sudo smbstatus -b
```

Lass das gerne als Skript unter `/usr/local/sbin/holistic-samba-check` ablegen — dann ist es ein Einzeiler.

---

## Anhang B: Glossar

- **SMB / CIFS** — Server Message Block / Common Internet File System. Das von Microsoft entwickelte File-Sharing-Protokoll. SMB3 ist die aktuelle Version (verschlüsselt, performant).
- **Samba** — Open-Source-Implementierung von SMB für Linux/Unix. Bietet sowohl Server (`smbd`) als auch Client (`smbclient`).
- **NetBIOS / `nmbd`** — Legacy Name-Resolution-Dienst von SMB. Heute meist überflüssig (DNS reicht), läuft aber per Default mit.
- **PAM** — Pluggable Authentication Modules. Linux-Framework für Authentifizierung. Wird später vom Dashboard genutzt.
- **POSIX** — Standard für Unix-Schnittstellen, inkl. Permission-Modell (`rwx` für owner/group/other).
- **SetGID-Bit** — Spezial-Bit auf Verzeichnissen, das bewirkt, dass neue Dateien die Gruppe des Verzeichnisses erben statt die des erstellenden Users.
- **passdb.tdb** — Samba's Trivial Database mit User-Hashes. Liegt in `/var/lib/samba/private/`.
