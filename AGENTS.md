# Hinweise für KI-Agenten (Claude, Codex und andere)

Dieses Projekt wird von Lehrkräften genutzt, die sich nicht mit GitHub auskennen müssen.
Deshalb gilt hier ein bewusst einfacher Ablauf.

## Arbeitsweise

- **Direkt auf `main` pushen ist ausdrücklich erlaubt und erwünscht.**
  Kein Umweg über Pull Requests nötig. Jeder Push auf `main` veröffentlicht die Seite
  automatisch als GitHub Page (Einstellung „Deploy from a branch“, `main`, Ordner `/`).
  Die Datei `index.html` im Hauptordner leitet nur nach `public/` weiter.
- Vor dem Push immer die Tests laufen lassen: `npm install` und dann `npm test`.
  Schlagen Tests fehl, erst reparieren, dann pushen. Tests niemals abschalten, um grün zu werden.
- Wird doch ein Pull Request geöffnet, prüft `.github/workflows/ci.yml` ihn und übernimmt ihn
  automatisch in `main`, sobald die Tests grün sind (außer er ist als Entwurf markiert).
- Commit-Nachrichten kurz und verständlich, gerne auf Deutsch.

## Aufbau

- `public/` ist die komplette Seite. Kein Build-Schritt, reines HTML, CSS und JavaScript (ES-Module).
  - `index.html`: Grundgerüst, Menü und Dialoge
  - `js/app.js`: Bedienung, Speicherung, Fluganimation, Teilen
  - `js/codec.js`: Gruppen kompakt in die URL schreiben und daraus lesen (deflate-raw und base64url)
  - `js/shapes.js`: Form in der Mitte (Stern) und Verteilung der Namen darin.
    Neue Formen (z. B. Kreis) hier in `SHAPES` ergänzen.
  - `sw.js`: Service Worker für Offline first (erst Netz, dann Speicher). Neue Dateien in `FILES` eintragen!
  - `fonts/`: Schrift ABeeZee (freie Web-Version der Grundschulschrift ABeZeh), lokal eingebunden
  - `vendor/qrcode.mjs`: QR-Code-Erzeugung (MIT), lokal eingebunden
- `tests/`: Unit-Tests (`*.test.mjs`) und Browser-Tests mit Playwright (`app.e2e.test.mjs`)
- `scripts/serve.mjs`: lokale Vorschau mit `npm start` (http://127.0.0.1:8080)

## Grundsätze

- Alles bleibt offline nutzbar. Keine externen Server, CDNs oder Tracker einbinden.
- Daten nur lokal (localStorage). Teilen geschieht ausschließlich über den Link im URL-Hash.
- Der Inhalt des Sterns wird absichtlich nicht in den Link geschrieben, nur die Gruppen.
- Oberfläche schlicht halten, große Schaltflächen, Texte auf Deutsch.
- Das Link-Format ist versioniert (`1z…`). Bei Änderungen am Format eine neue Version einführen
  und alte Links weiter lesen können.
