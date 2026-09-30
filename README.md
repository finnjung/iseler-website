# Autoteile Iseler – Website

Moderner Website-Entwurf für die **Autoteile Iseler GmbH** in Heusenstamm.

## Aktueller Stand
- SEO-Grundlagen, responsive One-Page-Architektur, Light-/Dark-Mode und dezente Animationen
- Öffentlich verifizierte Stammdaten und Unternehmensgeschichte aus der bestehenden Website übernommen (September 2026)
- Rechteseiten: Impressumsdaten übernommen; Datenschutz bleibt ein vor Livegang zu prüfender Entwurf
- Noch offen: neues Logo, Mitarbeiterfotos, WhatsApp-Bot-Link und Freigabe sämtlicher Unternehmensdaten
- Shop ist ausdrücklich nicht Teil des ersten Release, die Struktur ist darauf vorbereitet

## Stand 30.09.2026 (abends): Taste-Skill-Überarbeitung
Gebaut nach den Regeln von [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (`design-taste-frontend`).
- **Dark Mode ist Standard** (Leons Wunsch), Light Mode per Schalter oben rechts, Wahl bleibt im Browser gespeichert
- Hero = Teile-Anfrage im Fahrzeugschein-Look (HSN 2.1, TSN 2.2, FIN E), sendet per WhatsApp oder E-Mail
- **WhatsApp-Button unten rechts** mit dem Bot-Maskottchen von Leon, einmaliger Hinweis als Sprechblase.
  Nummer fehlt noch: `WHATSAPP_NUMBER` oben in `assets/app.js` eintragen. Solange leer, läuft ein Vorschau-Modus.
- Live-Tourenplan für Werkstätten (Bestellschluss 8:45 / 12:30 von der alten Website, **bestätigen lassen**)
- Sortiment als Bento mit KI-generierten Produktfotos (codex, keine Marken sichtbar). Echte Fotos können sie später ersetzen.
- Team-Etiketten mit Platzhaltern (Namen von der alten Website, **aktuell prüfen**), Ladenfront-Platzhalter
- Keine Cookies, kein Tracking, keine Drittanbieter: Schriften (Archivo, IBM Plex Mono) und Phosphor-Icons liegen lokal
  in `assets/fonts` / inline. Deshalb **kein Cookie-Banner nötig**. Datenschutzerklärung entsprechend neu.
- OG-Bild `assets/img/og.jpg` (1200x630). Bei Umzug auf iseler.de die absoluten URLs in `index.html` (og:url, og:image, canonical) anpassen.
- Shooting-Liste: 4 Porträts Hochformat 4:5, Ladenfront Querformat 3:2
- Offen: WhatsApp-Nummer, Öffnungszeiten, Team/KS Tools bestätigen, endgültiger Hoster, Datenschutz rechtlich prüfen
  (inkl. welcher Anbieter hinter dem WhatsApp-Bot steckt)

## Logo
Leon hat das neue Logo am 16.09.2026 per WhatsApp geschickt, nur als PNG (`assets/logo/original-leon-2026-09-16.png`). Am 30.09. mit potrace nach SVG vektorisiert, Farben exakt aus dem PNG:
- `iseler-logo.svg`: Original mit Glanzkante (#0E437E / #2E5B8D, #E00018 / #E94758)
- `iseler-logo-flach.svg`: ohne Glanz, zweifarbig
- `iseler-logo-negativ.svg`: weiß plus rot für dunkle Flächen
- `iseler-logo-weiss.svg` / `iseler-logo-schwarz.svg`: einfarbig
- `iseler-logo-2400.png`: Raster für Social Media
Die Originaldatei (AI/EPS/PDF) der Agentur wäre trotzdem besser. Bei Leon nachfragen.

## Zusammenarbeit
Das GitHub-Repository und dieser Projektstand sind die gemeinsame Quelle für Hermes, Claude und Codex. Dauerhafte Projektfakten sind zusätzlich in OpenViking dokumentiert.

## Vorschau
GitHub Pages veröffentlicht jeden Push auf `main` automatisch.
