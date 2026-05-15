# Holistic Dashboard

Dieses Verzeichnis enthält die Implementierung des **Holistic Dashboards** – des zentralen Nutzer-Portals für den Homeserver.

## Vision und Nutzen

Das Dashboard bietet einen benutzerfreundlichen, zentralen Einstiegspunkt im Heimnetzwerk. Es ist so gestaltet, dass auch Personen ohne IT-Kenntnisse die angebundenen Dienste einsehen und ihre eigenen Konten verwalten können.

## Features

1. **Zentraler Login**
   - Nutzer melden sich mit ihrem Homeserver-Benutzernamen und Passwort an.
   - Die Authentifizierung ist direkt mit den nativen Linux-Benutzern des Servers verknüpft.

2. **Dienste-Übersicht (Services)**
   - Anzeige aller aktiven, in den Homeserver integrierten Dienste.
   - Das Dashboard liest die Informationen der geoutsourcten Dienste aus (z.B. Dateifreigaben, Smart Home Anbindungen) und stellt sie anwendergerecht dar.

3. **Service-Informationen & Optionen**
   - Zu jedem Dienst werden relevante Zugangsdaten und Links zur Nutzung bereitgestellt (z. B. Netzwerkpfade für Dateifreigaben oder Weblinks zu anderen Dashboards).

4. **Account-Verwaltung**
   - Nutzer können ihre Account-Informationen eigenständig verwalten.
   - Beispielsweise resultiert eine Passwortänderung im Dashboard in einer direkten Synchronisation der entsprechenden Passwörter auf Betriebssystemebene.
