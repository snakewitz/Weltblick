# 🌍 Weltblick

Ein eigenes Geo-Ratespiel im Browser: Du landest an einem zufälligen Ort auf der Welt, schaust dich im 360°-Panorama um, läufst ein Stück und tippst auf der Karte, wo du bist.

## Spielen

1. Kostenlosen Mapillary-Token holen: https://www.mapillary.com/dashboard/developers (App registrieren, nur „Read“, den Token mit `MLY|…` kopieren).
2. `index.html` im Browser öffnen (oder die GitHub-Pages-Seite des Projekts).
3. Token auf der Startseite einfügen – er wird nur lokal im Browser gespeichert.

## Technik

- Straßenbilder: [Mapillary](https://www.mapillary.com) (MapillaryJS 4.1.2, Vektor-Kacheln für die Ortssuche)
- Ratekarte: [Leaflet](https://leafletjs.com) mit Esri / OpenTopoMap / OpenStreetMap
- Alles in einer Datei, kein Build-Schritt nötig
