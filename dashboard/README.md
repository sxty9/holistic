# Holistic Dashboard

Dieses Verzeichnis enthält die Planung und (künftige) Implementierung des **Holistic Dashboards**.

## Vision
Damit Familienmitglieder ohne IT-Kenntnisse ihre Dienste managen können, wird dieses Portal als zentraler Einstiegspunkt im Heimnetzwerk bereitgestellt. Es richtet sich an alle Endanwender des Homeservers (z. B. `dada`, `mama` sowie den Admin `nanu`).

## Features (Geplant)

1. **Zentraler Login**
   - Jeder Nutzer meldet sich mit seinem Homeserver-Benutzernamen und Passwort an.
   - Da das System eng mit den Ubuntu-Benutzern verknüpft ist, entspricht dies den Linux-Credentials des jeweiligen Users.

2. **Dienste-Übersicht (Services)**
   - Auf einer modernen und simplen Oberfläche werden alle aktiven Dienste dargestellt.
   - Anfangs gibt es nur den Dienst **Samba** (Dateifreigabe). Zukünftig folgen Mediaserver, Smart Home Manager und Game Streamer.

3. **Service-Informationen & Optionen**
   - Wenn der Nutzer auf einen Dienst (z. B. Samba) klickt, sieht er direkt relevante Informationen.
   - Beispiel Samba: Es wird angezeigt, über welche konkrete Netzwerkadresse (z.B. `\\<Server-IP>\dada` oder `smb://<Server-IP>/dada`) der Nutzer seine Medien auf dem eigenen Gerät (PC, Mac, Smartphone) einhängen kann.

4. **Account-Verwaltung**
   - Nutzer können ihre Account-Informationen wie ihr Passwort ändern.
   - **Ganz wichtig (Systeminteraktion):** Wenn ein Nutzer hier sein Passwort ändert, muss das Dashboard die entsprechenden Änderungen für den Linux-Benutzer auf Betriebssystemebene vornehmen (z. B. Abstimmung mit `/etc/passwd`, `/etc/shadow` und der Samba-Passwort-Datenbank).

## Technologie
*Hinweis für die weitere Umsetzung: Hier werden in Zukunft Details zum Stack (Frontend-Framework, Backend-Sprache, Anbindung an Linux-Systembefehle via z.B. Node.js/Python) hinterlegt.*