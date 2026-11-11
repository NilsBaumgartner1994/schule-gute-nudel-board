# Gute-Nudel-Board

Ein großer Stern für die Klasse. Rechts stehen die Namen der Kinder.
Tippt man einen Namen an, fliegt er in den Stern. Nochmal antippen nimmt ihn wieder heraus.

**Zur Seite:** https://nilsbaumgartner1994.github.io/schule-gute-nudel-board/

## Was die Seite kann

- Gruppen bzw. Klassen anlegen (z. B. „Klasse 1a“) und per Tipp wechseln
- Beliebig viele Kinder pro Gruppe, die Schrift im Stern passt sich automatisch an
- Grundschulschrift (Andika mit dem geschriebenen a)
- Funktioniert offline. Nach dem ersten Aufruf auch ohne Internet, z. B. als App auf dem Home-Bildschirm des iPads
- Alle Daten bleiben nur auf dem Gerät
- Teilen per Link oder QR-Code: Der Link enthält alle Gruppen in kurzer, gepackter Form.
  So lässt sich alles am iPad vorbereiten und am Smartboard öffnen.
  Nach jeder Änderung steht der aktuelle Stand automatisch in der Adresszeile.
- Menü oben links: Gruppen bearbeiten, Teilen, Stern leeren, Animationen an oder aus

## Für Entwickler

```bash
npm install
npm start      # Vorschau auf http://127.0.0.1:8080
npm test       # Unit- und Browser-Tests
```

Jeder Push auf `main` testet und veröffentlicht die Seite automatisch.
Pull Requests werden getestet und bei grünen Tests automatisch übernommen.
Regeln für KI-Agenten: siehe [AGENTS.md](AGENTS.md).

### Einmalige Einrichtung auf GitHub

Unter *Settings → Pages → Build and deployment → Source* „GitHub Actions“ auswählen.

## Lizenzen

- Schrift Andika: SIL Open Font License (`public/fonts/OFL-Andika.txt`)
- QR-Code-Generator von Kazuhiko Arase: MIT
