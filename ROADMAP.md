# Roadmap

What's planned for the JW Convention Program plugin, roughly in order. No dates —
items move up when they're ready. Suggestions welcome via GitHub issues.

## Planned

- **Korean program files** (requested in
  [#1](https://github.com/RealSteelDeal/obsidian-jw-congregation/issues/1)).

  **Established on 17.09.2026**, from official sources rather than derived:
  - MEPS locale symbol for the `wtlocale=` link parameter: **`KO`** — jw.org's media API
    answers `langwritten=KO` with `한국어`;
  - `Publication.MepsLanguageIndex`: **`129`** — read from the official `nwt_KO.jwpub`. The
    method was validated first against a German file, which reports the `2` already recorded
    here;
  - the 66 book names — extracted from that file's `BibleBook` table
    (`scripts/dump-book-names.mjs`). **Their citation form is unconfirmed**: the column they
    come from holds the formal title in German, not the short form, so the choice is proven
    per language and Korean's could not be checked the same way.

  **What still blocks it, and it is larger than those three facts.** `SupportedLang` and
  `CongressLang` are one and the same set, so adding `'ko'` makes the compiler demand a
  complete localisation: all 160 keys of `Strings` (`src/i18n.ts`), and `LANG_DISPLAY_NAMES`
  grows from 49 to 64 entries because every existing language also needs its name in Korean.
  There is no intermediate state where only the three data points are present.

  Six of those keys are not translation at all but **parser anchors** — `caFallbackDay`,
  `defaultSession`, `reviewQuestionsSession`, `questionsTitle`, `bibleDramaFallback`,
  `song(n)` — matched against the real file's own HTML. Invented values compile cleanly and
  break the import silently, which is the worst possible failure mode here. They have to be
  read off a real Korean **convention programme**; the Bible file used above does not contain
  them.

  **A realistic path**, should the full localisation be too much to ask of a reporter: build
  `ko` as `{ ...L.en, <the Korean values that are known> }`, so untranslated interface text
  falls back to English instead of blocking the feature. That reduces the genuine ask to the
  six parser anchors plus roughly ten note labels (Day, Time, Scriptures, Speaker, "Next:",
  the overview/review/cover-image names) — and the anchors still need a real programme file.

  **The groundwork for that path is in place.** `LANG_DISPLAY_NAMES` rows are now partial
  with an English fallback (`displayName()`), so a new language brings its own row instead of
  first having to be written into all seven existing ones — which would have meant inventing
  each language's name in Korean. `L` carries the recipe for a partly translated language,
  including which six keys must not be left on the English fallback. Nothing is wired up:
  `'ko'` is deliberately not in `SupportedLang` and `129` is deliberately not in
  `MEPS_LANGUAGE_INDEX`, so a Korean file still behaves exactly as before (the convention
  parser falls back to German — which is what the reporter is seeing).

  Meeting Workbook import would additionally need the three Korean section headings and the
  Congregation Bible Study title, which likewise double as detection anchors (see
  "Meeting-Workbook support for languages other than German" below).
- **`Phlm.` for Philemon still cannot be typed** — the one gap left, and a small one.
  The abbreviation table below is built only from what real publications were seen to
  print, and none of the eleven German files checked cites Philemon even once, so there is
  nothing to read; inventing the entry is precisely what the table exists to prevent.

  Measured consequence: with the table in place, **65 of the 66 books resolve at four
  characters or fewer**, most at two or three. Philemon alone needs five (`Phile`), because
  `Phil` now belongs to Philipper. So this is not a missing-list problem — completing the
  table to 66 entries would mean inventing 58 that change nothing. It needs one publication
  that actually cites Philemon, and `scripts/dump-book-abbreviations.mjs` will pick the
  abbreviation up on its next run.

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
- **Speaker directory**: a generated overview note (or Dataview query
  template) collecting who spoke when across conventions, built on top of
  the existing free-text Speaker field.
- **Customizable note template** beyond the current per-field show/hide
  toggles — user-defined field order or additional structural elements.
- **Calendar / Periodic Notes integration**: link convention days into
  Obsidian's Daily/Periodic Notes, or export an `.ics` file for external
  calendars.

## Recently shipped

- **Update several conventions at once.** A parser fix applies to every convention ever
  imported, so the update no longer has to be repeated folder by folder: all the program
  files are picked together and each is paired with the folder its first import created,
  matched by folder **name** anywhere in the vault rather than only at the root.

  Every pairing stays a proposal — a full dropdown per row, "do not update" always
  available, an unreadable file saying why instead of vanishing, and two files aimed at one
  folder stopping the run before anything is written. One convention failing rolls back only
  its own new files and is named in the summary; the rest are still updated in full.

  `updateFile()` became a one-job call into the new `updateFolders()`, so the merge itself
  exists once and a single-folder run reports exactly the notices it always did.

- **Three German book names were wrong, and are corrected**: *Zephanja* (was "Zefanja"),
  *Esther* (was "Ester") and *Hohes Lied* (was "Hoheslied"). Found when a user typed
  "Zephan" and the new completion stayed silent — the name it was matching against simply
  was not how the book is spelled.

  Every name in all seven languages was then checked against its own Bible file's titles.
  The only mismatches anywhere were these three, and all three were German — the one
  language whose names had been hand-translated rather than read from the files. The five
  read from files had none, which is the project's own convention proving itself. A test
  now asserts that all 7 × 66 names complete from their first three characters, so this
  class of error cannot return unnoticed.

  The abbreviation entry `Zeph.` was removed with the fix: it had only existed to paper
  over the wrong name, and the prefix rule reaches *Zephanja* on its own.

- **Book names complete themselves while you type.** `Apo` offers
  `Apostelgeschichte`; the chapter and verse stay yours to type, and the existing
  link/quote suggestion takes over from there.

  The trigger was chosen by measurement, not taste. Firing on any word of three or more
  letters that begins a book name would have gone off 93 times across a real 14-note vault,
  46 of them on ordinary prose — `mich` alone 30 times, since it begins *Micha*. Requiring
  the capital letter German gives every noun anyway brings that down to eight in nearly
  12 000 words. On by default, switchable off in the settings.

- **The abbreviations real publications print are now understood when typed.** `Phil. 4:6,7`
  used to be refused outright — "phil" prefixes Philipper *and* Philemon, so the
  unique-prefix rule could not settle it and the book had to be written out. Alongside it,
  more that no prefix rule can ever reach: `Apg.`, `Offb.`, `Klg`, plus `Jas.` in English
  and the singular `Salmo` / `Псалом` in Italian and Russian.

  None of them was typed from memory. Each was read off a real file by
  `scripts/dump-book-abbreviations.mjs`, which pairs a citation's visible text with the
  book number in its own `jwpub://b/NWTR/` href — and the Bible file, the obvious first
  guess, turned out to carry no abbreviations at all. The table extends the prefix rule
  instead of replacing it, since it only ever covers the books a given publication happens
  to cite.

- **A reference can be extended after it was written**, for the case it came from: a
  speaker announces "let's read 1 Timothy 4 from verse 12" and does not say where he will
  stop. You write `1. Tim. 4:12`, he reads on to 14, and correcting the note afterwards
  meant typing the reference again. Now the passage is widened in the popup while he reads
  and applied to the note at the end.

  Widening still never changes the note by itself — that is the point, since the range is
  only known once the reading is over. An **Extend reference** button appears once the
  passage really has been widened, and opens a menu offering to either replace the
  reference or keep the original and add the wider one beside it. The button is set apart by colour, since it is the only popup action that
  rewrites text already in the note. It never appears for a cross-reference navigated to,
  only for a genuine widening of the same passage, and the reference it rewrites is located
  fresh from the editor and matched by its parsed scripture — so a line carrying several
  references keeps the other ones intact. The book is left spelled as it was written
  ("Phil. 4:" stays "Phil. 4:").
  `softprops/action-gh-release` moved from `v2` to `v3`, whose only change is the action's
  own runtime (Node 20 → 24); the four inputs the workflow passes are unchanged. GitHub was
  already forcing `v2` onto Node 24 and annotating every release run — borrowed time that
  would have ended with a broken release. **Verified end to end on 17.09.2026** in a
  throwaway repository rather than by waiting for the next real release: the same
  `extract-changelog.mjs`, the same four inputs, a tag push. The release was created with
  the right name, all three artefacts attached, the notes taken from the correct changelog
  section (and the section below it correctly left out), and no deprecation annotation.
- **Test coverage is reported in CI**, on one Node version, printed in the job log. No
  threshold is set: picking one is a policy decision, and nothing here can fail a build over
  it. Also available locally as `npm run test:coverage`.
- **Every citation form typed as plain text is now recognized and linked.**
  Previously only "chapter:verse" and "chapter:verse-verse" were, which left
  three forms from ordinary note-taking silently unlinked: verses listed with
  commas, whether adjacent ("Röm. 2:14,15") or across a gap and themselves
  possibly ranges ("1. Tim. 4:12,15-17"); references running into a later
  chapter ("Hebräer 5:13-6:1"); and — separately — a finished link that kept
  showing its own "[…](…)" markup, because the cursor was left touching it.
  What counts as one stretch of verses is derived from the verses named, not
  from where the comma sits, so an unbroken citation stays a single range
  however it is written.
- **Published in the official Obsidian community plugin directory**, so the
  plugin installs through **Settings → Community plugins → Browse** instead of
  copying files into the vault by hand.
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
