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
		// A comma-separated tail carries the further single verses of a gapped
		// citation (see toJwLibraryLink/bibleParam) — reading it back is what
		// lets a click on such a link resolve to the same Scripture it was
		// written from, so the verse popup shows all cited verses and
		// "remove quote" still recognises its own callout (scriptureLinkScan).
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
	 */
	static toJwLibraryLink(s: Scripture, lang: CongressLang = 'de'): string {
		const params = `srcid=jwlshare&wtlocale=${ScriptureNormalizer.wtlocale(lang)}&prefer=lang`;
		return `jwlibrary:///finder?${params}&bible=${ScriptureNormalizer.bibleParam(s)}&pub=nwtsty`;
	}

	/**
	 * Builds the `bible=` value — the single place the citation's shape is
	 * turned into JW Library's own reference syntax.
	 *
	 * Verified shapes: `BBCCCVVV` for one verse and `BBCCCVVV-BBCCCVVV` for a
	 * range, same-chapter or cross-chapter alike (the range form is what JW
	 * Library's own "Share" produces).
	 *
	 * ⚠️ NOT verified: the comma-separated list written for a gapped citation
	 * ("1. Tim. 4:12, 15" → `…012,…015`). No real JW Library share link with a
	 * comma has been seen, and this project's own history is a warning against
	 * assuming a parameter shape works — the song links were built on an
	 * unverified `docid=`/`lank=` guess through five releases and failed on
	 * real devices every time (see AGENTS.md, "Lieder-Link-Historie"). Chosen
	 * deliberately over emitting two separate links, to be confirmed against a
	 * real JW Library install. If it turns out unsupported, this method is the
	 * only place to change: drop the extras here and have the caller render one
	 * link per verse instead.
	 */
	private static bibleParam(s: Scripture): string {
		const start = ScriptureNormalizer.toRtfCode(s.book, s.chapter, s.verseStart);
		const endChapter = s.chapterEnd ?? s.chapter;
		// The bible= param is just two BBCCCVVV codes — it already supports a
		// cross-chapter range natively, no different handling needed here than
		// for a same-chapter one.
		const head = s.verseEnd !== undefined && (endChapter !== s.chapter || s.verseEnd !== s.verseStart)
			? `${start}-${ScriptureNormalizer.toRtfCode(s.book, endChapter, s.verseEnd)}`
			: start;
		if (!s.extraVerses || s.extraVerses.length === 0) return head;
		const extras = s.extraVerses.map(run => {
			const from = ScriptureNormalizer.toRtfCode(s.book, s.chapter, run.start);
			if (run.end === undefined || run.end === run.start) return from;
			return `${from}-${ScriptureNormalizer.toRtfCode(s.book, s.chapter, run.end)}`;
		});
		return [head, ...extras].join(',');
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
		const bookName = getBookName(s.book, lang);
		if (s.chapterEnd !== undefined && s.chapterEnd !== s.chapter) {
			return `${bookName} ${s.chapter}:${s.verseStart}–${s.chapterEnd}:${s.verseEnd}`;
		}
		// Every stretch is written the same way, and they are joined with the
		// comma the citation convention uses across a gap ("1. Tim. 4:12, 15-17").
		const head: VerseRun = { start: s.verseStart };
		if (s.verseEnd !== undefined) head.end = s.verseEnd;
		const runs = [head, ...(s.extraVerses ?? [])];
		return `${bookName} ${s.chapter}:${runs.map(run => ScriptureNormalizer.formatRun(run)).join(', ')}`;
	}

	/** One stretch of verses in the citation convention's own spelling: "15",
	 *  "15, 16" for exactly two adjacent verses, "15-17" for three or more. */
	private static formatRun(run: VerseRun): string {
		if (run.end === undefined || run.end === run.start) return String(run.start);
		return run.end - run.start === 1 ? `${run.start}, ${run.end}` : `${run.start}-${run.end}`;
	}

	/** Renders a Scripture as a Markdown link: [Spr 16:20](jwlibrary:///finder?bible=20016020) */
	static toMarkdownLink(s: Scripture, lang: CongressLang): string {
		const label = ScriptureNormalizer.format(s, lang);
		const href  = ScriptureNormalizer.toJwLibraryLink(s, lang);
		return `[${label}](${href})`;
	}

	private static toRtfCode(book: number, chapter: number, verse: number): string {
		return (
			String(book).padStart(2, '0') +
			String(chapter).padStart(3, '0') +
			String(verse).padStart(3, '0')
		);
	}
}
