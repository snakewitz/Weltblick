# 🌍 Weltblick

Ein eigenes Geo-Ratespiel im Browser: Du landest an einem zufälligen Ort auf der Welt, schaust dich im 360°-Panorama um, läufst ein Stück und tippst auf der Karte, wo du bist.

## Spielen

👉 **https://snakewitz.github.io/Weltblick/**

Der Mapillary-Token (nur Lese-Rechte) steht in `index.html` bei `MAPILLARY_TOKEN`. Einen neuen bekommst du kostenlos auf https://www.mapillary.com/dashboard/developers.

## Technik

- Straßenbilder: [Mapillary](https://www.mapillary.com) (MapillaryJS 4.1.2, Vektor-Kacheln für die Ortssuche)
- Ratekarte: [Leaflet](https://leafletjs.com) mit Esri / OpenTopoMap / OpenStreetMap
- Alles in einer Datei, kein Build-Schritt nötig
