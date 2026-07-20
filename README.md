# JW Convention Program – Obsidian Plugin

An Obsidian community plugin that imports official convention program files of Jehovah's Witnesses and turns them into structured, linked Markdown notes in your vault.

**Language note:** The plugin supports German, English, French, Italian, Portuguese, Russian and Spanish program files. Generated notes automatically follow the language of the imported file — a German jwpub file produces German notes, a French one French notes, and so on. The plugin interface itself (settings, import dialog, Bible-verse popup) can be switched between German and English only.

## Features

- **Supported convention types**
  - `CO` – Regional Convention (Friday / Saturday / Sunday)
  - `CA-copgm` – Circuit Assembly With Circuit Overseer (one day)
  - `CA-brpgm` – Circuit Assembly With Branch Representative (one day)
- **Supported languages: German, English, French, Italian, Portuguese, Russian and Spanish** – the language of the program file is detected automatically (via its `MepsLanguageIndex`), and all generated notes, labels, file and folder names follow it. The plugin's own interface (settings, import dialog, Bible-verse popup) stays German/English.
- **Primary source: `.jwpub`** – full decryption (AES-128-CBC + zlib) and HTML parsing
- **Fallback: RTF-ZIP** – used automatically when no jwpub is available (German exports only)
- **One folder per convention**, named after type, year/season and theme – created directly in the vault root by default, without an extra wrapper folder
  - Regional conventions additionally get one subfolder per day
  - Circuit assemblies (one day) place their notes directly in the convention folder
- **One note per program item**, numbered in program order (`01.`, `02.`, …)
  - Symposiums get one note with a heading per part
- **A per-day overview note** (`00. Overview.md`; `00. Übersicht.md` for German imports) with the complete day's program:
  - the day's cover image and theme (with linked scripture) at the top
  - every program item linked to its note
  - symposium parts linked straight to the matching section
  - scriptures linked inline
  - songs shown with a JW Library deep link (no dedicated note)
  - breaks and music videos shown as plain entries (no dedicated note)
- **Back link to the day's overview** at the top of every program-item note
- **"Next:" hint** at the end of every note – the following song (linked), the next program item (linked to its note) or the break
- **Clickable scriptures** as JW Library deep links in every note
- **Bible-verse popup** (optional): with a user-supplied Bible jwpub file (`nwt`/`nwtsty`), clicking a scripture opens the verse text directly in Obsidian – including footnotes, cross-references and study notes – instead of jumping to JW Library. A button in the popup can also insert the shown passage as a quote into the note last focused before the popup opened.
- **Type a scripture reference anywhere, in any note** (e.g. `Psalm 12:1`, or an abbreviation like `Matth. 5:2`) and a suggestion pops up right after typing it, offering up to four actions – both fully offline, using the loaded Bible file: link it, link it and open JW Library immediately, insert the verse text as a quote (replacing the typed reference), or insert the quote while turning the reference into a link instead. Each of the four can be individually enabled/disabled and freely reordered in the settings.
- **Review note** (`Review.md`; `Wiederholung.md` for German imports) with the three standard reflection questions for the congregation's convention review
- **Printed review questions** ("Find Answers to These Questions") become their own note with one heading per question, always numbered last

### Tip: pairs well with JW Library Linker

The [JW Library Linker](https://github.com/msakowski/obsidian-library-linker) plugin lets you turn scriptures you type yourself (anywhere in your vault, not just in imported convention notes) into clickable `jwlibrary://` links. Both plugins use the same link format, so once you've loaded a Bible file here, clicking a Library-Linker-created link also opens this plugin's offline verse popup — you get typed-reference linking from one plugin and the in-app verse popup from the other, together.

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

1. **Ribbon icon** (book symbol) or **command palette** → "Import convention program"
2. Pick a program file (`.jwpub` or RTF-ZIP)
3. Pick a target folder (vault root is the default; an existing folder or "new folder" can be chosen instead)
4. Check the preview (convention type, theme, detected days/program items)
5. **Import** – the convention folder with all notes is created

Re-importing into an existing convention folder only refreshes purely derived files (overview, cover image). Notes with your own entries (speaker, personal notes) are never overwritten.

### Updating notes after a plugin fix

If a plugin update fixes a bug in the generated notes themselves (e.g. a wrong weekday or a broken scripture link), you don't have to delete anything to pick it up. **Command palette → "Update convention notes"** re-parses the same program file and patches an already-imported convention folder in place: every automatically generated field (day, time, scripture links, headings, the "Anschließend"/"Next" hint) is refreshed, while anything you typed yourself — speaker name, personal notes — is left completely untouched, even in the very same note.

This works because every generated note carries invisible markers (Obsidian's own `%%…%%` comment syntax, never shown in Reading View or Live Preview) around each derived field. Only notes created by this plugin version or later have them — older notes fall back to being left alone, reported separately in the result notice, and still need a full delete-and-reimport to pick up template changes.

## Settings

| Setting | Default | Description |
|---|---|---|
| Target folder | *(vault root)* | Parent folder for new convention folders (overridable per import); empty = no wrapper folder |
| Language of the interface and Bible-verse popup | `Deutsch` | Plugin labels and Bible book names in the popup. Generated notes follow the imported file's language automatically |
| Create review note | on | Creates the additional review note |
| Note fields | all on | Show/hide the Day/Time/Scriptures/Speaker fields individually, plus free-form extra fields |

All settings around scriptures — linking, the click/tap popup and the as-you-type suggester — live together under one **"Scripture references"** heading:

| Setting | Default | Description |
|---|---|---|
| Link scriptures | on | Generates clickable `jwlibrary://` links |
| Enable Bible-verse popup | on | Whether clicking/tapping a scripture opens the in-app popup at all — independent of whether a Bible file is loaded, so the popup can be switched off without removing a large file |
| Bible file | – | Optional Bible jwpub file for the verse popup (study edition `nwtsty` for study notes; the much smaller regular edition `nwt` is the memory-friendly choice on mobile) |
| Typed scripture suggestions | all on, default order | Enable/disable and reorder the four actions offered when typing a scripture reference (link, link & open JW Library, insert as quote, insert as quote & keep the link) |

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
2026-2027 Circuit Assembly – With Circuit Overseer – “Theme”/
  Cover.jpg
  00. Overview.md
  01. Why Trust In Jehovah With All Your Heart.md
  ...
  10. Find Answers to These Questions.md   ← always numbered last
  Review.md
```

(Examples show English imports; a German program file produces German names throughout — e.g. `Regionaler Kongress 2026 – …`, `00. Übersicht.md`, `Titelbild.jpg`, `Wiederholung.md`.)

## Technical details

- **Decryption:** `sha256(cardString)` XOR constant → AES-128-CBC key + IV, via `crypto.subtle` (WebCrypto) – identical on desktop and mobile
- **Decompression:** `pako` (pure JS, compatible with Node `zlib`'s `inflate`)
- **ZIP handling:** `fflate` (pure JS)
- **sql.js runs with an embedded WASM binary**: the `.wasm` file is embedded into `main.js` as base64 at build time (esbuild `binary` loader) – no network access, no separate file
- **Parsing strategy:** `DOMParser` over the decrypted HTML content
- **Language detection:** `Publication.MepsLanguageIndex` (0 = English, 1 = Spanish, 2 = German, 3 = French, 4 = Italian, 207 = Russian, 785 = Portuguese); parsing patterns (session headings, type markers such as `SYMPOSIUM:`/`VORTRAGSREIHE:`/`SIMPOSIO:`, music/break lines) accept all seven languages
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
  i18n.ts                    # UI strings (de/en) + note-generation strings (all 7 languages)
  models/
    congress.ts              # data model (Congress, Day, ProgramItem, …)
  normalizer/
    ScriptureNormalizer.ts   # scripture normalization & link generation
    ScriptureTextParser.ts   # recognizes a scripture reference typed as plain text
    bookNames.ts             # Bible book names for all 7 supported languages
  parser/
    JwpubParser.ts           # jwpub → data model (primary)
    RtfParser.ts             # RTF-ZIP → data model (fallback, German only)
    SourceRouter.ts          # format detection & routing
  builder/
    NoteBuilder.ts           # data model → Markdown notes (wraps derived fields in merge markers)
  bible/
    BibleReader.ts           # Bible jwpub → verse text/footnotes/cross-references
  ui/
    ImportModal.ts           # import dialog with target-folder picker & preview
    UpdateNotesModal.ts      # re-parses a file and patches an already-imported folder
    BibleVerseModal.ts       # verse popup ("Open in JW Library" / "insert as quote")
    ScriptureEditorSuggest.ts # as-you-type scripture reference → link/quote suggestion
  util/
    jwpubCrypto.ts           # shared jwpub crypto
    bytes.ts                 # hex/latin1 helpers
    noteMerge.ts             # marker-based merge for the "update notes" command
    quoteBuilder.ts          # verse text → Obsidian quote callout
    scriptureLinkScan.ts     # finds jwlibrary:// links in note text
```

## Roadmap

Planned features and ideas under consideration live in [ROADMAP.md](ROADMAP.md).

## License

0-BSD – see [LICENSE](LICENSE)
