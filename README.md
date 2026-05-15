# Holistic Homeserver

Willkommen zum **Holistic Homeserver** Projekt. Dieses Repository beinhaltet das zentrale Service-Management sowie das Dashboard für das Heimnetzwerk.

## Architektur & Konzept

Dieses Repository dient als Kernstück des Holistic Homeservers. Es verwaltet das System und stellt ein zentrales Web-Dashboard für alle Nutzer zur Verfügung. 

Die eigentlichen Dienste (wie Mediaserver, Smart Home Manager, etc.) sind aus dieser Repository in separate (ausgelagerte) Repositorien "geoutsourced". Die Integration und Orchestrierung dieser Dienste erfolgt jedoch hier.

Der Unterordner `/services/` enthält **nicht** die vollständigen Quellcodes der einzelnen Dienste, sondern lediglich deren Einbindung in Form von Install-Scripts und Integrationskonfigurationen.

## Installation & Setup

Um den Holistic Homeserver aufzusetzen, klone diese Repository und führe den zentralen Setup-Befehl aus:

```bash
holistic setup
```

Der `holistic setup`-Befehl führt folgende Schritte aus:
1. Einrichtung der Basis-Holistic-Konfiguration.
2. Iteration über alle Dienste im Verzeichnis `/services/`.
3. Ausführen der jeweiligen, service-spezifischen Install-Scripts zur Integration der ausgelagerten Dienste.

## Projektstruktur

- `/dashboard/` – Beinhaltet das Nutzer-Portal zur einfachen Verwaltung von Accounts und Services.
- `/services/` – Beinhaltet die Installations-Skripte und Integrations-Setups für die geoutsourcten Dienste.
