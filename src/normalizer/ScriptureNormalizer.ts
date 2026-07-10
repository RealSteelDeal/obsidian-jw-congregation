import { Scripture } from '../models/congress';
import { SupportedLang, getBookName } from './bookNames';

export class ScriptureNormalizer {

	/**
	 * Parses jwpub-HTML format: "20:16:20" or range "20:16:20-20:16:22"
	 * (book:chapter:verse from the jwpub://b/NWTR/ link).
	 *
	 * A real bible-drama citation can span chapters, e.g.
	 * "41:1:21-41:3:19" (Mark 1:21–3:19) — a bug here previously took the end
	 * segment's verse number regardless of its chapter, producing the
	 * nonsensical "Markus 1:21-19" (verse 19 doesn't come after verse 21
	 * within chapter 1; it's chapter 3's verse 19). Same guard as fromRtf():
	 * verseEnd is only kept when the end segment is in the SAME chapter —
	 * Scripture has no cross-chapter range representation, so a cross-chapter
	 * citation is shown as just its start verse, consistent with fromRtf().
	 */
	static fromJwpub(raw: string): Scripture {
		const parts = raw.split('-');
		const start = ScriptureNormalizer.parseJwpubSingle(parts[0] ?? '');
		if (parts.length === 2) {
			const end = ScriptureNormalizer.parseJwpubSingle(parts[1] ?? '');
			if (end.book === start.book && end.chapter === start.chapter) {
				start.verseEnd = end.verseStart;
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
		const parts = raw.split('-');
		const start = ScriptureNormalizer.parseRtfSingle(parts[0] ?? '');
		if (parts.length === 2) {
			const end = ScriptureNormalizer.parseRtfSingle(parts[1] ?? '');
			// Only store verseEnd when it differs from start
			if (end.book === start.book && end.chapter === start.chapter) {
				start.verseEnd = end.verseStart;
			}
		}
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
	static toJwLibraryLink(s: Scripture, lang: SupportedLang = 'de'): string {
		const start = ScriptureNormalizer.toRtfCode(s.book, s.chapter, s.verseStart);
		const params = `srcid=jwlshare&wtlocale=${ScriptureNormalizer.wtlocale(lang)}&prefer=lang`;
		if (s.verseEnd !== undefined && s.verseEnd !== s.verseStart) {
			const end = ScriptureNormalizer.toRtfCode(s.book, s.chapter, s.verseEnd);
			return `jwlibrary:///finder?${params}&bible=${start}-${end}&pub=nwtsty`;
		}
		return `jwlibrary:///finder?${params}&bible=${start}&pub=nwtsty`;
	}

	/** MEPS locale symbol for a supported language (the wtlocale= URL parameter). */
	static wtlocale(lang: SupportedLang): string {
		return lang === 'en' ? 'E' : 'X';
	}

	/**
	 * Formats a Scripture as human-readable string, e.g. "Sprüche 16:20" or
	 * "Mt 5:1-12". Matches the official citation convention: exactly two
	 * consecutive verses are separated by a comma ("34, 35"), a range of three
	 * or more uses a hyphen ("34-38").
	 */
	static format(s: Scripture, lang: SupportedLang): string {
		const bookName = getBookName(s.book, lang);
		const base = `${bookName} ${s.chapter}:${s.verseStart}`;
		if (s.verseEnd !== undefined && s.verseEnd !== s.verseStart) {
			const separator = s.verseEnd - s.verseStart === 1 ? ', ' : '-';
			return `${base}${separator}${s.verseEnd}`;
		}
		return base;
	}

	/** Renders a Scripture as a Markdown link: [Spr 16:20](jwlibrary:///finder?bible=20016020) */
	static toMarkdownLink(s: Scripture, lang: SupportedLang): string {
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
