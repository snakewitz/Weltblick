# 🕹️ Geo Arcade

Interaktive Lernkarte im Arcade-Look: Klick auf ein Land mit Street-View-Abdeckung und sieh, woran du es erkennst – Kamera & Google-Auto, Schrift, Kennzeichen, Poller, Straßenmarkierungen, Masten, Schilder und Landschaft.

👉 **https://snakewitz.github.io/Weltblick/**

- 134 Länder und Gebiete (kleine Gebiete als Quadrate auf der Karte)
- Suche, Zufallsland, Filter nach Kontinent
- Fortschritt „Gelernt“ wird im Browser gespeichert
- Arcade-Intro: durch die Spielhalle zum Automaten laufen, Münze einwerfen, in den Bildschirm zoomen (überspringbar, `?nointro` schaltet es ab)

## Quelle

Die Erkennungsmerkmale sind in eigenen Worten auf Deutsch zusammengefasst nach den Länder-Guides von [Plonk It](https://www.plonkit.net/guide). Für Details und Beispielbilder führt jedes Land direkt zum passenden Plonkit-Guide.

## Aufbau

- `index.html` – Karte (D3 + world-atlas) und Oberfläche
- `data/meta.js` – Grunddaten (Name, Kontinent, Fahrseite, Domain)
- `data/*.js` – Zusammenfassungen je Kontinent
- `intro.js`, `intro.css` – Arcade-Intro (Szene aus CSS, Sound per Web Audio)
- `lib/` – d3, topojson-client und Weltkarte (lokal, kein CDN nötig)
