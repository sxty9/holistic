# Holistic Homeserver – System Context & Vision (For Claude Code)

Dieser Dokument fasst die gesamte Vision, die aktuelle Architektur und das bestehende Wissen zum "Holistic Homeserver" Projekt zusammen. Es dient als Einstiegspunkt für Claude Code, um nahtlos die Weiterentwicklung zu übernehmen.

## 1. Vision & Zielsetzung
Der **Holistic Homeserver** ist als zentraler, intelligenter Knotenpunkt für das Heimnetzwerk konzipiert. 
- **Zweck:** Bereitstellung von Netzwerkdiensten wie Mediaserver (Dateifreigabe), Smart Home Management, Home Game Streaming und künftig KI-Automatisierungen.
- **Zielgruppe:** Die gesamte Familie. Endanwender (ohne IT-Wissen) nutzen ausschließlich ein **Web-Dashboard**, um Accounts zu verwalten und Dienst-Informationen abzurufen.
- **Betriebssystem:** Natives Ubuntu-Linux (z.B. Hostname `lakehost`), direkt im Heimnetz eingebunden.

## 2. Architektur & "Outsourcing"-Konzept
Das Projekt folgt einer strikten Trennung zwischen dem *Management* und den *Diensten* selbst:

1. **Dieses Kern-Repository (`holistic/`)** 
   - Beinhaltet das **Dashboard** (Self-Service Web-Portal).
   - Beinhaltet die **Service-Orchestrierung**. Alle Dienste werden über einen zentralen Befehl (`holistic setup`) auf dem Ubuntu-Host installiert.
2. **Die Services (ausgelagert)**
   - Die eigentliche Implementierung (oder Docker-Files, tiefe Konfigs) externer Tools (wie Mediaserver, Smart Home) liegen in *separaten Repositories*.
   - Im Kern-Repo (hier) liegt unter `/services/<dienstname>/` **ausschließlich** die Einbindung (z. B. ein `install.sh` Skript), welches vom `holistic setup` iteriert und aufgerufen wird.

## 3. Die System-Nutzer (OS-Level Integration)
Das System nutzt **keine separate Datenbank für Benutzer**!
- Familienmitglieder (`dada`, `mama` etc.) sind **native Ubuntu-Linux-Nutzer**. Sie bekommen die Shell `/usr/sbin/nologin` (kein SSH/Konsolenzugang).
- Das Dashboard authentifiziert die Nutzer gegen PAM/Linux (`/etc/shadow`).
- Ändert ein Nutzer sein Passwort im Dashboard, ändert das Dashboard das tatsächliche Linux-Passwort (z. B. via `passwd`).

## 4. Der erste Service: Samba (Dateifreigabe)
Samba ist direkt (ohne Wrapper) in den Holistic Server integriert und stellt Netzwerklaufwerke bereit. Dies ist funktionsfähig und als `install.sh` unter `services/samba/install.sh` definiert.

**Samba-Konzepte:**
- **OS-Passwort-Sync:** `unix password sync = yes` in Samba sorgt dafür, dass Linux- und Samba-Passwörter synchron gehalten werden. (Wichtig für das Dashboard).
- **Gruppen:** Alle berechtigten Nutzer sind in der Linux-Gruppe `smbusers` (generelle Samba-Erlaubnis) und `family` (Schreibrechte auf geteilte Laufwerke).
- **Storage-Architektur:**
  - `/srv/storage/users/<username>` (Modus `0700`): Privates Laufwerk. Wird automatisch über den `[homes]`-Block in Samba bereitgestellt.
  - `/srv/storage/family` (Modus `2770`, bedingt SetGID-Bit): Geteiltes Laufwerk. Jede dort neu erstellte Datei gehört automatisch der Gruppe `family`.

## 5. Repository Struktur (Aktueller Stand)
```text
/
├── README.md                  # Projektübersicht & ganzheitliches Setup-Konzept
├── dashboard/
│   └── README.md              # Vision des Nutzer-Portals (Login, Anzeige der Laufwerkspfade, Account-Verwaltung)
├── services/
│   └── samba/
│       ├── README.md          # Info zur Samba-Integration
│       └── install.sh         # Automatisiertes Setup für APT, Ordner, Permissions und smb.conf
└── CLAUDE_CONTEXT.md          # DIESE DATEI
```

## 6. Nächste Schritte & Aufgabe für Claude
Claude sollte an folgenden Punkten ansetzen:

1. **Das `holistic setup` Tool:** 
   - Implementierung eines CLI-Tools oder Bash-Wrappers (`holistic setup`), welches das System vorbereitet und alle Skripte unter `/services/*/install.sh` iterativ ausführt.
2. **Dashboard Entwicklung:**
   - Stack-Entscheidung (z.B. Node.js/Next.js oder Python/FastAPI) für das Dashboard.
   - Implementierung des Logins (Validierung gegen Linux OS).
   - Implementierung der Passwort-Änderung (Aufruf von Native-Befehlen unter der Haube zur Synchronisation von `/etc/passwd` und Samba-DB).
   - Auslesen der IP und Samba-Config, um den Usern im Frontend direkt klickbare/kopierbare Netzwerkpfade anzuzeigen (z. B. `\\192.168.1.100\dada`).
3. **User Provisioning:**
   - Ein Skript oder Dashboard-Feature (für den Admin), um neue Familienmitglieder systemweit einheitlich anzulegen (Linux-User erstellen, `/srv/storage/users/$USER` anlegen, in Gruppen `smbusers/family` stecken).