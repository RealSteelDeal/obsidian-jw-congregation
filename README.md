# JW Kongressprogramm – Obsidian Plugin

Ein Obsidian Community Plugin, das offizielle Programmdateien von Kongressen der Zeugen Jehovas einliest und daraus strukturierte Markdown-Notizen im Vault erstellt.

## Funktionen

- **Unterstützte Kongresstypen**
  - `CO` – Regionaler Kongress (Freitag / Samstag / Sonntag)
  - `CA-copgm` – Kreiskongress mit Kreisaufseher (eintägig)
  - `CA-brpgm` – Kreiskongress mit Zweigbüro-Vertreter (eintägig)
- **Primärquelle: `.jwpub`** – vollständige Entschlüsselung (AES-128-CBC + zlib) und HTML-Parsing
- **Fallback: RTF-ZIP** – automatisch, wenn kein jwpub vorliegt
- **Eine Notiz pro Programmpunkt** (Vortragsreihen: eine Notiz mit Überschriften pro Teil)
- **Klickbare Bibelstellen** als JW-Library-Deeplinks
- **Lieder und Pausen** werden nicht in die Notizen aufgenommen

## Voraussetzungen

- Obsidian ≥ 1.4.0
- **Nur Desktop** (Node-Crypto & zlib sind Electron-APIs)

## Installation

### Manuell (Entwicklung / Test)

1. Repository klonen oder herunterladen
2. `npm install` im Projektordner
3. `npm run build` (einmalig) oder `npm run dev` (Watch-Modus)
4. `main.js`, `manifest.json` und `styles.css` in den Plugin-Ordner des Vaults kopieren:
   ```
   <Vault>/.obsidian/plugins/jw-congregation-program/
   ```
5. Obsidian neu laden → **Einstellungen → Community-Plugins → Plugin aktivieren**

### Community Plugin Store

> Noch nicht veröffentlicht – befindet sich in Entwicklung.

## Nutzung

1. **Ribbon-Icon** (Buchsymbol) oder **Befehlspalette** → „Kongressprogramm importieren"
2. Programmdatei auswählen (`.jwpub` oder RTF-ZIP)
3. Vorschau prüfen (Kongresstyp, Motto, erkannte Tage/Programmpunkte)
4. **Importieren** – Notizen werden im konfigurierten Zielordner angelegt

## Einstellungen

| Einstellung | Standard | Beschreibung |
|---|---|---|
| Zielordner | `Kongress` | Ordner im Vault für die generierten Notizen |
| Sprache | `Deutsch` | Bibelbuch-Namen (DE / EN) |
| Bibelstellen verlinken | An | Erzeugt klickbare `jwlibrary://`-Links |

## Notiz-Format

Für jeden Programmpunkt (außer Lieder/Pausen) wird eine eigene Notiz erstellt:

```markdown
---
typ: CO
motto: "Ewiges Glück"
motto_bibelstelle: "Matthäus 5:3"
tag: Freitag
jahr: 2026
programmpunkt: "Ist ewiges Glück möglich?"
uhrzeit: "9:40"
typ_detail: talk
---

# Ist ewiges Glück möglich?

**Bibeltexte:** [Psalm 16:11](jwlibrary:///finder?bible=19016011) · [Psalm 100:2](jwlibrary:///finder?bible=19100002)



```

Vortragsreihen erhalten eine Notiz mit Überschriften je Teil:

```markdown
# Messianische Prophezeiungen erfüllt!

## 1. „Er hat unsere Krankheiten auf sich genommen"
**Bibeltexte:** [Matthäus 8:16, 17](jwlibrary:///finder?bible=40008016-40008017) · …



## 2. „Er wird weder streiten noch laut rufen"
…
```

## Technische Details

- **Entschlüsselung:** `sha256(cardString)` XOR Konstante → AES-128-CBC-Key + IV
- **Parser-Strategie:** DOMParser (nativ in Electron) über den entschlüsselten HTML-Content
- **Bibelstellen:** direkt aus `<a href="jwpub://b/NWTR/...">` Links im HTML
- **Keine Netzwerkanfragen** – verarbeitet ausschließlich lokale Nutzerdateien
- **Kein urheberrechtlich geschütztes Material** im Repository

## Entwicklung

```bash
npm install      # Abhängigkeiten installieren
npm run dev      # Watch-Modus (esbuild)
npm run build    # Produktions-Build (TypeScript-Check + esbuild)
npm run lint     # ESLint
```

Analyse-Skripte für Entwicklung & Debugging:

```bash
node scripts/analyze-jwpub.mjs <datei.jwpub>   # DB-Metadaten + HTML ausgeben
node scripts/test-parse.mjs                     # Alle 3 Kongresstypen parsen (braucht Dateien)
```

## Dateistruktur

```
src/
  main.ts                    # Plugin-Einstiegspunkt
  settings.ts                # Einstellungen
  models/
    congress.ts              # Datenmodell (Congress, Day, ProgramItem, …)
  normalizer/
    ScriptureNormalizer.ts   # Bibelstellen-Normalisierung & Link-Erzeugung
    bookNames.ts             # Buchnamenstabelle DE / EN
  parser/
    JwpubParser.ts           # jwpub → Datenmodell (primär)
    RtfParser.ts             # RTF-ZIP → Datenmodell (Fallback)
    SourceRouter.ts          # Format-Erkennung & Routing
  builder/
    NoteBuilder.ts           # Datenmodell → Markdown-Notizen
  ui/
    ImportModal.ts           # Import-Dialog mit Vorschau
```

## Lizenz

0-BSD – siehe [LICENSE](LICENSE)
