# JW Convention Program – Obsidian Plugin

An Obsidian community plugin that imports official convention program files of Jehovah's Witnesses and turns them into structured, linked Markdown notes in your vault.

**Sprachhinweis:** Das Plugin unterstützt deutsche und englische Programmdateien. Die erzeugten Notizen folgen automatisch der Sprache der importierten Datei — aus einer deutschen jwpub-Datei entstehen deutsche Notizen, aus einer englischen englische.

## Features

- **Supported convention types**
  - `CO` – Regional Convention (Friday / Saturday / Sunday)
  - `CA-copgm` – Circuit Assembly With Circuit Overseer (one day)
  - `CA-brpgm` – Circuit Assembly With Branch Representative (one day)
- **Supported languages: German and English** – the language of the program file is detected automatically (via its `MepsLanguageIndex`), and all generated notes, labels, file and folder names follow it
- **Primary source: `.jwpub`** – full decryption (AES-128-CBC + zlib) and HTML parsing
- **Fallback: RTF-ZIP** – used automatically when no jwpub is available (German exports only)
- **One folder per convention**, named after type, year/season and theme – created directly in the vault root by default, without an extra wrapper folder
  - Regional conventions additionally get one subfolder per day
  - Circuit assemblies (one day) place their notes directly in the convention folder
- **One note per program item**, numbered in program order (`01.`, `02.`, …)
  - Symposiums get one note with a heading per part
- **A per-day overview note** (`00. Übersicht.md` / `00. Overview.md`) with the complete day's program:
  - the day's cover image and theme (with linked scripture) at the top
  - every program item linked to its note
  - symposium parts linked straight to the matching section
  - scriptures linked inline
  - songs shown with a JW Library deep link (no dedicated note)
  - breaks and music videos shown as plain entries (no dedicated note)
- **Back link to the day's overview** at the top of every program-item note
- **"Next:" hint** at the end of every note – the following song (linked), the next program item (linked to its note) or the break
- **Clickable scriptures** as JW Library deep links in every note
- **Bible-verse popup** (optional): with a user-supplied Bible jwpub file (`nwt`/`nwtsty`), clicking a scripture opens the verse text directly in Obsidian – including footnotes, cross-references and study notes – instead of jumping to JW Library
- **Review note** (`Wiederholung.md` / `Review.md`) with the three standard reflection questions for the congregation's convention review
- **Printed review questions** ("Beantworte die folgenden Fragen" / "Find Answers to These Questions") become their own note with one heading per question, always numbered last

## Requirements

- Obsidian ≥ 1.6.6
- Runs on desktop and mobile (iOS/Android) – decryption uses WebCrypto (`crypto.subtle`) instead of Node `crypto`, `pako` instead of Node `zlib`, `fflate` instead of `adm-zip`

## Installation

### Manual (development / testing)

1. Clone or download the repository
2. `npm install` in the project folder
3. `npm run build` (once) or `npm run dev` (watch mode)
4. Copy `main.js`, `manifest.json` and `styles.css` into the vault's plugin folder:
   ```
   <Vault>/.obsidian/plugins/jw-congregation-program/
   ```
5. Reload Obsidian → **Settings → Community plugins → enable the plugin**

### Community plugin store

> Not published yet – currently in review.

## Usage

1. **Ribbon icon** (book symbol) or **command palette** → "Kongressprogramm importieren"
2. Pick a program file (`.jwpub` or RTF-ZIP)
3. Pick a target folder (vault root is the default; an existing folder or "new folder" can be chosen instead)
4. Check the preview (convention type, theme, detected days/program items)
5. **Import** – the convention folder with all notes is created

Re-importing into an existing convention folder only refreshes purely derived files (overview, cover image). Notes with your own entries (speaker, personal notes) are never overwritten – to pick up template improvements after a plugin update, delete the convention folder and import again (the plugin reminds you once after each update).

## Settings

| Setting | Default | Description |
|---|---|---|
| Zielordner | *(vault root)* | Parent folder for new convention folders (overridable per import); empty = no wrapper folder |
| Sprache des Bibeltext-Popups | `Deutsch` | Language of the Bible-verse popup (book names, labels). Notes follow the imported file's language automatically |
| Bibelstellen verlinken | on | Generates clickable `jwlibrary://` links |
| Wiederholungs-Notiz erstellen | on | Creates the additional review note |
| Notiz-Felder | all on | Show/hide the Day/Time/Scriptures/Speaker fields individually, plus free-form extra fields |
| Bibel-Datei | – | Optional Bible jwpub file for the verse popup (recommended: study edition `nwtsty`) |

## Folder & note structure

By default (target folder = vault root), each convention is its own top-level folder:

```
2026 Regional Convention – Eternal Happiness/
  Friday/
    Cover.jpg
    00. Overview.md
    01. Abundant Happiness Forever—Is It Realistic？.md
    ...
  Saturday/
  Sunday/
  Review.md
Kreiskongressprogramm 2026-2027 – mit dem Kreisaufseher – „Titel“/
  Titelbild.jpg
  00. Übersicht.md
  01. Warum sollten wir mit ganzem Herzen auf Jehova vertrauen.md
  ...
  10. Beantworte die folgenden Fragen.md   ← always numbered last
  Wiederholung.md
```

(The first example shows an English import, the second a German one – names follow the file's language.)

## Technical details

- **Decryption:** `sha256(cardString)` XOR constant → AES-128-CBC key + IV, via `crypto.subtle` (WebCrypto) – identical on desktop and mobile
- **Decompression:** `pako` (pure JS, compatible with Node `zlib`'s `inflate`)
- **ZIP handling:** `fflate` (pure JS)
- **sql.js runs with an embedded WASM binary**: the `.wasm` file is embedded into `main.js` as base64 at build time (esbuild `binary` loader) – no network access, no separate file
- **Parsing strategy:** `DOMParser` over the decrypted HTML content
- **Language detection:** `Publication.MepsLanguageIndex` (0 = English, 2 = German); parsing patterns (session headings, type markers such as `SYMPOSIUM:`/`VORTRAGSREIHE:`, music/break lines) accept both languages
- **Scriptures:** taken directly from `<a href="jwpub://b/NWTR/...">` links in the HTML
- **Songs:** recognized via `<a href="jwpub://p/…">` links without an accompanying Bible link; the real jw.org `docid` is read from that very href (never computed – the docid is not a linear function of the song number)
- **Cover images:** resolved per day document via the `Multimedia`/`DocumentMultimedia` tables (`CategoryType 8`)
- **Filenames:** characters forbidden on Windows (`? " : / \ | * < >`) are replaced with visually similar Unicode look-alikes instead of being dropped
- **No network requests** – processes only local user files
- **No copyrighted material** in the repository

## Development

```bash
npm install      # install dependencies
npm run dev      # watch mode (esbuild)
npm run build    # production build (TypeScript check + esbuild)
npm run lint     # ESLint
npm test         # unit tests (node:test)
```

Analysis scripts for development & debugging:

```bash
node scripts/dump-structure.mjs <file.jwpub>   # DB metadata + per-document structure
node scripts/test-parse.mjs <file.jwpub> ...   # parse real files with the actual parser
```

## File structure

```
src/
  main.ts                    # plugin entry point
  settings.ts                # settings
  i18n.ts                    # all language-dependent strings (de/en)
  models/
    congress.ts              # data model (Congress, Day, ProgramItem, …)
  normalizer/
    ScriptureNormalizer.ts   # scripture normalization & link generation
    bookNames.ts             # Bible book names de/en
  parser/
    JwpubParser.ts           # jwpub → data model (primary)
    RtfParser.ts             # RTF-ZIP → data model (fallback, German only)
    SourceRouter.ts          # format detection & routing
  builder/
    NoteBuilder.ts           # data model → Markdown notes
  bible/
    BibleReader.ts           # Bible jwpub → verse text/footnotes/cross-references
  ui/
    ImportModal.ts           # import dialog with target-folder picker & preview
    BibleVerseModal.ts       # verse popup with "Open in JW Library" button
  util/
    jwpubCrypto.ts           # shared jwpub crypto
    bytes.ts                 # hex/latin1 helpers
```

## License

0-BSD – see [LICENSE](LICENSE)
