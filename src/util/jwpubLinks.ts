import { CongressLang } from '../normalizer/bookNames';
import { ParseError } from './parseErrors';

// Matches jwpub://b/NWTR/book:chapter:verse[-book:chapter:verse] — shared by
// every jwpub-format publication (congress programs, meeting workbooks, …).
export const BIBLE_HREF_RE = /^jwpub:\/\/b\/NWTR\/([\d:]+(?:-[\d:]+)?)$/;

// Matches jwpub://p/<langSymbol>:<docid>/ — the real jw.org/finder docid for
// a song, embedded directly in the jwpub file. The language symbol varies
// with the publication's language (X = German, E = English, …), so it must
// NOT be hardcoded. The docid is not a linear function of the song number
// (confirmed: docid jumps by +6000 for at least one song vs. the naive
// songNumber-based guess), so this is the only reliable source and must be
// read, not computed.
export const SONG_DOCID_HREF_RE = /^jwpub:\/\/p\/[^:/]+:(\d+)\/?$/;

/**
 * The publication's symbol in its English form — "mwb26", "CO-pgm26" — for
 * recognising WHAT a file is. `Symbol` itself is localised for some
 * publications: the Korean Meeting Workbook calls itself "집교26" (집회 교재),
 * while its EnglishSymbol stays "mwb26" (02.10.2026; the convention
 * programmes keep an English Symbol in every language seen). Falls back to
 * `Symbol` for a file without the column. Never use this for decryption —
 * the key is derived from the file's own Symbol (jwpubCrypto.deriveKey).
 */
export function englishSymbol(pub: Record<string, unknown>): string {
	const english = pub['EnglishSymbol'];
	if (typeof english === 'string' && english !== '') return english;
	const own = pub['Symbol'];
	return typeof own === 'string' ? own : typeof own === 'number' ? String(own) : '';
}

/**
 * Removes U+200B ZERO WIDTH SPACE. Korean programme files put it inside words
 * as a line-break hint — "노래 89\u200B번", "질문\u200B에" — 252 times in one convention
 * programme. Left in, it defeats every detection pattern and travels on into
 * file names, folder names and wiki-link anchors, where it is invisible and
 * cannot be typed.
 *
 * Applied to every programme since 02.10.2026 (JwpubParser.clean), Korean
 * only before that. English files carry a few too, only before a dash
 * ("Forever\u200B—Is It Realistic?"), where they break no pattern — but two of
 * them sit in item titles and so in file names. Removing them renames those
 * notes; util/legacyNames.ts is what lets an update or a re-import still find
 * the ones an earlier version created, and rename them in turn.
 * Measured on 02.10.2026 across all eight languages' programme files: German,
 * French, Italian, Portuguese, Russian and Spanish carry none.
 */
export function stripZeroWidthSpace(text: string): string {
	return text.replace(/\u200B/g, '');
}

// Any song/publication link, language-independent (jwpub://p/X:…, jwpub://p/E:…).
export const SONG_HREF_SELECTOR = 'a[href^="jwpub://p/"]';

// Publication.MepsLanguageIndex → CongressLang, confirmed against each real
// programme file (dumped via scripts/dump-structure.mjs) — only these eight
// are ones this plugin's parsers handle. Shared between JwpubParser
// (congress programs) and MwbParser (meeting workbooks) since both read the
// same Publication table shape; MwbParser accepts only 'de' and refuses the
// rest. 129 was read from nwt_KO.jwpub first and then found unchanged in all
// three Korean convention programmes (02.10.2026).
export const MEPS_LANGUAGE_INDEX: Record<number, CongressLang> = {
	0: 'en', 1: 'es', 2: 'de', 3: 'fr', 4: 'it', 129: 'ko', 207: 'ru', 785: 'pt',
};

/**
 * Fails fast with a clear, actionable message if the host environment is
 * missing an API a jwpub parser needs (WebCrypto for AES/SHA-256, WebAssembly
 * for sql.js) — both are expected to be present on every platform Obsidian
 * itself supports (desktop Electron and the mobile apps), but a clear error
 * here beats a cryptic low-level failure several calls deep if that's ever
 * not the case (e.g. an unusually old OS/WebView).
 */
export function assertPlatformSupport(): void {
	if (typeof crypto === 'undefined' || !crypto.subtle) {
		throw new ParseError('noWebCrypto');
	}
	if (typeof WebAssembly === 'undefined') {
		throw new ParseError('noWebAssembly');
	}
}
