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
  analyze-jwpub.mjs          # Entwickler-Tool: DB + HTML ausgeben (eigenständiges, einfaches Decrypt, keine Parser-Logik)
  test-parse.mjs             # Entwickler-Test: importiert den echten JwpubParser per jiti und parst übergebene .jwpub-Dateien
```

**`scripts/test-parse.mjs`** importiert `src/parser/JwpubParser.ts` direkt über `jiti`
(TypeScript-Ausführung in Node ohne separaten Build-Schritt) und injiziert `linkedom`s
`DOMParser` als `globalThis.DOMParser`. Es gibt **keine** duplizierte Parser-Logik mehr –
Änderungen an `JwpubParser.ts` wirken sich automatisch auf das Testskript aus.

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
- `main.ts` importiert die Datei direkt: `import sqlWasmBinary from 'sql.js/dist/sql-wasm.wasm'`
  und hält sie als `plugin.sqlWasmBinary`; `SourceRouter`/`JwpubParser` bekommen sie per
  Konstruktor injiziert (statt selbst zu wissen, *wie* sie geladen wurde) und übergeben sie
  (als `ArrayBuffer` geslict) via `initSqlJs({ wasmBinary })`
- Diese Dependency-Injection ist bewusst so gewählt: `scripts/test-parse.mjs` (Node, kein
  esbuild) liest dieselbe `.wasm`-Datei stattdessen per `fs.readFileSync` aus
  `node_modules/sql.js/dist/` und reicht sie genauso an `new JwpubParser(wasmBinary)` durch –
  `JwpubParser` selbst bleibt agnostisch gegenüber der Lade-Methode
- **Kein** `fs.readFileSync` **in `JwpubParser.ts` selbst**, **kein** `pluginDir`/`getPluginDir()`
  mehr nötig – funktioniert unabhängig vom Installationsweg (manuell kopiert oder über den
  Community-Plugin-Store), da der Store-Installer aus einem Release nur `main.js`,
  `manifest.json`, `styles.css` lädt und eine separate `sql-wasm.wasm`-Datei dort schlicht
  nie ankäme

### HTML-Parsing (JwpubParser)

- Nutzt `DOMParser` (nativ in Electron; für Tests: `linkedom`)
- Programmpunkte in `<ul class="noMarker noIndent"> > li`
- Sessions durch `<h2>Vormittag</h2>` / `<h2>Nachmittag</h2>` getrennt
- **Lieder** (`itemType: 'song'`): `<li>` hat `a[href^="jwpub://p/X:"]` aber kein
  `a[href^="jwpub://b/NWTR/"]` → werden **nicht** übersprungen, sondern als eigener
  `ProgramItem` mit `songNumber` erfasst. `title` ist der **volle Absatztext** (nicht nur der
  Linktext), damit begleitende Programmhinweise wie „Lied 155 und Gebet" nicht verloren gehen;
  `NoteBuilder.splitSongTitle()` trennt beim Rendern „Lied NNN" (verlinkt) vom Rest (Klartext).
  Songs bekommen **keine eigene Notiz**, tauchen aber in der Tagesübersicht auf.
- **`aside`** (`itemType: 'aside'`): Pause- und Musikvideo-Zeilen (`MUSIC_VIDEO_RE`/`PAUSE_RE`,
  geprüft auf den Text nach der Uhrzeit). Wie Lieder: keine eigene Notiz, aber sichtbar in der
  Tagesübersicht (reiner Text, kein Link).
- **Titelbilder**: `extractCoverImage(db, innerZip, docId)` liest `DocumentMultimedia` (join
  `Multimedia`) für ein `DocumentId`, filtert auf `CategoryType = 8` (die am Dokumentanfang
  eingebettete „cnt_1"-Bannervariante; `CategoryType 9` ist eine quadratische Miniatur, die wir
  nicht nutzen) und liest die Bilddatei per `FilePath` direkt aus der **inneren** Zip (liegt dort
  unverschlüsselt neben der `.db`-Datei). Bei CO hat **jedes** Tagesdokument (DocumentId 1/2/3)
  sein eigenes Bild; bei CA (eintägig) gibt es nur ein Bild auf dem Deckblatt (DocumentId 0) –
  `buildCongress()` merkt sich das als `congressCoverImage`-Fallback für Tage ohne eigenes Bild.
  Per echten Testdateien verifiziert (siehe `scripts/analyze-jwpub.mjs`-Ausgabe).
- **„Beantworte die folgenden Fragen"**: ist im jwpub ein **eigenständiges Dokument**
  (kein `<li>` innerhalb eines Tagesprogramms!), erkannt über `<h1>` bzw. `QUESTIONS_RE`
  (`extractQuestionsDocument()`). Wird der `Wiederholungsfragen`-Session des zuletzt
  geparsten Tages angehängt; diese Session wird nach dem Parsing-Loop explizit ans Ende
  von `day.sessions` sortiert (unabhängig von der Dokumentreihenfolge im jwpub).
- CO-Typmarker: `<span class="du-color--…"><strong>TYP:</strong></span>`
- CA-Typmarker: `<p><strong>Typ:</strong></p>` (kein color-span)
- `extractTitle()` strippt den Typ-Prefix **nur** wenn `hasTypeMarker=true`, sonst würde er in Bibelstellen-Colons beißen
- `stripScriptureCitation()` entfernt ein trailing `(Buch Kapitel:Vers[; …])` aus Titeln (Haupttitel **und** Vortragsreihen-/Fragen-Teiltitel via `extractSubParts()`)
- `extractScriptures(container, exclude?)`: der `exclude`-Parameter überspringt Links innerhalb
  eines bestimmten Nachfahren-Elements. `parseTalkSeries()` nutzt das, um die verschachtelte
  `ul.source`-Teileliste bei der eigenen (übergeordneten) Bibelstellen-Extraktion auszuschließen –
  sonst tauchen die Bibelstellen aller Teile zusätzlich (redundant) auf der übergeordneten Zeile auf

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

### RTF-Fallback (RtfParser)

- Akzeptiert sowohl eine gezippte RTF-Sammlung als auch eine einzelne rohe `.rtf`-Datei
  (`isRawRtf()` erkennt die `{\rtf`-Signatur) – beides landet in `SourceRouter.isRtfZip()`
  als gültiger Fallback
- **Wichtig:** RTF-Absatzgrenzen (`\par`/`\line`/`\page`) müssen vor dem generischen
  Steuerwort-Stripping in echte `\n` umgewandelt werden (`BREAK_RE`). Werden sie (wie früher)
  einfach mitgestrippt, kollabiert das gesamte Dokument zu **einer** Zeile und es wird pro
  Datei nur noch ein einziger Programmpunkt erkannt
- `splitParagraphs()` teilt das rohe RTF anhand von `BREAK_RE` und liefert je Absatz sowohl
  den dekodierten Text als auch das zugehörige rohe RTF-Fragment (`Paragraph`) – dadurch
  können Bibelstellen-Hyperlinks (`matchScriptures()`) pro Absatz statt global über das
  gesamte Dokument gesucht werden
- `rtfToText()` ist ein klammer-bewusster Mini-RTF-Decoder (kein flacher Regex-Strip mehr):
  er verfolgt die `{`/`}`-Verschachtelungstiefe und unterdrückt den Textinhalt "ignorierbarer"
  Zielgruppen (`\*`-markiert oder ein Name in `IGNORABLE_DESTINATIONS`: `fonttbl`, `colortbl`,
  `stylesheet`, `info`, `generator`, `fldinst`, …). **Grund für die Umstellung:** Der alte
  Ansatz (`\word` strippen, dann alle `{`/`}` entfernen) konnte nicht unterscheiden, ob Text
  in einer Zielgruppe steht oder sichtbarer Fließtext ist – dadurch sickerten z. B. die rohe
  `\fldinst`-Hyperlink-URL und Autor-/Titel-Metadaten (`\info`) als sichtbarer Text durch und
  verfälschten Titel-/Wochentag-/Motto-Erkennung
- **Zeitformat ist `"H Uhr [MM]"`, nicht `"H:MM"`:** z. B. `"9 Uhr 20"` oder bei voller Stunde
  nur `"11 Uhr"` (Minute fehlt komplett statt `":00"`). `matchTime()` normalisiert auf `"H:MM"`
- **Bibelstellen-Zitate im sichtbaren Text nutzen `"Vers"` statt Doppelpunkt:** z. B.
  `"(Matthäus 5 Vers 3 bis 7 Vers 29; Lukas 6 Vers 17 bis 49)"` – `stripRtfCitation()` nutzt
  das Wort `"Vers"` als Anker (zuverlässiger als jwpubs `\d+:\d+`, das hier nie vorkommt)
- **Ein Zitat kann über mehrere `HYPERLINK`-Feldläufe verteilt sein** (Fett-/Kursiv-Grenzen
  brechen den sichtbaren Text in mehrere `{\field...}`-Läufe auf), alle mit **identischer**
  URL – `matchScriptures()` dedupliziert daher nach URL, sonst würde dieselbe Stelle mehrfach
  gezählt
- **Bibeldrama** erstreckt sich über 3 Absätze (Zeit+"Bibeldrama:", "Serientitel: Folge N",
  Zitat+Bibelstelle) – `extractBibleDrama()` verbraucht alle drei und baut daraus Titel/Untertitel
  im gleichen Format wie `JwpubParser.parseBibleDrama()` ("Folge N: „Zitat"")
- **Vortragsreihe/Symposium**: die Serien-Überschrift-Zeile hat keine eigenen Bibelstellen; die
  nachfolgenden `•`/`-`/`N.`-Aufzählungsabsätze werden zu `parts` mit eigenem Titel + eigenen
  Bibelstellen (`extractSeriesParts()`), analog zu jwpubs `parts`-Struktur
- **Tagesmotto** (`extractDayTheme()`): identischer Ansatz wie `JwpubParser.extractDayTheme()` –
  der Absatz direkt nach dem alleinstehenden Wochentag-Absatz (z. B. "Freitag") enthält Zitat
  + Bibelstelle; nur übernommen, wenn dieser Absatz tatsächlich einen Bibelstellen-Link enthält
- **Kongress-Motto + Jahr** (`extractCongressThemeYear()`): Absatz der Form
  `"{Motto} Kongress von Jehovas Zeugen {Jahr}"` (kommt bei CO-Programmen auf der Titelseite
  vor); liefert damit auch das Jahr aus echten Daten statt des bisherigen
  `new Date().getFullYear()`-Notbehelfs. Nur gegen echte CO-Dateien verifiziert – für
  Kreiskongresse (keine RTF-Testdatei verfügbar) greift weiterhin der ältere,
  best-effort `extractTheme()`-Fallback

### Bibelstellen-Format

- jwpub: `jwpub://b/NWTR/book:chapter:verse[-book:chapter:verse]`
- RTF: `BBCCCVVV[-BBCCCVVV]` (z. B. `40005001`)
- Ausgabe: `[Matthäus 5:1](jwlibrary:///finder?bible=40005001)`
- `ScriptureNormalizer.toJwLibraryLink()` nutzt das rohe `jwlibrary://`-Custom-Protokoll – das
  ist das Standardformat, das auch andere JW-Library-Linking-Tools nutzen (z. B.
  obsidian-library-linker) und funktioniert bei einer intakten JW-Library-Installation korrekt.
  **Bekanntes Nutzer-Problem:** Auf einer bestimmten Windows-Installation navigierte der Link
  per Direkttest (Windows-Ausführen-Dialog, unabhängig von Obsidian reproduzierbar) nicht zur
  Bibelstelle. Da das Format identisch zu dem des Referenz-Plugins ist und dessen Doku keinerlei
  Plattform-Einschränkung nennt, ist das sehr wahrscheinlich eine kaputte/fehlerhafte lokale
  JW-Library-Installation (bekannte Kategorie von Windows-JW-Library-Bugs), keine
  Format-/Code-Frage. Erster Trouble­shooting-Schritt bei erneuten Meldungen: JW Library
  neu installieren bzw. App-Cache leeren, bevor am Code weitergesucht wird.
- Lieder: `jwlibrary:///finder?pub=sjjm&issue=0&track=NNN` ist unverifiziert (Annahme aus
  v0.2.0). Ein Format, das nachweislich zum richtigen Lied navigiert (`lank=pub-sjjm_NNN_VIDEO`),
  öffnet die Video- statt der Textansicht – aber auch dieser Test lief auf der oben erwähnten
  potenziell kaputten JW-Library-Installation und ist daher mit Vorsicht zu genießen. Vor einer
  Änderung an `NoteBuilder.songLink()` erst mit einer nachweislich intakten JW-Library-Installation
  neu verifizieren.

### Notiz- & Ordnerbenennung (NoteBuilder)

- **Kein Frontmatter** in Notizen – nur sichtbare Felder (`**Tag:**`, `**Uhrzeit:**`,
  `**Bibeltexte:**`, `**Redner:**`), da der Dateiname bereits der Notiztitel ist
- **Durchnummerierung** pro Tag/Kongress in Programmreihenfolge: `01. Titel.md`, `02. Titel.md`, …
  (Lieder **und** Asides werden bei der Nummerierung übersprungen, `NoteBuilder.buildNotes()`)
- **`00. Übersicht.md`** pro Tag: verlinkt jeden Programmpunkt auf seine Notiz
  (`[[01. Titel|Titel]]`) und jeden Vortragsreihen-/Fragen-Teil direkt auf den passenden
  Abschnitt der übergeordneten Notiz (`[[02. Titel#1. Teiltitel|Teiltitel]]`) – dafür wird
  vor dem Rendern der Übersicht eine `Map<ProgramItem, string>` mit den Basisdateinamen aufgebaut
- **Titelbild** (falls vorhanden) wird als `Titelbild.<ext>` in `GeneratedAttachment[]`
  zurückgegeben (`BuildResult.attachments`, getrennt von `notes`, da Binärdaten statt Markdown)
  und in der Übersicht per `![[Titelbild.<ext>]]` als erste Zeile eingebettet. `main.ts` schreibt
  Attachments über `vault.createBinary()` und zählt sie zum selben Rollback-Tracking wie Notizen
- **Zeichen-Ersetzung statt Löschung**: für Windows verbotene Zeichen (`< > : " / \ | * ?`)
  werden durch optisch ähnliche Unicode-Zeichen ersetzt (`FS_CHAR_MAP` in `NoteBuilder`),
  damit z. B. ein Fragezeichen am Titelende nicht verschwindet
- **CO**: Tagesordner (Freitag/Samstag/Sonntag) unterhalb des Kongressordners
- **CA**: keine Tagesordner, Notizen direkt im Kongressordner
- Ordner-/Dateinamen dürfen **keinen** `/` enthalten (z. B. Saison als `2026-2027`, nicht `2026/2027` – sonst legt Obsidian ungewollt einen Unterordner an)

## Manifest-Regeln

- `isDesktopOnly: true` (zwingend – Node crypto/zlib; sql.js-WASM ist in `main.js` eingebettet)
- `id` niemals nach Release ändern
- `minAppVersion` aktuell halten – aktuell `1.6.6` wegen `FileManager.trashFile()` (Rollback
  bei fehlgeschlagenem Import in `main.ts`); jede API, die eine höhere Version verlangt,
  zieht diesen Wert entsprechend nach oben (ESLint (`obsidianmd/no-unsupported-api`) meldet das)

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
node scripts/test-parse.mjs <datei1.jwpub> [datei2.jwpub ...]
```

`scripts/out/` ist in `.gitignore` – kein urheberrechtlich geschütztes Material committen.

## Do / Don't

**Do**
- `Number()` beim Lesen von sql.js-Integer-Feldern die als String kommen können
- `hasTypeMarker` in `extractTitle()` übergeben
- `scripts/out/` nie committen
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
