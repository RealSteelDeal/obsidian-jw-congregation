# AGENTS.md – Entwicklungshinweise für KI-Assistenten

## Projektübersicht

Obsidian Community Plugin (TypeScript → gebündeltes JavaScript via esbuild).
Liest JW-Kongressprogramme (`.jwpub` / RTF-ZIP) ein und erzeugt Markdown-Notizen.

- Einstiegspunkt: `src/main.ts` → kompiliert nach `main.js`
- Release-Artefakte: `main.js`, `manifest.json`, `styles.css`

## Umgebung & Toolchain

- Node.js ≥ 18 (LTS empfohlen)
- Paketmanager: **npm**
- Bundler: **esbuild** (`esbuild.config.mjs`)

```bash
npm install       # Abhängigkeiten
npm run dev       # Watch-Modus
npm run build     # Produktions-Build (tsc-Check + esbuild)
npm run lint      # ESLint
```

## Modulstruktur

```
src/
  main.ts                    # Plugin-Lifecycle (onload/onunload, Commands, Settings)
  settings.ts                # JwPluginSettings, DEFAULT_SETTINGS, JwSettingTab
  models/congress.ts         # Typen: Congress, Day, Session, ProgramItem, Scripture
  normalizer/
    bookNames.ts             # Buchnamenstabelle 1–66, DE + EN
    ScriptureNormalizer.ts   # fromJwpub(), fromRtf(), toJwLibraryLink(), toMarkdownLink()
  parser/
    JwpubParser.ts           # .jwpub → Congress (primär, AES+zlib+DOMParser)
    RtfParser.ts             # RTF-ZIP → Congress (Fallback)
    SourceRouter.ts          # Dateiformat erkennen, Router jwpub → rtf
  builder/
    NoteBuilder.ts           # Congress → GeneratedNote[] (Markdown)
  ui/
    ImportModal.ts           # Dateiauswahl, Vorschau, Import-Bestätigung
scripts/
  analyze-jwpub.mjs          # Entwickler-Tool: DB + HTML ausgeben
  test-parse.mjs             # Entwickler-Test: alle 3 Kongresstypen parsen
```

## Wichtige Implementierungsdetails

### jwpub-Entschlüsselung

Schlüsselableitung aus `Publication`-Tabelle der SQLite-DB:

```
cardString = MepsLanguageIndex + "_" + Symbol + "_" + Year
             [+ "_" + IssueTagNumber  falls != 0]
key/iv     = sha256(cardString) XOR 0x11cbb5...ada7  →  [0:16] / [16:32]
Content    = AES-128-CBC decrypt → zlib inflate → UTF-8 HTML
```

**Achtung:** `sql.js` gibt `IssueTagNumber` als String zurück → immer `Number()` casten.

### HTML-Parsing (JwpubParser)

- Nutzt `DOMParser` (nativ in Electron; für Tests: `linkedom`)
- Programmpunkte in `<ul class="noMarker noIndent"> > li`
- Sessions durch `<h2>Vormittag</h2>` / `<h2>Nachmittag</h2>` getrennt
- Lieder/Musik überspringen: `<li>` hat `a[href^="jwpub://p/X:"]` aber kein `a[href^="jwpub://b/NWTR/"]`
- CO-Typmarker: `<span class="du-color--…"><strong>TYP:</strong></span>`
- CA-Typmarker: `<p><strong>Typ:</strong></p>` (kein color-span)
- `extractTitle()` strippt den Typ-Prefix **nur** wenn `hasTypeMarker=true`, sonst würde er in Bibelstellen-Colons beißen

### CA vs. CO

| Merkmal | CO | CA |
|---|---|---|
| Tage | Freitag / Samstag / Sonntag | nur Samstag |
| Tagsdokumente | 3 (+ Cover + Info) | 1 (+ Cover + Q&A) |
| Tagserkennung | Wochentag in `<h1>` | `.bodyTxt h2` vorhanden → Fallback „Samstag" |
| Kongressmotto | `DocumentMetadata` DocId 0, Key `MEPS:Title` | DocId 1 |
| Typmarker | color-span + strong | nur strong |

### Bibelstellen-Format

- jwpub: `jwpub://b/NWTR/book:chapter:verse[-book:chapter:verse]`
- RTF: `BBCCCVVV[-BBCCCVVV]` (z. B. `40005001`)
- Ausgabe: `[Matthäus 5:1](jwlibrary:///finder?bible=40005001)`

## Manifest-Regeln

- `isDesktopOnly: true` (zwingend – Node crypto/zlib)
- `id` niemals nach Release ändern
- `minAppVersion` aktuell halten

## Testing

Manuell in Obsidian:

```
<Vault>/.obsidian/plugins/jw-congregation-program/
  main.js
  manifest.json
  styles.css
```

Skripte (Node, ohne Obsidian):

```bash
node scripts/analyze-jwpub.mjs <datei.jwpub>
node scripts/test-parse.mjs
```

`scripts/out/` ist in `.gitignore` – kein urheberrechtlich geschütztes Material committen.

## Do / Don't

**Do**
- `Number()` beim Lesen von sql.js-Integer-Feldern die als String kommen können
- `hasTypeMarker` in `extractTitle()` übergeben
- `scripts/out/` nie committen

**Don't**
- `DOMParser` in Node-Skripten direkt nutzen (stattdessen `linkedom` injizieren)
- Bibelstellen aus `BibleCitation`-Tabelle lesen (nutzt interne MEPS-IDs, nicht `BBCCCVVV`)
- Lied-/Pause-Einträge in Notizen aufnehmen
