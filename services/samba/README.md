# Samba Service

Dieser Ordner beschreibt das Setup und die Verwaltung des **Samba-Dienstes** für den Holistic Homeserver.

Der Samba-Dienst stellt die grundlegende Dateifreigabe (Media Storage) für alle Familienmitglieder bereit, damit diese von ihren lokalen Endgeräten (Windows, Mac, etc.) aus auf dem Server lesen und schreiben können.

## Dokumentation

Die vollständige technische Beschreibung, Rechteplanung, Architektur und Linux-zu-Windows-Übersetzungen (besonders nützlich für Windows-Programmierer) ist in der Datei [setup.md](./setup.md) dokumentiert.

## Kontext-Überblick für KI und Dashboard

1. **Benutzer-Verknüpfung:** Samba nutzt direkt die nativen Ubuntu-Nutzer (`nanu`, `dada`, `mama`) durch die Samba-User-Gruppe `smbusers` und eine Synchronisation der Passwörter (`unix password sync = yes`).
2. **Ordner-Struktur:**
   - **Personal (Privat):** Jeder Benutzer hat automatisch ein eigenes Laufwerk (z. B. `\\<server>\dada`), auf das nur er Zugriff hat. In Linux gelöst über den Samba `[homes]`-Mechanismus und Ordnerrechte `0700`.
   - **Family (Geteilt):** Es gibt ein geteiltes Familienverzeichnis (`\\<server>\family`), auf das alle Nutzer in der Gruppe `family` zugreifen und reinschreiben können (Linux SetGID `2770`).
3. **Zusammenspiel mit dem Dashboard:** 
   - Das Dashboard muss in der Lage sein, Linux-Passwörter zu aktualisieren. Sobald ein Passwort über das Dashboard geändert wird (`passwd` bzw. `smbpasswd`), greifen diese Änderungen auch für Samba-Logins.
   - Das Dashboard liest die IP-Adresse und Sharenamen (z. B. basierend auf dem eingeloggten Profil) aus, um dem Anwender den direkten Pfad zu seinem SMB-Share anzuzeigen.

Weitere Services werden in der Zukunft als benachbarte Order unter `/services/` angelegt.