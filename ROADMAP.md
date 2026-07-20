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

- **Import of other jwpub publications** (Life and Ministry Meeting Workbook,
  Watchtower study edition) as meeting notes — the decryption, crypto and
  scripture-link infrastructure is fully reusable; unclear how much demand
  there is.

## Recently shipped

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
