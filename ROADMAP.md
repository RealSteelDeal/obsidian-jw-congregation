# Roadmap

What's planned for the JW Convention Program plugin, roughly in order. No dates —
items move up when they're ready. Suggestions welcome via GitHub issues.

## Planned

- **Song titles**: with a user-supplied songbook jwpub (`sjjm`), show the song's
  title next to its number in overviews and "Next:" hints — same mechanism as
  the Bible file for the verse popup.
- **Chapter context in the verse popup**: load the verses before/after the
  cited passage, or the whole chapter, without leaving the popup.
- **More program-file languages** (Spanish, French, …): the architecture is in
  place (central string table, language-tolerant parsing patterns, automatic
  language detection) — each language needs real program files for testing,
  its type-marker variants and a string-table entry.

## Under consideration

- **Import of other jwpub publications** (Life and Ministry Meeting Workbook,
  Watchtower study edition) as meeting notes — the decryption, crypto and
  scripture-link infrastructure is fully reusable; unclear how much demand
  there is.
- **Moving import work off the main thread** (Web Worker): unzip/decrypt of a
  jwpub currently blocks Obsidian's UI for 1–3 seconds during import.
  Deliberately deferred until it hurts in practice — the rework is
  disproportionate to the current pain.

## Recently shipped

- In-popup navigation with a back arrow for cross-references and study notes
  (instead of stacking popups)
- Optional YAML frontmatter (stable English keys) for Dataview queries
- Clickable notices: import success opens the day overview, the Bible-file
  hint opens the plugin settings
- English program files, fully bilingual interface, Bible-verse popup with
  footnotes, cross-references and study notes
