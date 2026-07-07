import { Scripture } from '../models/congress';
import { SupportedLang, getBookName } from './bookNames';

export class ScriptureNormalizer {

	/**
	 * Parses jwpub-HTML format: "20:16:20" or range "20:16:20-20:16:22"
	 * (book:chapter:verse from the jwpub://b/NWTR/ link)
	 */
	static fromJwpub(raw: string): Scripture {
		const parts = raw.split('-');
		const start = ScriptureNormalizer.parseJwpubSingle(parts[0] ?? '');
		if (parts.length === 2) {
			const end = ScriptureNormalizer.parseJwpubSingle(parts[1] ?? '');
			start.verseEnd = end.verseStart;
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
	 * `&pub=nwtsty` (the bible translation to display) matches exactly what JW
	 * Library's own "Share" feature produces for a verse (confirmed against a
	 * real share from the Windows desktop app) — added here for the same reason
	 * the song link needed a specific confirmed content id: closest match to
	 * what the app itself generates is the most reliable bet.
	 */
	static toJwLibraryLink(s: Scripture): string {
		const start = ScriptureNormalizer.toRtfCode(s.book, s.chapter, s.verseStart);
		if (s.verseEnd !== undefined && s.verseEnd !== s.verseStart) {
			const end = ScriptureNormalizer.toRtfCode(s.book, s.chapter, s.verseEnd);
			return `jwlibrary:///finder?bible=${start}-${end}&pub=nwtsty`;
		}
		return `jwlibrary:///finder?bible=${start}&pub=nwtsty`;
	}

	/** Formats a Scripture as human-readable string, e.g. "Sprüche 16:20" or "Mt 5:1-12". */
	static format(s: Scripture, lang: SupportedLang): string {
		const bookName = getBookName(s.book, lang);
		const base = `${bookName} ${s.chapter}:${s.verseStart}`;
		if (s.verseEnd !== undefined && s.verseEnd !== s.verseStart) {
			return `${base}-${s.verseEnd}`;
		}
		return base;
	}

	/** Renders a Scripture as a Markdown link: [Spr 16:20](jwlibrary:///finder?bible=20016020) */
	static toMarkdownLink(s: Scripture, lang: SupportedLang): string {
		const label = ScriptureNormalizer.format(s, lang);
		const href  = ScriptureNormalizer.toJwLibraryLink(s);
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
