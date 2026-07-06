# JW Kongressprogramm – Obsidian Plugin

Ein Obsidian Community Plugin, das offizielle Programmdateien von Kongressen der Zeugen Jehovas einliest und daraus strukturierte, verlinkte Markdown-Notizen im Vault erstellt.

## Funktionen

- **Unterstützte Kongresstypen**
  - `CO` – Regionaler Kongress (Freitag / Samstag / Sonntag)
  - `CA-copgm` – Kreiskongress mit Kreisaufseher (eintägig)
  - `CA-brpgm` – Kreiskongress mit Zweigbüro-Vertreter (eintägig)
- **Primärquelle: `.jwpub`** – vollständige Entschlüsselung (AES-128-CBC + zlib) und HTML-Parsing
- **Fallback: RTF-ZIP** – automatisch, wenn kein jwpub vorliegt
- **Ein eigener Ordner pro Kongress**, benannt nach Kongresstyp, Jahr/Saison und Motto
  - Regionale Kongresse bekommen zusätzlich einen Unterordner je Tag (Freitag/Samstag/Sonntag)
  - Kreiskongresse (eintägig) legen die Notizen direkt im Kongressordner ab
- **Zielordner frei wählbar** beim Import – bestehenden Vault-Ordner auswählen oder neuen anlegen
- **Eine Notiz pro Programmpunkt**, durchnummeriert in Programmreihenfolge (`01.`, `02.`, …)
  - Vortragsreihen erhalten eine Notiz mit einer Überschrift pro Teil
- **„Übersicht"-Notiz pro Tag** (`00. Übersicht.md`) mit dem kompletten Tagesprogramm:
  - jeder Programmpunkt verlinkt auf seine Notiz
  - Vortragsreihen-Teile verlinken direkt auf den passenden Abschnitt in der Notiz
  - Bibeltexte sind inline verlinkt
  - Lieder werden mit JW-Library-Deeplink angezeigt (ohne eigene Notiz)
- **Klickbare Bibelstellen** als JW-Library-Deeplinks in allen Notizen
- **„Beantworte die folgenden Fragen"** (Kreiskongress-Wiederholungsfragen) wird als eigene Notiz mit einer Überschrift pro Frage erzeugt und steht immer an letzter Stelle
- **Pausen** werden nicht in die Notizen aufgenommen

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
3. Zielordner wählen (bestehenden Ordner aus dem Dropdown oder „➕ Neuer Ordner …")
4. Vorschau prüfen (Kongresstyp, Motto, erkannte Tage/Programmpunkte)
5. **Importieren** – der Kongressordner samt Notizen wird angelegt

## Einstellungen

| Einstellung | Standard | Beschreibung |
|---|---|---|
| Zielordner | `Kongress` | Vorbelegter Vault-Ordner, in dem der Kongressordner angelegt wird (pro Import überschreibbar) |
| Sprache | `Deutsch` | Bibelbuch-Namen (DE / EN) |
| Bibelstellen verlinken | An | Erzeugt klickbare `jwlibrary://`-Links |

## Ordner- & Notizstruktur

```
Kongress/
  Regionaler Kongress 2026 – Ewiges Glück/
    Freitag/
      00. Übersicht.md
      01. Ist ewiges Glück möglich.md
      02. Die gute Botschaft von Jesus.md
      ...
    Samstag/
      ...
    Sonntag/
      ...
  Kreiskongressprogramm 2026-2027 – mit dem Kreisaufseher – „Titel"/
    00. Übersicht.md
    01. Warum sollten wir mit ganzem Herzen auf Jehova vertrauen.md
    02. Uns die zum Vorbild nehmen, die auf Jehova vertraut haben.md
    ...
    09. Beantworte die folgenden Fragen.md   ← immer die höchste Nummer (letzte Notiz)
```

## Notiz-Format

Für jeden Programmpunkt (außer Liedern) wird eine eigene, durchnummerierte Notiz erstellt – ohne Frontmatter, mit den relevanten Feldern direkt sichtbar:

```markdown
**Tag:** Freitag           ← nur bei Regionalen Kongressen (mehrtägig)
**Uhrzeit:** 9:40
**Bibeltexte:** [Psalm 16:11](jwlibrary:///finder?bible=19016011) · [Psalm 100:2](jwlibrary:///finder?bible=19100002)
**Redner:**


```

Vortragsreihen erhalten eine Notiz mit einer Überschrift je Teil (die Übersicht verlinkt direkt dorthin):

```markdown
**Uhrzeit:** 11:15
**Bibeltexte:** [Matthäus 8:16–17](jwlibrary:///finder?bible=40008016-40008017) · …

## 1. „Er hat unsere Krankheiten auf sich genommen"
**Bibeltexte:** [Matthäus 8:16, 17](jwlibrary:///finder?bible=40008016-40008017) · …
**Redner:**


## 2. „Er wird weder streiten noch laut rufen"
…
```

Die **Übersicht** (`00. Übersicht.md`) listet den kompletten Tag mit Links:

```markdown
## Vormittag
- **9:30** – [Lied 160](jwlibrary:///finder?pub=sjjm&issue=0&track=160)
- **9:40** – [[01. Ist ewiges Glück möglich|Ist ewiges Glück möglich]] — [Psalm 16:11](jwlibrary:///finder?bible=19016011)
- **11:15** – [[03. Messianische Prophezeiungen erfüllt|Messianische Prophezeiungen erfüllt]]
  - [[03. Messianische Prophezeiungen erfüllt#1. „Er hat unsere Krankheiten auf sich genommen"|1. „Er hat unsere Krankheiten auf sich genommen"]]
  - …
```

## Technische Details

- **Entschlüsselung:** `sha256(cardString)` XOR Konstante → AES-128-CBC-Key + IV
- **sql.js läuft mit eingebettetem WASM-Binary**: die `.wasm`-Datei wird beim Build per esbuild-`binary`-Loader als Base64 direkt in `main.js` eingebettet (kein Netzwerkzugriff, keine separate Datei nötig – wichtig, da der Community-Plugin-Installer aus einem Release nur `main.js`, `manifest.json` und `styles.css` lädt)
- **Parser-Strategie:** DOMParser (nativ in Electron) über den entschlüsselten HTML-Content
- **Bibelstellen:** direkt aus `<a href="jwpub://b/NWTR/...">` Links im HTML
- **Lieder:** erkannt über `<a href="jwpub://p/X:...">` ohne begleitenden Bibel-Link; Liednummer aus dem Linktext (`Lied NNN`)
- **„Beantworte die folgenden Fragen"** ist im jwpub ein eigenständiges Dokument (kein Listenpunkt) und wird separat erkannt und der zugehörigen Tages-Session zugeordnet
- **Dateinamen:** für Windows verbotene Zeichen (`? " : / \ | * < >`) werden durch optisch ähnliche Unicode-Zeichen ersetzt statt gelöscht, damit z. B. Fragezeichen im Titel erhalten bleiben
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
    NoteBuilder.ts           # Datenmodell → Markdown-Notizen (Ordnernamen, Nummerierung, Übersicht)
  ui/
    ImportModal.ts           # Import-Dialog mit Zielordner-Auswahl & Vorschau
```

## Lizenz

0-BSD – siehe [LICENSE](LICENSE)
