# AGENTS.md – Entwicklungshinweise für KI-Assistenten

## Projektübersicht

Obsidian Community Plugin (TypeScript → gebündeltes JavaScript via esbuild).
Liest JW-Kongressprogramme (`.jwpub` / RTF-ZIP) ein und erzeugt Markdown-Notizen.

- Einstiegspunkt: `src/main.ts` → kompiliert nach `main.js`
- Release-Artefakte: `main.js`, `manifest.json`, `styles.css` (mehr nicht – der
  Community-Plugin-Installer lädt aus einem GitHub-Release ausschließlich diese drei
  Dateien; alles andere muss in `main.js` eingebettet sein)

## Umgebung & Toolchain

- Node.js ≥ 18 (LTS empfohlen)
- Paketmanager: **npm**
- Bundler: **esbuild** (`esbuild.config.mjs`) – bettet die sql.js-`.wasm`-Datei via
  `loader: { '.wasm': 'binary' }` als Base64 direkt in `main.js` ein (kein separates
  Artefakt, kein `fs.readFileSync` zur Laufzeit nötig)

```bash
npm install       # Abhängigkeiten
npm run dev       # Watch-Modus
npm run build     # Produktions-Build (tsc-Check + esbuild)
npm run lint      # ESLint
```

## Modulstruktur

```
src/
  main.ts                    # Plugin-Lifecycle (onload/onunload, Commands, Settings, importFile())
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
    NoteBuilder.ts           # Congress → GeneratedNote[] (Ordnernamen, Nummerierung, Übersicht, Notiz-Rendering)
  ui/
    ImportModal.ts           # Dateiauswahl, Zielordner-Dropdown, Vorschau, Import-Bestätigung
scripts/
  analyze-jwpub.mjs          # Entwickler-Tool: DB + HTML ausgeben
  test-parse.mjs             # Entwickler-Test: alle 3 Kongresstypen parsen (eigene, unabhängige Kopie der Parser-Logik!)
```

**Achtung:** `scripts/test-parse.mjs` ist eine eigenständige, dupliziert gehaltene Kopie der
Parser-Logik (nutzt `linkedom` statt echtem `DOMParser`, läuft ohne TypeScript-Kompilierung).
Sie importiert **nicht** `src/parser/JwpubParser.ts`. Bei Änderungen an der Parser-Logik in
`JwpubParser.ts` das Testskript manuell nachziehen, sonst zeigt es veraltetes Verhalten.

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

### sql.js WASM-Ladung (kritisch für Obsidian/Electron)

`initSqlJs()` **ohne** `locateFile`/`wasmBinary` schlägt in Obsidian fehl, weil sql.js die
`.wasm`-Datei nicht im Electron-Renderer-Kontext findet. Lösung:

- `esbuild.config.mjs` setzt `loader: { '.wasm': 'binary' }` – jeder `.wasm`-Import wird
  beim Bundling als Base64-String in `main.js` eingebettet und zur Laufzeit als
  `Uint8Array` bereitgestellt (esbuild-Doku: "binary" loader)
- `JwpubParser.ts` importiert die Datei direkt: `import sqlWasmBinary from 'sql.js/dist/sql-wasm.wasm'`
  und übergibt sie (als `ArrayBuffer` geslict) via `initSqlJs({ wasmBinary })`
- **Kein** `fs.readFileSync`, **kein** `pluginDir`/`getPluginDir()` mehr nötig – funktioniert
  unabhängig vom Installationsweg (manuell kopiert oder über den Community-Plugin-Store),
  da der Store-Installer aus einem Release nur `main.js`, `manifest.json`, `styles.css` lädt
  und eine separate `sql-wasm.wasm`-Datei dort schlicht nie ankäme

### HTML-Parsing (JwpubParser)

- Nutzt `DOMParser` (nativ in Electron; für Tests: `linkedom`)
- Programmpunkte in `<ul class="noMarker noIndent"> > li`
- Sessions durch `<h2>Vormittag</h2>` / `<h2>Nachmittag</h2>` getrennt
- **Lieder** (`itemType: 'song'`): `<li>` hat `a[href^="jwpub://p/X:"]` aber kein
  `a[href^="jwpub://b/NWTR/"]` → werden **nicht** übersprungen, sondern als eigener
  `ProgramItem` mit `songNumber` erfasst (Nummer aus dem Linktext „Lied NNN"). Sie bekommen
  **keine eigene Notiz**, tauchen aber in der Tagesübersicht mit JW-Library-Deeplink auf.
- **„Beantworte die folgenden Fragen"**: ist im jwpub ein **eigenständiges Dokument**
  (kein `<li>` innerhalb eines Tagesprogramms!), erkannt über `<h1>` bzw. `QUESTIONS_RE`
  (`extractQuestionsDocument()`). Wird der `Wiederholungsfragen`-Session des zuletzt
  geparsten Tages angehängt; diese Session wird nach dem Parsing-Loop explizit ans Ende
  von `day.sessions` sortiert (unabhängig von der Dokumentreihenfolge im jwpub).
- CO-Typmarker: `<span class="du-color--…"><strong>TYP:</strong></span>`
- CA-Typmarker: `<p><strong>Typ:</strong></p>` (kein color-span)
- `extractTitle()` strippt den Typ-Prefix **nur** wenn `hasTypeMarker=true`, sonst würde er in Bibelstellen-Colons beißen
- `stripScriptureCitation()` entfernt ein trailing `(Buch Kapitel:Vers[; …])` aus Titeln (Haupttitel **und** Vortragsreihen-/Fragen-Teiltitel via `extractSubParts()`)

### CA vs. CO

| Merkmal | CO | CA |
|---|---|---|
| Tage | Freitag / Samstag / Sonntag | nur Samstag |
| Tagsdokumente | 3 (+ Cover + Info) | 1 (+ Cover + „Beantworte die folgenden Fragen") |
| Tagserkennung | Wochentag in `<h1>` | `.bodyTxt h2` vorhanden → Fallback „Samstag" |
| Kongressmotto | `DocumentMetadata` DocId 0, Key `MEPS:Title` | DocId 1 |
| Typmarker | color-span + strong | nur strong |
| Tagesordner | ja (Freitag/Samstag/Sonntag) | nein – Notizen direkt im Kongressordner |
| „Tag:"-Zeile in Notizen | ja | nein (eintägig, aber Datum kann variieren) |
| Ordnername | `Regionaler Kongress {Jahr} – {Motto}` | `Kreiskongressprogramm {Jahr-1}-{Jahr} – mit dem {Kreisaufseher\|Vertreter des Zweigbüros} – „{Motto}"` |

### Bibelstellen-Format

- jwpub: `jwpub://b/NWTR/book:chapter:verse[-book:chapter:verse]`
- RTF: `BBCCCVVV[-BBCCCVVV]` (z. B. `40005001`)
- Ausgabe: `[Matthäus 5:1](jwlibrary:///finder?bible=40005001)`
- Lieder: `jwlibrary:///finder?pub=sjjm&issue=0&track=NNN` (Annahme, nicht offiziell verifiziert –
  bei Problemen mit dem tatsächlichen JW-Library-Verhalten abgleichen)

### Notiz- & Ordnerbenennung (NoteBuilder)

- **Kein Frontmatter** in Notizen – nur sichtbare Felder (`**Tag:**`, `**Uhrzeit:**`,
  `**Bibeltexte:**`, `**Redner:**`), da der Dateiname bereits der Notiztitel ist
- **Durchnummerierung** pro Tag/Kongress in Programmreihenfolge: `01. Titel.md`, `02. Titel.md`, …
  (Lieder werden bei der Nummerierung übersprungen, `NoteBuilder.buildNotes()`)
- **`00. Übersicht.md`** pro Tag: verlinkt jeden Programmpunkt auf seine Notiz
  (`[[01. Titel|Titel]]`) und jeden Vortragsreihen-/Fragen-Teil direkt auf den passenden
  Abschnitt der übergeordneten Notiz (`[[02. Titel#1. Teiltitel|Teiltitel]]`) – dafür wird
  vor dem Rendern der Übersicht eine `Map<ProgramItem, string>` mit den Basisdateinamen aufgebaut
- **Zeichen-Ersetzung statt Löschung**: für Windows verbotene Zeichen (`< > : " / \ | * ?`)
  werden durch optisch ähnliche Unicode-Zeichen ersetzt (`FS_CHAR_MAP` in `NoteBuilder`),
  damit z. B. ein Fragezeichen am Titelende nicht verschwindet
- **CO**: Tagesordner (Freitag/Samstag/Sonntag) unterhalb des Kongressordners
- **CA**: keine Tagesordner, Notizen direkt im Kongressordner
- Ordner-/Dateinamen dürfen **keinen** `/` enthalten (z. B. Saison als `2026-2027`, nicht `2026/2027` – sonst legt Obsidian ungewollt einen Unterordner an)

## Manifest-Regeln

- `isDesktopOnly: true` (zwingend – Node crypto/zlib; sql.js-WASM ist in `main.js` eingebettet)
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
- Bei Änderungen an `JwpubParser.ts` auch `scripts/test-parse.mjs` synchron halten (duplizierte Logik!)
- Verbotene Dateisystem-Zeichen ersetzen (nicht löschen) – siehe `FS_CHAR_MAP`
- `/` in Ordner-/Dateinamen vermeiden (wird von Obsidian als Pfadtrenner interpretiert)
- Release-Artefakte auf `main.js`, `manifest.json`, `styles.css` beschränken – der
  Community-Plugin-Installer lädt aus einem GitHub-Release nur diese drei Dateien

**Don't**
- `DOMParser` in Node-Skripten direkt nutzen (stattdessen `linkedom` injizieren)
- Bibelstellen aus `BibleCitation`-Tabelle lesen (nutzt interne MEPS-IDs, nicht `BBCCCVVV`)
- `initSqlJs()` ohne `wasmBinary` aufrufen (schlägt in Obsidian lautlos fehl)
- Zusätzliche Dateien neben `main.js`/`manifest.json`/`styles.css` als Laufzeit-Abhängigkeit
  voraussetzen (z. B. per `fs.readFileSync(pluginDir, …)`) – die kommen beim
  Store-Install nie mit; stattdessen per esbuild-Loader in `main.js` einbetten
- Pausen-Einträge in Notizen aufnehmen (Lieder werden inzwischen erfasst, Pausen weiterhin nicht)
