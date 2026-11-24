# Gute-Nudel-Board

Ein großer Stern für die Klasse. Rechts stehen die Namen der Kinder.
Tippt man einen Namen an, fliegt er in den Stern. Nochmal antippen nimmt ihn wieder heraus.

**Zur Seite:** https://nilsbaumgartner1994.github.io/schule-gute-nudel-board/public/

## Was die Seite kann

- Gruppen bzw. Klassen anlegen (z. B. „Klasse 1a“) und per Tipp wechseln
- Beliebig viele Kinder pro Gruppe, die Schrift im Stern passt sich automatisch an
- Grundschulschrift ABeeZee (freie Web-Version von ABeZeh); ist ABeZeh auf dem Gerät installiert, wird diese genutzt
- Funktioniert offline. Nach dem ersten Aufruf auch ohne Internet, z. B. als App auf dem Home-Bildschirm des iPads
- Nichts wird auf dem Gerät gespeichert: Alle Daten (Gruppen, Stern, Ampel, Einstellungen) stehen
  nur im Link und der Link ändert sich bei jeder Änderung automatisch mit.
- Teilen per Link oder QR-Code, wahlweise mit Namen (genau der aktuelle Stand) oder ohne Namen
  (leere Seite mit Beispielnamen).
  So lässt sich alles am iPad vorbereiten und am Smartboard öffnen.
  Nach jeder Änderung steht der aktuelle Stand automatisch in der Adresszeile.
- Zweite Ansicht „Ampel“ (im Menü umschalten): Oben ein grüner Kasten mit allen Kindern,
  darunter Gelb, Orange und Rot. Namen antippen, dann den Zielkasten antippen.
  Nochmal auf den Namen tippen bricht ab. „Alle auf Grün“ setzt zurück.
- Menü oben links: Stern oder Ampel wählen, Gruppen bearbeiten, Teilen, Stern leeren, Animationen an oder aus

## Für Entwickler

```bash
npm install
npm start      # Vorschau auf http://127.0.0.1:8080
npm test       # Unit- und Browser-Tests
```

Jeder Push auf `main` veröffentlicht die Seite automatisch und wird getestet.
Pull Requests werden getestet und bei grünen Tests automatisch übernommen.
Regeln für KI-Agenten: siehe [AGENTS.md](AGENTS.md).

### Einmalige Einrichtung auf GitHub

Unter *Settings → Pages → Build and deployment*: „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
Die `index.html` im Hauptordner leitet auf die App in `public/` weiter.

## Lizenzen

- Schrift ABeeZee: SIL Open Font License (`public/fonts/OFL-ABeeZee.txt`)
- QR-Code-Generator von Kazuhiko Arase: MIT
