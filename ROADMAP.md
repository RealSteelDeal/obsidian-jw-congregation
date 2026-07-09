# Roadmap

What's planned for the JW Convention Program plugin, roughly in order. No dates —
items move up when they're ready. Suggestions welcome via GitHub issues.

## Planned

- **Chapter context in the verse popup** *(next up)*: load the verses
  before/after the cited passage, or the whole chapter, without leaving the
  popup.
- **More program-file languages** (Spanish, French, …): the architecture is in
  place (central string table, language-tolerant parsing patterns, automatic
  language detection) — each language needs real program files for testing,
  its type-marker variants and a string-table entry.

## Later (deliberately deferred)

- **Raise minAppVersion to 1.13 and drop the imperative settings fallback**:
  tried once and reverted — a real 1.12.7 install rendered an empty settings
  tab, since Obsidian 1.13 (declarative settings API) is not broadly deployed
  yet (public release is 1.12.7 as of July 2026). Revisit once 1.13 has been
  the stable public release for a while.
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

- In-popup navigation with a back arrow for cross-references and study notes
  (instead of stacking popups)
- Optional YAML frontmatter (stable English keys) for Dataview queries
- Clickable notices: import success opens the day overview, the Bible-file
  hint opens the plugin settings
- English program files, fully bilingual interface, Bible-verse popup with
  footnotes, cross-references and study notes
