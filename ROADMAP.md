# Roadmap

What's planned for the JW Convention Program plugin, roughly in order. No dates —
items move up when they're ready. Suggestions welcome via GitHub issues.

## Planned

- **Insert verse as quote**: a button in the verse popup that inserts the
  verse text into the active note as a quote/callout — sourced from the local
  Bible file, fully offline (the counterpart to JW Library Linker's online
  quote fetching, staying true to this plugin's no-network principle).
- **Document the JW Library Linker synergy in the README**: links created by
  the [JW Library Linker](https://github.com/msakowski/obsidian-library-linker)
  plugin should already open this plugin's offline verse popup (both use the
  jwlibrary:// finder format) — verify against its generated links, then
  describe the combination as a tip.
- **More program-file languages** (Spanish, French, …): the architecture is in
  place (central string table, language-tolerant parsing patterns, automatic
  language detection) — each language needs real program files for testing,
  its type-marker variants and a string-table entry.

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
