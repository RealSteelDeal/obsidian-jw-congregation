# Roadmap

What's planned for the JW Convention Program plugin, roughly in order. No dates —
items move up when they're ready. Suggestions welcome via GitHub issues.

## Planned

Nothing queued right now — suggestions welcome via GitHub issues.

## Later (deliberately deferred)

- **Moving import work off the main thread** (Web Worker): unzip/decrypt of a
  jwpub currently blocks Obsidian's UI for 1–3 seconds during import.
  Deferred until it hurts in practice — the rework is disproportionate to the
  current pain.

## Under consideration

- **Import of the Watchtower study edition** as meeting notes — the Life
  and Ministry Meeting Workbook is now covered (see "Recently shipped"); the
  same decryption/crypto/scripture-link infrastructure is reusable for the
  Watchtower, but its document structure (paragraph-numbered study article,
  not a fixed weekly section layout) hasn't been examined yet.
- **Meeting-Workbook support for languages other than German** — the parser
  currently rejects any other detected file language outright, since the
  three section-heading labels and the Congregation-Bible-Study title double
  as parser detection anchors and only German real files have been verified.
- **Preview/diff for the regular marker-based merge, not just the legacy
  fallback**: "Update convention notes" currently applies a marker-merge
  immediately for 1.9.0+ notes, and only shows a review window (see
  `LegacyMigrationModal`) for older, marker-free notes. Offering the same
  per-note preview/confirmation for the regular path too would make the
  behavior consistent regardless of a note's age.
- **Bulk update across multiple already-imported conventions** in one run,
  instead of picking one folder at a time via "Update convention notes".
- **Speaker directory**: a generated overview note (or Dataview query
  template) collecting who spoke when across conventions, built on top of
  the existing free-text Speaker field.
- **Customizable note template** beyond the current per-field show/hide
  toggles — user-defined field order or additional structural elements.
- **Calendar / Periodic Notes integration**: link convention days into
  Obsidian's Daily/Periodic Notes, or export an `.ics` file for external
  calendars.
- **Test-coverage reporting in CI**: Node 20+'s built-in
  `--experimental-test-coverage` flag needs no new dependency and would make
  the test-suite's actual coverage surface visible instead of requiring a
  manual audit to find gaps.
- **Publish to the official Obsidian community plugin directory** — the
  README currently says "not published yet, in review"; this remains the
  single biggest lever for reach once it clears review.

## Recently shipped

- **Import of the Life and Ministry Meeting Workbook ("Leben und Dienst")**,
  German only for now: one Markdown note per week — not one per assignment,
  since a week's schedule is read as a whole — covering all three fixed
  sections, every numbered item (duration, ministry-assignment label, source
  citation, discussion questions where present), the opening/mid-week/closing
  songs, and the always-last Congregation Bible Study. The "Bibelleseprogramm
  für das Gedächtnismahl" insert that appears in the Memorial-season issue
  gets its own per-day reading-checklist note. Has its own import/update
  commands, ribbon icon and settings section, fully independent of the
  convention-program feature; every derived field is wrapped in the same
  invisible-marker mechanism as convention notes, so "Update Meeting Workbook
  notes" can refresh a corrected schedule without touching anything typed
  underneath an item.
- **Quality-audit follow-through**: `main.ts` now has automated test coverage
  (import/update rollback, create/skip/regenerate accounting, marker-merge
  and legacy-field-correction branching) via a minimal Obsidian-API test
  double; every decompression step (jwpub/RTF-ZIP file, unzipped entries,
  decrypted blobs) is now guarded against zip-bomb-style oversized input;
  parsing/decryption failures are translated into the interface language
  instead of appearing as hardcoded German/English text; `LICENSE` and
  `AGENTS.md` were corrected/brought back in sync with the current codebase.
- **An inserted quote is now clickable, and removable from its own popup**:
  the callout title is a `jwlibrary://` link, same as any inline reference,
  and the verse-text body is one too (de-styled back to plain quote text, not
  the usual blue/underline) — the WHOLE callout box (background, padding,
  icon, title or body text) is one click target, opening the verse popup
  regardless of exactly where inside it was clicked. Opened that way, the
  popup offers "Remove quote" instead of "Insert as quote" (re-inserting the
  very quote already shown would just be a redundant copy) — deletes the
  whole callout block in place. Fixed a related bug where inserting a
  cross-reference as a separate new quote, from a popup opened via an
  existing quote, could land the new callout inside the existing one's own
  blockquote and corrupt both.
- **"Update convention notes" can propose field corrections for pre-1.9.0
  notes**, which have no merge markers and previously could only be
  reported as needing a full re-import. A conservative label-anchored
  heuristic finds Day/Time/Scriptures/"Anschließend" lines that are
  unambiguous (the label appears exactly once) and offers them as
  corrections in a new review window — every proposed change is shown
  old→new per note with its own on/off switch, nothing is written until
  "Apply" is clicked. Ambiguous fields (e.g. repeated per-part scripture
  lines in a symposium note) and the Speaker field are never touched.
- **The plugin interface itself now supports all 7 languages**, not only
  German/English: settings tab, Bible-verse popup, import/update dialogs
  and every notice are fully translated into French, Italian, Portuguese,
  Russian and Spanish too. Independent of a note's own language — the
  interface language is a separate setting from what a given imported
  program file is written in. Also surfaced the "Import & update convention
  programs" functions directly in the settings tab (previously only in the
  ribbon icon / command palette), with an explanation of the difference
  between the two and an "Open" button for each.
- **Reorganized the settings tab into consistent groups**: "General" (target
  folder, interface language), "Note fields" (now also including "Create
  review note") and "Scripture references" — every setting now belongs to a
  named group instead of some sitting loose at the top.
- **Bible-verse popup can now be switched off on its own**, independent of
  whether a Bible file is loaded — a new "Enable Bible-verse popup" toggle
  next to the existing scripture-linking and typed-suggestion settings.
  Also regrouped all scripture-related settings (linking, popup, typed
  suggestions) under one "Scripture references" heading, in both the
  declarative settings UI and the older fallback tab.
- **Two more typed-scripture-suggestion actions, and made all four
  configurable**: alongside linking and inserting a quote (which replaces the
  typed reference), the suggestion menu now also offers "link & open JW
  Library immediately" and "insert as quote & keep the link" (turns the
  reference into a link instead of consuming it, then adds the quote below).
  A new settings section lets each of the four be individually enabled/
  disabled and freely reordered — the saved order is exactly the order shown
  in the menu.
- **Fixed a verse-resolution bug for psalms with a superscription** (e.g.
  Psalm 15's "A melody of David."): it occupies the chapter's first row
  without being verse 1, so naive arithmetic was off by one for every verse
  of such a psalm — "Psalm 15:2" silently resolved to verse 1. Detected from
  the row's own (empty) label, not a hardcoded list of which psalms have one.
- **Fixed missing spaces between poetic verse lines** (e.g. Psalm 1:1's three
  printed lines): the jwpub source has no separating whitespace of its own
  between them, so the popup and "insert as quote" both ran words together
  ("…folgtund nicht…"). Affected both the popup's own verse display and
  every quote insertion, since they share the same underlying text.
- **"Insert as quote" now lands next to the reference it came from**, not at
  a stale, unrelated cursor position: the popup button locates the actual
  clicked reference's line in the note (surviving in-popup navigation to a
  cross-reference) rather than relying on the editor's last-remembered
  cursor, which was never moved by the click in the first place. Also hidden
  entirely while a note is in pure Reading View, where there's no reliable
  place to insert into.
- **Update convention notes without touching your own text**: a new "Update
  convention notes" command re-parses the same program file and patches an
  already-imported folder in place — every generated field (day, time,
  scripture links, headings, the "Anschließend"/"Next" hint) is refreshed
  while speaker names and personal notes stay exactly as typed, even inside
  the same note. Works via invisible `%%…%%` markers NoteBuilder now wraps
  around each derived field; notes from before this feature have none, so
  they're safely left alone and reported separately rather than guessed at.
- **Five more program-file languages**: French, Italian, Portuguese, Russian
  and Spanish jwpub programme files now parse and generate notes in their own
  language, detected automatically from `MepsLanguageIndex` — same as German/
  English. Book names are read verbatim from each language's own Bible jwpub
  file rather than hand-translated. `settings.lang` (the interface/popup
  language) stays German/English only; a note's own language always follows
  the imported file.
- **Insert verse as quote**: a button in the verse popup inserts the shown
  verse text into the active note as a quote/callout — sourced from the local
  Bible file, fully offline.
- **Type a scripture reference anywhere and get a link/quote suggestion**:
  typing e.g. `Psalm 12:1` in any note triggers a suggestion (as-you-type,
  like the built-in wikilink/tag autocomplete) offering to turn it into a
  `jwlibrary://` link or insert the verse text as a quote directly — the
  offline counterpart to JW Library Linker's own reference recognition.
  Recognizes full book names and common truncated abbreviations ("Matth.",
  "Ps", "1 Mo", …) in the interface language (German/English) — resolved via
  prefix matching against the already-verified full names, not a separate
  guessed abbreviation table.
- Documented the JW Library Linker synergy in the README: links created by
  the [JW Library Linker](https://github.com/msakowski/obsidian-library-linker)
  plugin already open this plugin's offline verse popup (both use the
  jwlibrary:// finder format).
- Language-aware `wtlocale` in generated JW Library links (X for German,
  E for English notes)
- Chapter context in the verse popup: verse-by-verse expansion and a
  whole-chapter view, with chapter bounds read from the Bible file itself —
  which also fixed verses cited nowhere (e.g. Psalm 117:2) losing their
  cross-reference markers
- In-popup navigation with a back arrow for cross-references and study notes
  (instead of stacking popups)
- Optional YAML frontmatter (stable English keys) for Dataview queries
- Clickable notices: import success opens the day overview, the Bible-file
  hint opens the plugin settings
- English program files, fully bilingual interface, Bible-verse popup with
  footnotes, cross-references and study notes
