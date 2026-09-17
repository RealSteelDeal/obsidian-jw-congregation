import { Scripture, VerseRun } from '../models/congress';
import { CongressLang, getBookName } from './bookNames';

export class ScriptureNormalizer {

	/**
	 * Parses jwpub-HTML format: "20:16:20" or range "20:16:20-20:16:22"
	 * (book:chapter:verse from the jwpub://b/NWTR/ link).
	 *
	 * A real bible-drama citation can span chapters, e.g.
	 * "41:1:21-41:3:19" (Mark 1:21–3:19) — an earlier version of this parser
	 * took the end segment's verse number regardless of its chapter, producing
	 * the nonsensical "Markus 1:21-19" (verse 19 doesn't come after verse 21
	 * within chapter 1; it's chapter 3's verse 19), and a later fix dropped the
	 * end segment entirely for cross-chapter ranges — losing the rest of the
	 * cited passage. `chapterEnd` now captures the end segment's own chapter
	 * when it differs, so the full range renders/resolves correctly (see
	 * Scripture.chapterEnd, format(), toJwLibraryLink(), BibleReader). A
	 * different BOOK for the end segment is not a real-world case for a single
	 * citation — defensively dropped rather than guessed at.
	 */
	static fromJwpub(raw: string): Scripture {
		const parts = raw.split('-');
		const start = ScriptureNormalizer.parseJwpubSingle(parts[0] ?? '');
		if (parts.length === 2) {
			const end = ScriptureNormalizer.parseJwpubSingle(parts[1] ?? '');
			if (end.book === start.book) {
				start.verseEnd = end.verseStart;
				if (end.chapter !== start.chapter) start.chapterEnd = end.chapter;
			}
		}
		return start;
	}

	private static parseJwpubSingle(segment: string): Scripture {
		const [b, c, v] = segment.split(':').map(Number);
		if (!b || !c || !v) throw new Error(`Invalid jwpub scripture: ${segment}`);
		return { book: b, chapter: c, verseStart: v };
	}

	/**
	 * Parses RTF/jw.org hyperlink format: "BBCCCVVV" or range "BBCCCVVV-BBCCCVVV"
	 * e.g. "40005001" → Matthew 5:1
	 */
	static fromRtf(raw: string): Scripture {
		// A comma-separated tail carries the further stretches of a gapped
		// citation. Nothing writes that form any more — JW Library does not
		// understand it (see bibleParam()) — but links written by a 1.19.0
		// development build already sit in real notes, and reading them back is
		// what lets a click on one still open the popup on every verse it
		// names instead of silently dropping the tail.
		const [headRaw, ...extraRaw] = raw.split(',');
		const parts = (headRaw ?? '').split('-');
		const start = ScriptureNormalizer.parseRtfSingle(parts[0] ?? '');
		if (parts.length === 2) {
			const end = ScriptureNormalizer.parseRtfSingle(parts[1] ?? '');
			// Same cross-chapter handling as fromJwpub() — see its doc comment.
			if (end.book === start.book) {
				start.verseEnd = end.verseStart;
				if (end.chapter !== start.chapter) start.chapterEnd = end.chapter;
			}
		}
		// Each tail part mirrors the head: one code for a single verse, two for
		// a range. A different book or chapter is not a shape this ever writes
		// — dropped rather than guessed at, exactly as fromJwpub() does for a
		// foreign end segment.
		const extraVerses: VerseRun[] = [];
		for (const part of extraRaw) {
			const codes = part.split('-');
			const from = ScriptureNormalizer.parseRtfSingle(codes[0] ?? '');
			if (from.book !== start.book || from.chapter !== start.chapter) continue;
			const run: VerseRun = { start: from.verseStart };
			if (codes.length === 2) {
				const to = ScriptureNormalizer.parseRtfSingle(codes[1] ?? '');
				if (to.book !== start.book || to.chapter !== start.chapter) continue;
				if (to.verseStart > from.verseStart) run.end = to.verseStart;
			}
			extraVerses.push(run);
		}
		if (extraVerses.length > 0) start.extraVerses = extraVerses;
		return start;
	}

	private static parseRtfSingle(code: string): Scripture {
		if (code.length < 8) throw new Error(`Invalid RTF scripture code: ${code}`);
		const book      = parseInt(code.slice(0, 2), 10);
		const chapter   = parseInt(code.slice(2, 5), 10);
		const verseStart = parseInt(code.slice(5, 8), 10);
		return { book, chapter, verseStart };
	}

	/**
	 * Formats a Scripture as a JW Library deeplink.
	 *
	 * Uses the jwlibrary:// custom protocol — this is the standard format used by
	 * other JW Library-linking tools (e.g. obsidian-library-linker) and works
	 * correctly on a properly functioning JW Library install. If this fails to
	 * navigate to the reference, it's very likely a broken/buggy local JW Library
	 * installation rather than an issue with this URL — reinstalling JW Library or
	 * clearing its app cache is the first thing to try.
	 *
	 * The full query (`srcid`/`wtlocale`/`prefer`/`pub=nwtsty`, not just `bible=`)
	 * matches exactly what JW Library's own "Share" feature produces for a verse
	 * (confirmed against a real share from the Windows desktop app) — only the
	 * scheme+host are swapped for jwlibrary://. Closest match to what the app
	 * itself generates is the most reliable bet (same reasoning as the song link).
	 *
	 * `wtlocale` follows the language the link is generated for (X = German,
	 * E = English) — it used to be hardcoded to X, which put a German source
	 * locale into links inside English notes. `prefer=lang` makes JW Library
	 * favour the user's own language either way, so X mostly still worked, but
	 * matching the note's language is the correct hint. Defaults to 'de' for
	 * callers without a language context.
	 *
	 * A citation with a gap in it ("1. Tim. 4:12, 14-16") cannot be expressed as
	 * ONE link — see bibleParam() — so this returns the link for its LEADING
	 * stretch only. Callers that render the whole citation use
	 * toMarkdownLink(), which emits one link per stretch.
	 */
	static toJwLibraryLink(s: Scripture, lang: CongressLang = 'de'): string {
		return ScriptureNormalizer.linkForRun(s, ScriptureNormalizer.runs(s)[0]!, true, lang);
	}

	/** Every stretch of verses the citation names, its leading one first. */
	private static runs(s: Scripture): VerseRun[] {
		const head: VerseRun = { start: s.verseStart };
		if (s.verseEnd !== undefined) head.end = s.verseEnd;
		return [head, ...(s.extraVerses ?? [])];
	}

	private static linkForRun(s: Scripture, run: VerseRun, isHead: boolean, lang: CongressLang): string {
		const params = `srcid=jwlshare&wtlocale=${ScriptureNormalizer.wtlocale(lang)}&prefer=lang`;
		return `jwlibrary:///finder?${params}&bible=${ScriptureNormalizer.bibleParam(s, run, isHead)}&pub=nwtsty`;
	}

	/**
	 * Builds the `bible=` value for ONE stretch of verses — the single place a
	 * citation is turned into JW Library's own reference syntax.
	 *
	 * Only the two established shapes are ever written: `BBCCCVVV` for a single
	 * verse and `BBCCCVVV-BBCCCVVV` for a range, same-chapter or cross-chapter
	 * alike (the range form is what JW Library's own "Share" produces).
	 *
	 * **A comma-separated list of verses does not work** — tried in development
	 * for 1.19.0 with `…012,…014-…016` and confirmed against a real JW Library
	 * install on 17.09.2026: the app opens and immediately closes again, the
	 * same bounce the song links produced for years on an equally unverified
	 * parameter shape (see AGENTS.md, "Lieder-Link-Historie"). That is why a
	 * gapped citation is rendered as several links rather than one — never
	 * reintroduce the comma here without new evidence.
	 */
	private static bibleParam(s: Scripture, run: VerseRun, isHead: boolean): string {
		// Only the leading stretch can run into a later chapter; a stretch after
		// a gap is same-chapter by definition (see Scripture.extraVerses).
		const endChapter = isHead ? s.chapterEnd ?? s.chapter : s.chapter;
		const start = ScriptureNormalizer.toRtfCode(s.book, s.chapter, run.start);
		if (run.end === undefined || (endChapter === s.chapter && run.end === run.start)) return start;
		// The bible= param is just two BBCCCVVV codes — it already supports a
		// cross-chapter range natively, no different handling needed here than
		// for a same-chapter one.
		return `${start}-${ScriptureNormalizer.toRtfCode(s.book, endChapter, run.end)}`;
	}

	// MEPS locale symbols, confirmed against real jwpub filenames and song
	// hrefs (jwpub://p/<symbol>:<docid>/) for each language's own programme
	// files — not guessed.
	private static readonly WTLOCALE: Record<CongressLang, string> = {
		de: 'X', en: 'E', fr: 'F', it: 'I', pt: 'TPO', ru: 'U', es: 'S',
	};

	/** MEPS locale symbol for a supported language (the wtlocale= URL parameter). */
	static wtlocale(lang: CongressLang): string {
		return ScriptureNormalizer.WTLOCALE[lang];
	}

	/**
	 * Formats a Scripture as human-readable string, e.g. "Sprüche 16:20" or
	 * "Mt 5:1-12". Matches the official citation convention: exactly two
	 * consecutive verses are separated by a comma ("34, 35"), a range of three
	 * or more uses a hyphen ("34-38"). A cross-chapter range (chapterEnd set)
	 * uses an en dash between the two chapter:verse pairs instead, e.g.
	 * "Markus 1:21–3:19" — confirmed against real bible-drama citation text; a
	 * plain hyphen there is reserved for a same-chapter verse range.
	 */
	static format(s: Scripture, lang: CongressLang): string {
		// Every stretch is written the same way, and they are joined with the
		// comma the citation convention uses across a gap ("1. Tim. 4:12, 15-17").
		const body = ScriptureNormalizer.runs(s)
			.map((run, i) => ScriptureNormalizer.runLabel(s, run, i === 0))
			.join(', ');
		return `${getBookName(s.book, lang)} ${s.chapter}:${body}`;
	}

	/** One stretch of verses in the citation convention's own spelling: "15",
	 *  "15, 16" for exactly two adjacent verses, "15-17" for three or more, and
	 *  the en-dash "13–6:1" form when the leading stretch runs into a later
	 *  chapter. */
	private static runLabel(s: Scripture, run: VerseRun, isHead: boolean): string {
		if (isHead && s.chapterEnd !== undefined && s.chapterEnd !== s.chapter) {
			return `${run.start}–${s.chapterEnd}:${run.end}`;
		}
		if (run.end === undefined || run.end === run.start) return String(run.start);
		return run.end - run.start === 1 ? `${run.start}, ${run.end}` : `${run.start}-${run.end}`;
	}

	/**
	 * Renders a Scripture as Markdown: [Spr 16:20](jwlibrary:///finder?bible=20016020)
	 *
	 * A citation with a gap becomes SEVERAL links, one per stretch of verses —
	 * "[1. Timotheus 4:12](…), [14-16](…)" — since JW Library has no reference
	 * syntax covering a gap (see bibleParam()). Each link on its own uses only
	 * an established shape, so every part of the citation actually navigates.
	 *
	 * `prefix` replaces what precedes the first stretch's verse numbers. The
	 * editor suggester passes the user's own spelling ("1. Tim. 4:") so that
	 * linking a typed reference never rewrites it into the full book name.
	 */
	static toMarkdownLink(s: Scripture, lang: CongressLang, prefix?: string): string {
		const head = prefix ?? `${getBookName(s.book, lang)} ${s.chapter}:`;
		return ScriptureNormalizer.runs(s)
			.map((run, i) => {
				const label = (i === 0 ? head : '') + ScriptureNormalizer.runLabel(s, run, i === 0);
				return `[${label}](${ScriptureNormalizer.linkForRun(s, run, i === 0, lang)})`;
			})
			.join(', ');
	}

	private static toRtfCode(book: number, chapter: number, verse: number): string {
		return (
			String(book).padStart(2, '0') +
			String(chapter).padStart(3, '0') +
			String(verse).padStart(3, '0')
		);
	}
}
