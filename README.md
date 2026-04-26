# Holistic Homeserver

Willkommen zum **Holistic Homeserver** Projekt. Dieses Repository (bzw. dieser Workspace) verwaltet die Konfiguration und Vision eines zentralen Ubuntu-Servers für das Heimnetzwerk. 

## Vision & Zielsetzung

Der Holistic Homeserver soll als intelligent verwalteter Knotenpunkt im Heimnetz fungieren, der folgende Hauptanwendungsfälle bedient:
- **Mediaserver:** Zentraler Speicher und Streaming für Familie.
- **Smart Home Manager:** Zentrale Steuerung und Automatisierung des Hauses.
- **Home Game Streamer:** Cloud-Gaming im eigenen Haus.
- **KI-Automatisierung:** Zukünftig sollen Dienste intelligent vernetzt und durch KI verwaltet/automatisiert werden.

Dies soll alles nicht nur für IT-Experten zugänglich sein, sondern benutzerfreundlich über ein eigens entwickeltes [Dashboard](./dashboard/) (Web-Portal) für alle Familienmitglieder bedienbar gemacht werden.

## Architektur & Benutzer

Das System läuft auf einem frisch aufgesetzten Ubuntu-System im Heimnetzwerk (Endgeräte und Server befinden sich im selben Netzwerk).

**Benutzerverwaltung:**
Die Benutzer unseres Homeservers sind direkt (unter der Haube) mit nativen Ubuntu-Benutzern verknüpft, welche für externe Dienste (wie Samba) durchgereicht werden.

Aktuelle Familien-Nutzer:
- `nanu` – Root-User / Administrator
- `dada` – Familienmitglied (Vater)
- `mama` – Familienmitglied (Mutter)

## Projektstruktur

- `/dashboard/` – Beinhaltet das Nutzer-Portal zur simplen Verwaltung von Accounts und Services.
- `/services/` – Beinhaltet die verschiedenen Dienste, die auf dem Homeserver betrieben werden.
  - [`/services/samba/`](./services/samba/) – Der erste aufgesetzte Dienst zur Bereitstellung von Dateifreigaben (Privat- und Familienordner).

Weitere Dienste werden analog als Unterordner in `/services/` hinzugefügt.

## Status

Aktuell (April 2026):
1. **Ubuntu-Basis** ist frisch aufgesetzt.
2. Benutzer (`nanu`, `dada`, `mama`) eingerichtet.
3. Dienst **Samba** ist installiert und konfiguriert, sodass jeder Nutzer private und geteilte Laufwerke hat.
4. **Dashboard-Entwicklung** startet jetzt, um den Nutzern eine Self-Service-Übersicht und Account-Verwaltung (Linux-Passwortänderung) zu bieten.