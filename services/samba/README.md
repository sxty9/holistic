# Samba Service Integration

Dieser Ordner enthält die Integrations- und Setup-Skripte für den **Samba-Dienst**. 

Da die eigentliche Dienst-Implementierung und tiefergehende Dokumentation in ein separates Repository ausgelagert ist, finden sich hier ausschließlich die Skripte zur automatisierten Einrichtung dieses Services auf dem Holistic Homeserver.

## Setup im Rahmen des Holistic Homeservers

Die Einrichtung von Samba wird automatisch ausgeführt, wenn der Basis-Setup-Befehl des Systems aufgerufen wird:

```bash
holistic setup
```

Während der Iteration dieses Setups wird das hier liegende Installations-Skript getriggert. Es übernimmt die grundlegende Konfiguration von Samba auf dem System:

1. **Benutzer-Verknüpfung:** Synchronisation der nativen Ubuntu-Benutzer mit der Samba-Konfiguration.
2. **Ordner-Netzwerkfreigaben:**
   - Bereitstellung persönlicher (privater) Netzwerklaufwerke pro Nutzer.
   - Bereitstellung von geteilten Bereichslaufwerken für berechtigte Gruppen (z. B. Family-Shares).

## Dashboard Interaktion

Das Dashboard integriert diesen Dienst wie folgt:
- Darstellung der korrekten SMB-Netzwerkpfade (z.B. `\\<Server-IP>\<Benutzername>`) für den jeweils angemeldeten Benutzer.
- Durchreichen von Passwortaktualisierungen (Ändert ein Benutzer über das Dashboard sein Passwort, so wird dieses implizit für den SMB-Zugriff mit angepasst).
