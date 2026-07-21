# Changelog

## 1.18.2

### Improvements (Meeting Workbook import)

- **Week notes now show the actual descriptive text of every programme
  item**, not just a metadata summary (duration/scriptures) — the real
  instructional paragraph(s) from the workbook, discussion questions with any
  embedded scripture reference still clickable, and the ministry-assignment
  label (e.g. "Von Haus zu Haus") bolded in place rather than duplicated.
- **Every source-material citation is now a clickable link** to its real
  jw.org/finder page (e.g. "th"/*Werde ein besserer Leser und Lehrer*,
  "lmd"/*Liebt Menschen, macht sie zu Jüngern*) — the same mechanism songs
  already used, extended to every citation in the item's own text.
- **Each week's own cover image** is now extracted and embedded at the top of
  its note (distinct from the per-item illustration images scattered through
  the week, which are a different, repeated image category in the source
  file — only the week's own single, document-level thumbnail is used).
- **Week notes are now numbered chronologically** (`01.`, `02.`, …), so the
  file explorer's default alphabetical sort matches the actual week order —
  previously the raw date-range text alone didn't (e.g. "10.-16. AUGUST"
  sorted before "3.-9. AUGUST").
- Removed a redundant in-body "# `<date range>`" heading from each week
  note — Obsidian's own inline title (derived from the filename) already
  showed the exact same text right above it.
- A photo's legal/technical image-source credit line (e.g. "Based on
  NASA/Visible Earth imagery") no longer leaks into the note text as if it
  were real instructional content.

## 1.18.1

### Fix

- **Invisible merge markers are now actually invisible in Live Preview, not
  just in Reading View.** The `%%jw:id%%`/`%%/jw:id%%` markers used since
  1.9.0 (Obsidian's own comment syntax) turned out to always render as
  dimmed, visible text while editing — independent of cursor position —
  since Obsidian has no built-in fully-invisible handling for that syntax
  specifically; only Reading View ever dropped it entirely. Replaced with
  empty `<span class="jw-marker">` elements hidden by this plugin's own
  stylesheet, so they stay invisible in both views regardless of where the
  cursor is. Existing notes (congress or Meeting Workbook) using the old
  format keep merging correctly and are silently upgraded to the new marker
  format the next time they're updated — nothing needs to be done manually,
  and no content is ever lost.

## 1.18.0

### New feature

- **Import of the Life and Ministry Meeting Workbook ("Leben und Dienst"),
  German only for now** — a new, independent import/update flow (own ribbon
  icon, commands and settings section) turns a Meeting Workbook `.jwpub`
  file into one Markdown note per week: the three fixed programme sections,
  every numbered item (duration, ministry-assignment label such as "Von Haus
  zu Haus"/"Informell", the source-material citation, and any discussion
  questions), the opening/mid-week/closing songs, and the always-last
  Congregation Bible Study. The "Bibelleseprogramm für das Gedächtnismahl"
  insert that appears in the Memorial-season issue is recognized separately
  and turned into its own per-day reading-checklist note. Every derived
  field is wrapped in the same invisible-marker mechanism convention notes
  already use, so "Update Meeting Workbook notes" can later refresh a
  corrected schedule without touching anything typed underneath an item.
  Picking a file in an unsupported language, or a convention-program file by
  mistake, is rejected with a clear, translated message.
- Extracted the jwpub-format-agnostic pieces the new parser shares with the
  existing convention-program parser (the MEPS-language table, scripture/
  song href patterns, file-signature detection, the vault-folder-listing
  helper every import/update modal uses) into small dedicated `util/` modules
  instead of leaving them duplicated or private to `JwpubParser`/`SourceRouter`.

## 1.17.0

### Improvements

- **`main.ts` is now covered by automated tests** — previously the plugin's
  central orchestration (import/update rollback logic, create/skip/regenerate
  accounting, marker-merge and legacy-field-correction branching) had zero
  test coverage, since it depends on the real `obsidian` package, which has
  no usable runtime outside the app itself. A minimal, hand-written stand-in
  for just the pieces `main.ts` (and everything it imports) needs at
  module-load time now makes it possible to construct a real plugin instance
  and exercise `importFile()`/`updateFile()` against an in-memory vault.
- **A size ceiling now guards every decompression step** (the raw `.jwpub`/
  RTF-ZIP file, every unzipped entry, every decrypted content blob) against
  a crafted or corrupted file with an extreme compression ratio ("zip bomb")
  freezing Obsidian or exhausting memory. Ceilings are generous — well above
  the largest legitimate file this code handles (the ~125 MB Study Bible) —
  so no real file is affected; an oversized file is now rejected with a
  clear, translated message instead.
- **Parsing/decryption failures are now translated into the interface
  language**, instead of a hardcoded German/English sentence appearing
  inside an otherwise fully translated notice (e.g. a French-interface user
  hitting an unsupported device or a corrupted file previously saw a German
  fragment). Affects unknown file formats, missing WebCrypto/WebAssembly
  support, and various corrupted-jwpub/RTF-ZIP conditions.
- Corrected the `LICENSE` file's copyright holder (was still the Obsidian
  sample-plugin template's placeholder) and brought `AGENTS.md` back in sync
  with the current codebase (it still described a German/English-only
  plugin and was missing several existing files from its module map).

## 1.16.2

### Fixes

- **"Insert as quote" for a cross-reference could corrupt an existing quote
  callout**: opening the popup by clicking an already-inserted quote,
  navigating to one of its cross-references, then inserting THAT verse as a
  separate new quote landed the new callout right after the existing one's
  title line — inside its own blockquote, since Markdown callouts are just
  consecutive "> " lines with no blank line between them. Obsidian doesn't
  treat a second "[!quote]" marker mid-block as a nested callout; it renders
  it as the first callout's own literal body text, while the blank line the
  insertion added then split the ORIGINAL quote's body off into its own bare,
  title-less blockquote underneath. The insertion point now skips past the
  whole existing callout instead of just its title, with a blank-line
  separator whenever appending directly after any blockquote.

## 1.16.1

### Fixes

- **Popup opened from an inserted quote showed both "Insert as quote" and
  "Remove quote"**: the first would have created a redundant second copy of
  the very quote already shown right below the popup. Now hidden while
  showing that exact quoted verse; navigating to a cross-reference brings it
  back (that verse isn't already quoted anywhere), and it hides again once
  navigating back restores the original.

## 1.16.0

### Improvements

- **The whole inserted quote is now clickable, not just its title**: the
  verse-text body of a quote callout is now itself a `jwlibrary://` link too
  (styled back to plain quote text, not the usual blue/underline, so it
  doesn't read as a wall of link text), and clicking anywhere inside the
  callout's box — background, padding, icon, title or body text, not only
  directly on one of those two link runs — opens the verse popup.

## 1.15.0

### New features

- **An inserted quote is now clickable, and removable from its own popup**:
  the callout title of an "insert as quote" block (from either the popup's
  own button or the in-editor scripture suggester) is now itself a
  `jwlibrary://` link, exactly like a plain inline scripture reference —
  clicking it opens the usual verse popup. That popup, when opened this way
  (and only this way — not for a plain reference), also offers a "remove
  quote" button that deletes the whole callout in place.

## 1.14.1

### Fixes

- **RTF-imported circuit assemblies never detected the branch-representative
  variant**: the RTF fallback (used when jwpub parsing fails) only ever
  produced `CA-copgm` ("with the circuit overseer"), since RTF exports carry
  none of the `Publication.Symbol` metadata jwpub's own parser uses to tell
  the two variants apart. Now falls back to the cover-page title text itself
  ("... mit dem Vertreter des Zweigbüros" vs. "... mit dem Kreisaufseher"),
  verified against a real jwpub dump of both variants' cover pages.
- **Bible-file save/remove errors failed silently**: choosing or removing the
  Bible file in settings had no error handling at all — a failed vault write
  (e.g. disk full) surfaced as an unhandled rejection with no feedback and no
  UI refresh, unlike every other failure path in the plugin, which always
  shows a Notice.
- **A single failing note aborted the entire legacy-notes migration**: the
  "Update convention notes" follow-up dialog for pre-1.9.0 notes stopped
  applying corrections the moment one note failed (e.g. moved/deleted since
  the preview was built), silently leaving every remaining note un-migrated
  with no notice at all. Failures are now caught per note and reported
  alongside the successful count.
- **A corrupted or atypical Bible file could crash the verse popup**:
  `BibleReader` had no error handling around any of its SQL queries — a
  schema it doesn't expect (e.g. a plain `nwt` file possibly missing the
  `VerseCommentary`/`VerseCommentaryMap` tables study notes rely on, which
  were found investigating a `nwtsty` file specifically) could throw an
  unhandled exception instead of falling back to "no verse text available",
  which every caller already handles gracefully.

## 1.14.0

### New features

- **"Update convention notes" can now propose field-level corrections for
  notes created before v1.9.0** (before invisible merge markers existed),
  which previously could only be reported as needing a full re-import. A
  small, deliberately conservative heuristic recognizes the four fields
  NoteBuilder always writes as a complete `**Label:** value` line — Day,
  Time, Scriptures, the "Anschließend"/"Next" hint — and proposes a
  correction only when that label appears exactly once in both the old and
  the freshly parsed note; anything ambiguous (a label appearing zero or
  multiple times, e.g. a symposium note's per-part scripture fields) is
  silently skipped rather than guessed at. The Speaker field is never
  touched — NoteBuilder never writes a value there to compare against.
  Nothing is written automatically: a new, separate notice (only shown when
  such notes were found) opens a review window listing every proposed
  change per note with its own on/off switch, and only notes left switched
  on are patched when "Apply" is clicked.

## 1.13.0

### New features

- **The plugin interface now speaks all 7 supported languages**, not just
  German/English: settings tab, Bible-verse popup, import/update dialogs and
  every notice are now available in French, Italian, Portuguese, Russian
  and Spanish too, independently of the language of any imported program
  file. The interface-language dropdown gained the five new options.
- **Surfaced the "Import & update convention programs" section in the
  settings tab**: previously reachable only via the ribbon icon or command
  palette, an explanation of the difference between a plain import and an
  update now sits at the top of the settings, with an "Open" button for
  each.

## 1.12.0

### Improvements

- **Reorganized the settings tab into consistent groups**: "General" (target
  folder, interface language), "Note fields" (now also including "Create
  review note", moved out of the ungrouped top section) and "Scripture
  references". Previously only some settings were grouped under a heading
  while others sat loose at the top — every setting now belongs to a named
  group. Available in both the declarative settings UI (Obsidian ≥ 1.13)
  and the older fallback tab.

## 1.11.0

### New features

- **A new "Enable Bible-verse popup" toggle**: previously the popup was
  implicitly active whenever a Bible file was loaded. It can now be switched
  off independently, without removing the (potentially large) Bible file.
- **All scripture-related settings now live under one "Scripture references"
  heading**: linking scriptures, the Bible-verse popup (its new enable
  toggle plus the Bible file itself) and the typed-scripture suggestions are
  grouped together, since they're all facets of the same feature area.
  Available in both the declarative settings UI (Obsidian ≥ 1.13) and the
  older fallback tab.

## 1.10.0

### New features

- **Two more actions in the typed-scripture suggestion menu**: alongside
  "link" and "insert as quote" (which replaces the typed reference), the
  menu now also offers "link & open JW Library" (inserts the link and
  immediately opens it) and "insert as quote & keep the link" (turns the
  typed reference into a link first, then adds the quote as its own block
  below it, instead of consuming the reference).
- **The four suggestion actions are now configurable**: a new "Typed
  scripture suggestions" settings section lets each of the four be
  individually enabled or disabled and freely reordered via up/down
  buttons — the saved order is exactly the order shown in the suggestion
  menu. Available in both the declarative settings UI (Obsidian ≥ 1.13) and
  the older fallback tab.

## 1.9.0

### New features

- **Five more program-file languages**: French, Italian, Portuguese, Russian
  and Spanish jwpub programme files now parse and generate notes in their own
  language, detected automatically from `Publication.MepsLanguageIndex` (0 =
  English, 1 = Spanish, 2 = German, 3 = French, 4 = Italian, 207 = Russian,
  785 = Portuguese) — the same mechanism German/English already used. Book
  names are read verbatim from each language's own Bible jwpub file
  (`BibleBook.BookDocumentId` → `Document.Title`) rather than hand-translated,
  and every language-specific parsing pattern (weekday names, session
  headings, type markers like `SYMPOSIUM:`/`VORTRAGSREIHE:`/`SIMPOSIO:`,
  music/break lines, the printed review-questions heading) was matched
  against real CO and CA program files in all seven languages. `settings.lang`
  (the interface and Bible-verse popup language) intentionally stays
  German/English only — a note's own language always follows the imported
  file, independent of the UI language.
- **Insert a Bible verse as a quote**: a button in the verse popup ("Insert as
  quote", next to "Open in JW Library") inserts the shown passage into the
  active note as an `> [!quote]` callout — sourced entirely from the local
  Bible file, no network access, mirroring what JW Library Linker's own
  quote-insertion does but fully offline.
- **Type a scripture reference anywhere and get a link/quote suggestion**:
  typing e.g. `Psalm 12:1` or an abbreviation like `Matth. 5:2-4` in any note
  triggers a suggestion right after the last character (as-you-type, like the
  built-in wikilink/tag autocomplete), offering to turn it into a
  `jwlibrary://` link (opens the offline popup above) or insert the verse
  text as a quote directly. Recognizes full book names in the interface
  language plus common truncated abbreviations ("Ps", "1 Mo", "Kol.", …) via
  prefix matching against the already-verified full names — an ambiguous
  prefix (e.g. "Jo", which could mean Johannes, Joel or Jona) is safely left
  unrecognized rather than guessed at.
- **Update convention notes without touching your own text**: a new "Update
  convention notes" command re-parses the same program file (e.g. after this
  very release fixes a bug in the notes) and patches an already-imported
  convention folder in place. Every automatically generated field — day,
  time, scripture links, headings, the "Anschließend"/"Next" hint, each
  talk-series part — is refreshed, while anything already typed into the
  note (speaker name, personal notes) is left completely untouched, even
  inside the very same file. This works via invisible `%%jw:id%%` markers
  (Obsidian's own comment syntax, never rendered) that `NoteBuilder` now
  wraps around every derived block; a note's YAML frontmatter, being fully
  machine-generated, is replaced outright. Notes created by a plugin version
  before this feature have no markers and are safely left alone, counted
  separately in the result notice — those still need a full delete-and-
  reimport to pick up template changes.
- Documented the JW Library Linker synergy in the README: links created by
  the [JW Library Linker](https://github.com/msakowski/obsidian-library-linker)
  plugin already open this plugin's offline verse popup, since both use the
  same `jwlibrary://` finder link format.

### Fixes

- **Psalms with a superscription resolved every verse one off**: a
  superscription like Psalm 15's "A melody of David." occupies the chapter's
  first row in the Bible file without being verse 1, so the previous
  `firstVerseId + verse - 1` arithmetic silently resolved "Psalm 15:2" to
  verse 1's text and showed the chapter number where the verse number
  belonged. Detected from the row's own empty `Label` rather than a
  hardcoded list of which psalms have a superscription, so it generalizes to
  every affected psalm without guessing.
- **Poetic verses lost the spaces between their printed lines** (e.g. Psalm
  1:1's three lines): the jwpub chapter HTML splits such a verse across
  several continuation spans with no separating whitespace of its own — the
  line break itself was the separator in the source. Both the popup's own
  verse display and every "insert as quote" output ran the lines together
  ("…folgt**und** nicht…") until now, since both share the same underlying
  text segments.
- **"Insert as quote" (popup button) inserted the passage in the wrong
  place**: clicking a scripture link is intercepted before it can move the
  editor's cursor there, so inserting "at the current selection" landed
  wherever the cursor happened to be left over from the last time the note
  was actively edited — often far from the clicked reference. It now locates
  the actual clicked reference's own line in the note (by re-parsing the
  note's scripture links, so it also survives navigating to a cross-reference
  inside the popup before inserting) and inserts right after it. The button
  is also hidden entirely while the note is in Reading View, where there is
  no reliable place to insert into at all.
- Obsidian's Live Preview shows whichever line the cursor is on as raw
  markdown source rather than rendering it — since a text insertion leaves
  the cursor sitting inside what it just inserted, a freshly inserted quote
  callout could show as unstyled "> [!quote] …" text until clicking
  elsewhere. Both insertion paths now move the cursor past the whole
  inserted block afterwards, so the callout renders immediately.

## 1.8.3

### Fixes

- **Cross-chapter scripture citations now show the complete passage** (e.g. the real bible-drama citation "Mark 1:21–3:19") instead of just the start verse. 1.8.2 fixed the nonsensical range display but dropped the rest of the citation to get there; `Scripture` now has a `chapterEnd` field that preserves the full range through parsing, display ("Markus 1:21–3:19", en dash), the JW Library link, and verse-popup resolution (which now correctly walks across the spanned chapters). Verified against a real study Bible: 72 verses resolve correctly across the three chapters, with accurate chapter-start markers. The popup's verse-by-verse context-expansion buttons are hidden for such a citation (showing the already-requested full range, same as before).

## 1.8.2

### Fixes

- **Cross-chapter scripture citations showed a nonsensical verse range** (e.g. "Markus 1:21-19" for a real "Mark 1:21–3:19" citation) and failed to resolve in the verse popup. `fromJwpub()` took the end segment's verse number regardless of its chapter; it now drops `verseEnd` when the citation crosses chapters, matching the RTF parser's existing behaviour — the reference is shown as just its start verse.

## 1.8.1

### Fixes

- **`wtlocale` in generated links follows the note language**: scripture and song links hardcoded `wtlocale=X` (German) even inside notes generated from English program files. The locale now matches the link's language context (X = German, E = English) — notes follow the imported file's language, the popup's JW Library button follows the popup language. (`prefer=lang` meant the hardcoded X mostly still worked; matching the note's language is the correct source hint.)

### Other

- Roadmap: planned features now include "insert verse as quote" (offline, from the local Bible file) and documenting the JW Library Linker synergy.

## 1.8.0

### New features

- **In-popup navigation**: cross-reference and study-note links now navigate within the same popup, with a back arrow in the header walking the trail back — instead of stacking a new popup on top each time. The 10-popup safety cap from 1.7.2 is obsolete and removed.
- **Chapter context in the verse popup**: a new button row beneath the verse text expands the passage verse by verse (before/after) or shows the whole chapter. Chapter bounds are read from the Bible file's own `BibleChapter` table; without a known bound the forward/whole-chapter buttons stay hidden (verse ids continue seamlessly into the next chapter). On the way, two long-standing gaps were fixed: verses cited nowhere in the Bible file (e.g. Psalm 117:2) previously showed "no verse text available" or lost their inline cross-reference markers, and overlong citations could silently show the next chapter's verses.
- **Optional YAML frontmatter** (new toggle, off by default): every generated note gets frontmatter with deliberately language-independent English keys (`convention`, `type`, `day`, `time`) — e.g. for Dataview queries across mixed-language vaults.
- **Clickable notices**: the import success notice opens the first day's overview; the Bible-file hint notice opens the plugin's settings tab directly.
- CI now also runs the unit tests on every push/PR; a public [ROADMAP.md](ROADMAP.md) documents planned features.

### Fixes

- **Divider line above the "Open in JW Library" button removed** (it was the Setting row's default top border); spacing is unchanged.
- Notice click handlers use `noticeEl` deliberately (not the 1.8.7+ `messageEl`), keeping minAppVersion at 1.6.6.

## 1.7.2

### New features

- **Safety cap for stacked verse popups**: cross-reference and study-note links can open popups on top of popups without limit — every open popup holds its verse content in memory, and enough of them can slow Obsidian down or crash it, especially on mobile. At 10 simultaneously open popups, further ones are blocked with an explanatory notice asking to close some first.

## 1.7.1

### Fixes

- **Link context sheet no longer appears after a tap on iOS**: Obsidian starts its long-press timer on `touchstart` and cancels it in a `touchend` listener — the 1.7.0 tap fix stopped exactly that listener, so the orphaned timer fired ~400 ms later and the "open in browser / edit link / copy URL" sheet popped up right after the verse popup, in both views. Obsidian's touch handling for scripture links is now disarmed at `touchstart` (its tap helper never arms, the long-press timer never starts); native scrolling is unaffected. Long-pressing a scripture link now intentionally does nothing.

## 1.7.0

### New features

- **Study-note cross-references are clickable**: references like "See study note on Mt 5:18" inside the popup's study notes now open another verse popup. The target book is resolved from the Bible file's own document table (verified against all 3,557 study notes of a real study edition, German and English).
- **Fully bilingual interface**: the settings tab, import dialog and every notice follow the (renamed) "Language of the interface and Bible-verse popup" setting; the settings tab re-renders immediately when the language is switched.
- **Bible-file hint**: without a Bible file loaded, the first three scripture clicks (and every 20th after that) show a one-time tip that adding a Bible jwpub file enables the in-app verse popup.
- **Import preview shows the detected program-file language.**

### Fixes

- **iPhone editing view opened JW Library instead of the popup**: Obsidian's mobile tap helper handles `touchend` and calls its link handler directly — invisible to any click listener. The plugin now registers its own capture-phase `touchend` listener with the same tap heuristic (< 600 ms, < 5 px movement) and intercepts scripture taps before Obsidian's handler runs; scrolling and long-presses are untouched.
- **The verse popup opens instantly**: previously the very first click silently waited several seconds while the Bible file (up to ~125 MB) was decrypted and indexed; the popup now opens immediately and shows its loading state, and a load failure keeps it usable as a JW Library springboard.
- **Missing Bible file on a synced device** now produces a clear, actionable message (settings sync between devices, the file itself does not) instead of a cryptic error.
- **Scripture links are editable again in editing view**: clicks are only intercepted on the rendered link decoration — clicking into the raw markdown (cursor on the line) places the cursor normally instead of opening the popup.
- **Memory guidance for mobile**: the Bible-file setting now recommends the much smaller regular edition (nwt) for memory-constrained mobile devices.

### Other

- English `package.json` description, `authorUrl` in the manifest, corrected legacy `versions.json` entry.
- New English parser unit tests (synthetic fixtures); plugin-review lint warnings reduced from 28 to 2 (both remaining ones are the documented `display()` fallback for Obsidian < 1.13).

## 1.6.0

### New features

- **English program files are now fully supported.** The language of the imported file is detected automatically (`MepsLanguageIndex`); all generated notes, labels, file and folder names follow it — a German jwpub produces German notes (`00. Übersicht.md`, `**Bibeltexte:**`, …), an English one English notes (`00. Overview.md`, `**Scriptures:**`, …), including English Bible book names, folder names (`2026 Regional Convention – …`) and the review note. English-specific program details are handled correctly: `Song No. 160` lines, `jwpub://p/E:` song links, `CHAIRMAN’S ADDRESS:`/`FEATURE BIBLE DRAMA:`/`PUBLIC BIBLE DISCOURSE:` markers, `Music-Video Presentation`/`Intermission` entries and the `Find Answers to These Questions` document. Verified against real German and English files of all three convention types. (The RTF-ZIP fallback remains German-only.)
- **"Next:" hint in every program-item note**: each note now ends with what follows in the program — a song (with JW Library link), the next program item (linked to its note) or a break — with a visible three-line writing gap above it.
- **One-time update notice**: after a plugin update, a notice reminds you that note-template improvements only reach existing convention folders via delete + re-import.
- **Settings are searchable**: the settings tab now uses Obsidian's declarative settings API (1.13+), so every option is found by the app-wide settings search; older Obsidian versions keep the previous tab.

### Fixes

- **Bible-verse popup**: marker letters inside the footnote/cross-reference accordions now carry the same colors as their inline counterparts (footnotes orange, cross-references green); study-note labels get their own purple. The "Open in JW Library" button moved below the accordions, closing the popup.
- **Review note**: the type-specific instruction now sits as an italic "Hinweis:"/"Note:" line directly beneath the title (no more duplicated heading, since the filename already serves as the title).
- **Import dialog**: when the saved target folder no longer exists, the dialog now defaults to the vault root instead of pre-filling the "new folder" flow with a stale name.
- **Scripture-link clicks** are now intercepted at window level with `stopImmediatePropagation`, addressing JW Library opening in parallel with the popup in editing view.
- Declared `@codemirror/view` as a direct dependency and switched to `activeDocument` (popout-window compatibility) — resolves the plugin-review warnings.

### Other

- Plugin name and description in the manifest, and the README, are now in English (the plugin supports German and English program files; notes always follow the file's language).
- Replaced the broken `scripts/analyze-jwpub.mjs` (still required the removed `adm-zip`) with the working `scripts/dump-structure.mjs`.

## 1.5.1

### Fehlerbehebungen (Bibeltext-Popup)

- **Querverweis-Buchstaben in eigener Farbe**: nutzten bisher dieselbe Akzentfarbe wie die Vers-/Kapitelnummer und waren dadurch kaum von ihr zu unterscheiden.

## 1.5.0

### Neue Funktionen

- **„Wiederholung"-Notiz**: legt zusätzlich `Wiederholung.md` mit den drei Standard-Reflexionsfragen für die Kongress-Wiederholung in der Versammlung an. Bei Kreiskongressen mit Link zur bereits vorhandenen Notiz „Beantworte die folgenden Fragen", bei Regionalen Kongressen mit Hinweis auf das Highlights-Video (dafür gibt's keine auswertbaren Daten in der Programmdatei). Über die neue Einstellung „Wiederholungs-Notiz erstellen" abschaltbar (Standard: an).
- **Notiz-Felder einzeln abschaltbar**: die Felder „Tag", „Uhrzeit", „Bibeltexte" und „Redner" können jetzt jeweils einzeln aus- und eingeblendet werden. Zusätzlich eine neue Einstellung „Zusätzliche Felder" für frei definierbaren Text (z. B. ein eigenes `**Notizen:**`-Feld), der an jede Programmpunkt-Notiz angehängt wird.
- **Fortschrittsanzeige beim Import**: bei größeren Importen (mehr als 3 Dateien) zeigt eine laufend aktualisierte Notice den Fortschritt (`X/Y`) an, statt den Import bis zum Schluss als Blackbox laufen zu lassen.
- **Erneuter Import aktualisiert bestehende Kongresse**: rein abgeleitete Dateien ohne Schreibplatz (`00. Übersicht.md`, `Titelbild.<ext>`) werden bei erneutem Import jetzt automatisch aktualisiert, statt stillschweigend übersprungen zu werden – Plugin-Updates (neue Felder, Titelbild-Support, …) erreichen so auch bereits importierte Kongresse, ohne dass der Ordner gelöscht werden muss. Notizen mit Platz für eigene Einträge (Redner-Notizen, Wiederholungsfragen, `Wiederholung.md`) bleiben davon unberührt.
- **Bibeltext-Popup**: mit einer selbst bereitgestellten Bibel-jwpub-Datei (`nwt`/`nwtsty`, Einstellung „Bibel-Datei") öffnet ein Klick auf eine Bibelstelle jetzt ein Popup mit dem Vers-Text direkt in Obsidian (plus Button „In JW Library öffnen"), statt nur extern zu JW Library zu springen. Empfehlung: die Studienbibel (`nwtsty`) statt der einfachen Ausgabe – deutlich mehr Bibelstellen sind darüber auflösbar. Funktioniert sowohl in der Lesen-Ansicht als auch im Live-Preview-Bearbeiten-Modus (dort werden Links als CodeMirror-Deko-Elemente statt echter Links gerendert und brauchten einen eigenen Erkennungsweg).
- **Fußnoten und Querverweise im Bibeltext-Popup**: unterhalb des Vers-Texts werden jetzt auch die zugehörigen Fußnoten und Querverweise angezeigt (mit Vers-Nummer, falls mehrere Verse zitiert werden). Bei Querverweisen wird die Zielstelle als „Buch Kapitel:Vers" angezeigt, wenn sie in der Bibel-Datei selbst auflösbar ist – sonst nur der Zieltext ohne Stellenangabe.
- **Kapitelanfang optisch hervorgehoben**: die erste Versnummer eines Kapitels wird jetzt deutlich größer dargestellt als eine normale Versnummer, damit beide nicht mehr verwechselt werden.
- **Fußnoten-/Querverweis-Buchstaben direkt im Vers sichtbar**: die Marker (a, b, c, …) erscheinen jetzt an ihrer echten Position im Vers-Text, nicht mehr nur in der Liste darunter.
- **Studienanmerkungen im Bibeltext-Popup**: als eigener, standardmäßig zugeklappter Bereich (teils über 2.000 Zeichen pro Anmerkung – würde das Popup sonst stark aufblähen).
- **Fußnoten, Querverweise und Studienanmerkungen jetzt alle klappbar**: standardmäßig zugeklappt, mit Anzahl in der Überschrift, damit der Vers-Text beim Öffnen im Vordergrund bleibt.
- **Bibelstellen innerhalb von Fußnoten/Querverweisen/Studienanmerkungen anklickbar**: öffnen ein weiteres Popup (statt JW Library), damit man nicht aus Obsidian herausspringen muss.
- **Rückverweis zur Übersicht**: jede Programmpunkt-Notiz beginnt jetzt mit einem Link zurück zur Tages-Übersicht.
- **Lied-/Gebet-Hinweis in der Programmpunkt-Notiz**: folgt im Programm direkt ein Lied (ggf. mit Gebet), wird das jetzt auch in der Notiz des vorherigen Programmpunkts erwähnt und verlinkt, nicht nur in der Übersicht.

### Fehlerbehebungen (Bibeltext-Popup)

- **Popup öffnete zusätzlich JW Library**: Obsidians eigener Live-Preview-Link-Handler öffnete den Link weiterhin selbst, parallel zu unserem Popup. Behoben, indem unsere CodeMirror-Extension über `Prec.highest()` mit höchster Priorität registriert wird, sodass sie vor Obsidians eigenem Handler läuft.
- **Popup öffnete in der Bearbeiten-Ansicht weiterhin zusätzlich JW Library**: der `Prec.highest()`-Fix half nur gegen andere CodeMirror-Erweiterungen, nicht gegen einen Klick-Handler, den Obsidian direkt am Link-Element registriert. Ersetzt durch einen einzigen dokumentweiten Klick-Listener in der Capture-Phase, der zuverlässig vor jedem Obsidian-eigenen Handler greift – in Lesen- und Bearbeiten-Ansicht gleichermaßen.
- **Fußnoten-Buchstaben in eigener Farbe**: waren zuvor zu leicht mit der Versnummer zu verwechseln.
- **Bibelstellen wie Matthäus 13:34-35 lieferten „kein Vers-Text verfügbar"**: die Vers-Auflösung prüfte bisher nur den ersten Vers eines Zitatbereichs im internen Index; war ausgerechnet dieser (nicht aber ein Nachbarvers) nirgends zitiert, schlug alles fehl. Die Suche berücksichtigt jetzt auch benachbarte, indizierte Verse im selben Bereich.
- **Zitierstil korrigiert**: genau zwei aufeinanderfolgende Verse werden jetzt mit Komma dargestellt („34, 35" statt „34-35"), ein Bindestrich nur noch ab drei Versen („34-38") – entspricht der offiziellen Zitierkonvention und wirkt sich auf alle Notizen, die Übersicht und den Popup-Titel aus.
- **Popup-Darstellung überarbeitet**: mehrere Verse erscheinen jetzt als ein zusammenhängender Absatz (vorher: ein Absatz pro Vers, wirkte wie unzusammenhängende Einzelsätze) mit der Versnummer als kleine hochgestellte Zahl vor jedem Vers – wie im gedruckten Bibeltext.

## 1.4.0

### Neue Funktionen

- **Kein Wrapper-Ordner mehr beim Import**: Der Standard-Zielordner ist jetzt die Vault-Wurzel – jeder Kongress entsteht direkt als eigener Top-Level-Ordner, ohne zusätzlichen „Kongress"-Ordner darüber. Im Import-Dialog steht „Vault-Wurzel (kein Unterordner)" als eigene Dropdown-Option; ein bestehender oder neuer Ordner kann weiterhin gewählt werden.

### Fehlerbehebungen

- **Lieder-Link-`docid` korrigiert**: Die bisherige Formel (`docid = 1102016800 + Liednummer`) war keine verlässliche Regel, sondern traf nur zufällig für einen Teil der Lieder zu (z. B. Lied 14, 54, 94) – bei Lied 160 wich die echte `docid` um 6000 ab und der Link führte ins Leere. Die echte `docid` steht bereits in der jwpub-Datei selbst (im `jwpub://p/X:...`-Link jedes Liedes) und wird jetzt direkt daraus gelesen statt berechnet. Die alte Formel dient nur noch als Fallback für den RTF-Importpfad, der keine `docid` im Quellmaterial enthält.
- **„Psalm" statt „Psalmen"** bei Einzelzitaten aus den Psalmen (z. B. „Psalm 16:11“) – entspricht jetzt der offiziellen Vorlage.

## 1.3.5

### Fehlerbehebungen

- **Lieder-Link erneut korrigiert**: `jwlibrary://` funktionierte für Lieder auf einem echten iPhone nicht (weder mit noch ohne vollen Parametersatz). Lieder-Links nutzen jetzt wieder `https://www.jw.org/finder?...&docid=...` – die einzige Variante, die je nachweislich funktioniert hat. Bibeltexte bleiben unverändert bei `jwlibrary://`.

## 1.3.4

### Fehlerbehebungen

- **JW-Library-Links vervollständigt**: Lieder- und Bibeltext-Links enthielten bisher nur den jeweiligen Inhalts-Parameter (`docid=`/`bible=`), nicht aber `srcid`/`wtlocale`/`prefer`, die im per JW-Library-„Teilen"-Funktion bestätigten Referenzlink ebenfalls enthalten sind. Beide Linktypen nutzen jetzt exakt denselben Parametersatz wie die App selbst erzeugt.

### Sonstiges

- Veralteten, nirgends referenzierten Bau-Prompt (`docs/build-prompt.md`) entfernt – widersprach dem aktuellen Stand (z. B. `isDesktopOnly: true`, Frontmatter in Notizen).

## 1.3.3

### Fehlerbehebungen

- **Lieder-Link: endgültige Ursache behoben**: Das in 1.3.2 eingeführte `docid`-Format war korrekt (per echtem Test außerhalb Obsidian bestätigt), scheiterte aber innerhalb Obsidian, weil `https://`-Links auf Mobile über eine eingebaute WebView geöffnet werden, in der Universal Links (der App-Öffnen-Mechanismus) nicht funktionieren. Der Link nutzt jetzt wieder das `jwlibrary://`-Schema (wie Bibeltexte), das diese Falle umgeht.
- **Bibeltext-Links**: `&pub=nwtsty` ergänzt, passend zum Format, das JW Library Desktop selbst beim Teilen einer Bibelstelle erzeugt.

## 1.3.2

### Fehlerbehebungen

- **Lieder-Link endgültig repariert**: Das in 1.3.1 eingeführte `lank`-Format schlug ebenfalls auf einem echten iPhone fehl. Über JW Librarys eigene „Teilen"-Funktion wurde das korrekte, docid-basierte Format verifiziert (`https://www.jw.org/finder?...&docid=NNNNNNNNNN`) – bestätigt an zwei echten Liedern aus „Singt voller Freude für Jehova".

## 1.3.1

### Fehlerbehebungen

- **Lieder-Link repariert**: JW Library erkannte das bisherige Link-Format nicht und leitete stattdessen auf eine kaputte Web-Adresse um (bestätigt durch echten Smartphone-Test). Der Link nutzt jetzt das aus echten jw.org-Exporten bestätigte `lank`-Format (`jwlibrary:///finder?lank=pub-sjjm_NNN`, NNN = Liednummer + 500).

## 1.3.0

### Neu

- **Mobile-Unterstützung (iOS/Android)**: Das Plugin läuft jetzt auch auf Obsidian Mobile, nicht mehr nur auf Desktop (`isDesktopOnly: false`). Die jwpub-Entschlüsselung wurde komplett auf plattformunabhängige Web-APIs umgestellt:
  - AES-128-CBC-Entschlüsselung und SHA-256-Schlüsselableitung laufen jetzt über die Web-Crypto-API (`crypto.subtle`) statt über Node's `crypto`-Modul
  - zlib-Dekomprimierung läuft über `pako` statt Node's `zlib`-Modul
  - ZIP-Handling (jwpub- und RTF-Import) läuft über `fflate` statt `adm-zip`, das zwingend Node `fs`/`path`/`zlib` voraussetzte
  - Die Entschlüsselung wurde gegen eine unabhängige Referenzimplementierung auf Byte-Identität der entschlüsselten Inhalte geprüft
  - Klare Fehlermeldung statt kryptischem Absturz, falls ein Gerät ausnahmsweise kein WebCrypto/WebAssembly unterstützt

### Fehlerbehebungen

- **CSS-Lint-Warnung behoben**: Die Regeln zum Entfernen des Externe-Link-Icons bei Bibeltext-/Lieder-Links nutzten `!important`; das wurde durch höhere Selektor-Spezifität ersetzt (funktional identisch)

## 1.2.0

### Fehlerbehebungen

- **RTF-Fallback grundlegend repariert**: Der Import über RTF-ZIP erkannte bei echten Kongressdateien bisher keinen einzigen Tag/Programmpunkt (falsches Zeitformat-Muster, durchsickernde Hyperlink-URLs/Metadaten im Text). RTF funktioniert jetzt gleichwertig zum jwpub-Import:
  - Zeitformat „H Uhr [MM]" (z. B. „9 Uhr 20", volle Stunde nur „11 Uhr") statt des nicht vorkommenden „H:MM"
  - Neuer klammer-bewusster RTF-Decoder statt flachem Regex-Strip
  - Lieder, Musikvideos und Pausen werden jetzt als Programmpunkte erkannt (vorher komplett verworfen)
  - Bibeldrama-Untertitel und Vortragsreihen-Teile (mit eigenen Bibelstellen pro Teil) werden korrekt zusammengesetzt
  - Tagesmotto samt Bibeltext sowie Kongress-Motto und -Jahr werden jetzt auch aus RTF-Dateien gelesen
  - Mehrfach gezählte Bibelstellen (durch über mehrere Textläufe verteilte Zitate) werden dedupliziert

## 1.1.0

### Neu

- **Tagesmotto in der Übersicht**: Der Wochentag steht jetzt als große Überschrift (ohne "Tag:"-Präfix), darunter das Tagesmotto samt verlinkter Bibelstelle (z. B. „Geben macht glücklicher als Empfangen" (Apostelgeschichte 20:35)) – wird direkt aus dem jwpub-Tagesdokument gelesen.
- **Bibeltexte im Klammer-Format**: In Übersicht und Notizen stehen Bibeltexte jetzt wie im offiziellen gedruckten Programm in einer gemeinsamen Klammer (z. B. „(Matthäus 5:1-2; Psalmen 100:2)"), mit kurzem Bindestrich statt Halbgeviertstrich für Versbereiche.
- **Externes-Link-Icon entfernt**: Bibeltext- und Lieder-Links (`jwlibrary://`) zeigen kein Externe-Link-Icon mehr – weder in der Leseansicht noch beim Bearbeiten (Live Preview).

### Fehlerbehebungen

- **Bibeldrama-Zitat-Dopplung behoben**: Der Untertitel eines Bibeldramas zeigte die Bibelstellen-Zitate zusätzlich zum bereits separat verlinkten Bibeltext-Block an; die Zitate werden jetzt wie bei normalen Titeln aus dem Untertitel entfernt.

### Sonstiges

- Automatisierte Unit-Tests (Parser, Normalizer, NoteBuilder) über Node's eingebauten Test-Runner ergänzt.
- Ungenutzten `sql-wasm.wasm`-Rest aus dem Projekt-Root entfernt.

## 1.0.0

### Sonstiges

- **Release-Workflow korrigiert**: GitHub-Releases werden jetzt direkt veröffentlicht statt als Draft angelegt. Der Draft-Status verhinderte, dass Obsidians automatische Release-Prüfung das Release validieren konnte.

## 0.2.0

### Neu

- **Titelbild in der Übersicht**: Das Titelbild des jeweiligen Tages (Regionaler Kongress) bzw. des Kongresses (Kreiskongress, hat nur ein Deckblattbild) wird beim Import als `Titelbild.jpg` neben die Notizen geschrieben und oben in `00. Übersicht.md` eingebettet.
- **Pausen und Musikvideos in der Übersicht**: wurden bisher komplett übersprungen, erscheinen jetzt (wie Lieder) in der Tagesübersicht – ohne eigene Notiz.
- **Lieder-Zeile zeigt den vollständigen Programmtext**: statt nur „Lied NNN" wird jetzt die komplette Zeile übernommen, damit begleitende Hinweise (z. B. „Lied 43 (Bekanntmachungen und Gebet)") nicht mehr verloren gehen – in der Übersicht ist dabei weiterhin nur „Lied NNN" selbst verlinkt, der Rest steht als normaler Text daneben.

- **Zielordner-Auswahl im Import-Dialog**: bestehenden Vault-Ordner aus einem Dropdown wählen oder über „➕ Neuer Ordner …" einen neuen anlegen, statt nur den fest eingestellten Standardordner zu nutzen.
- **Eigener Kongressordner** pro Import, benannt nach Kongresstyp, Jahr/Saison und Motto (z. B. `Regionaler Kongress 2026 – Ewiges Glück` bzw. `Kreiskongressprogramm 2026-2027 – mit dem Kreisaufseher – „Titel"`).
- **Tagesordner für Regionale Kongresse** (Freitag/Samstag/Sonntag); Kreiskongresse bleiben eintägig ohne Unterordner.
- **Notiz-Nummerierung** in Programmreihenfolge (`01.`, `02.`, …) statt freier Titel – sorgt für eine chronologisch sortierte Dateiliste.
- **„Übersicht"-Notiz pro Tag** (`00. Übersicht.md`) mit dem kompletten Tagesprogramm:
  - jeder Programmpunkt verlinkt direkt auf seine Notiz
  - Vortragsreihen-Teile verlinken auf den passenden Abschnitt in der jeweiligen Notiz
  - Bibeltexte sind inline verlinkt
- **Lieder werden jetzt erfasst** (vorher komplett ignoriert) und erscheinen in der Übersicht mit JW-Library-Deeplink – weiterhin ohne eigene Notiz.
- **„Beantworte die folgenden Fragen"** (Kreiskongress-Wiederholungsfragen, im jwpub ein eigenständiges Dokument) wird jetzt erkannt und als eigene Notiz mit einer Überschrift pro Frage erzeugt; steht durch die Nummerierung immer an letzter Stelle.
- **Vereinfachtes Notiz-Format**: kein Frontmatter mehr, stattdessen direkt sichtbare Felder (`**Tag:**`, `**Uhrzeit:**`, `**Bibeltexte:**`, `**Redner:**`); die „Tag:"-Zeile entfällt bei Kreiskongressen (eintägig, aber terminlich variabel).

### Fehlerbehebungen

- **sql.js/WASM-Ladefehler behoben**: `initSqlJs()` fand die `.wasm`-Datei im Obsidian/Electron-Kontext nicht. Die `.wasm`-Datei wird jetzt beim Build per esbuild-`binary`-Loader als Base64 direkt in `main.js` eingebettet, statt separat per `fs.readFileSync` vom Dateisystem geladen zu werden – notwendig, da der Community-Plugin-Installer aus einem GitHub-Release ausschließlich `main.js`, `manifest.json` und `styles.css` herunterlädt und eine zusätzliche `sql-wasm.wasm`-Datei dort nie ankäme.
- **Titel-Duplikate behoben**: Bibelstellen-Zitate am Titelende (z. B. „(Psalm 16:11; 100:2)") wurden nicht mehr entfernt, da sie ohnehin separat als Bibeltext-Links angezeigt werden – jetzt auch bei Vortragsreihen-/Fragen-Teiltiteln.
- **Windows-inkompatible Ordnernamen behoben**: gerade Anführungszeichen (`"`) und Schrägstriche (`/`) in generierten Namen konnten die Ordnererstellung unter Windows lautlos scheitern lassen (z. B. `2026/2027` wurde als Unterordner interpretiert). Verbotene Zeichen werden jetzt durch optisch ähnliche Unicode-Zeichen ersetzt statt entfernt, damit z. B. ein Fragezeichen am Titelende erhalten bleibt.
- **Stille Importfehler behoben**: Fehler bei Ordner-/Notizerstellung werden jetzt abgefangen und als Obsidian-Notice angezeigt statt kommentarlos zu scheitern.
- **Nicht-transaktionaler Import behoben**: Schlägt der Import mitten in der Notiz-Erstellung fehl, werden die in diesem Durchlauf bereits erstellten Notizen jetzt automatisch wieder entfernt (`FileManager.trashFile`), statt eine unvollständige Notizmenge im Vault zurückzulassen. Dadurch `minAppVersion` auf 1.6.6 angehoben.
- **RTF-Fallback grundlegend überarbeitet**: Die bisherige Text-Normalisierung entfernte versehentlich sämtliche Absatzumbrüche, wodurch pro RTF-Datei praktisch nur ein einziger (meist unbrauchbarer) Programmpunkt erkannt wurde. Absatzgrenzen (`\par`/`\line`/`\page`) werden jetzt vor dem Entfernen der übrigen RTF-Steuerwörter erhalten. Zusätzlich werden Bibelstellen-Hyperlinks jetzt pro Absatz statt global über das gesamte Dokument zugeordnet. Eine direkt ausgewählte (nicht gezippte) `.rtf`-Datei wird jetzt ebenfalls erkannt, statt beim Entpacken eine Exception zu werfen.
- **Doppelte Bibelstellen bei Vortragsreihen behoben**: Die übergeordnete Vortragsreihen-Zeile zeigte zusätzlich zu jedem Teil auch noch die Bibelstellen aller Teile zusammengefasst an (Redundanz in Notiz und Übersicht). Die Teile-Liste wird bei der Extraktion jetzt ausgeschlossen.
- **Übersicht-Notiz aufgeräumt**: Bibelstellen-Referenzen werden jetzt visuell abgeschwächt dargestellt (kleiner, gedämpfte Farbe via `styles.css`), damit der Titel-Link bei Programmpunkten mit vielen Referenzen der visuelle Fokus bleibt.

### Sonstiges

- `scripts/test-parse.mjs` nutzt jetzt den echten `JwpubParser` (per `jiti` direkt aus der TypeScript-Quelle importiert) statt einer separat gepflegten Kopie der Parser-Logik – verhindert unbemerktes Auseinanderdriften zwischen Test und Produktivcode.
- Toten Code entfernt: nie erzeugter `ItemType` `'symposium'` und die dazugehörige, nirgends aufgerufene `NoteBuilder.itemTypeLabel()`.

## 0.1.0

Erste Implementierung: jwpub-Parser (AES-128-CBC + zlib Entschlüsselung), RTF-ZIP-Fallback, Datenmodell, Notiz-Generierung mit Frontmatter, Import-Dialog mit Vorschau.
