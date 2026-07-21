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

// Any song/publication link, language-independent (jwpub://p/X:…, jwpub://p/E:…).
export const SONG_HREF_SELECTOR = 'a[href^="jwpub://p/"]';

// Publication.MepsLanguageIndex → CongressLang, confirmed against each real
// programme file (dumped via scripts/dump-structure.mjs) — only these seven
// are ones this plugin's parsers handle. Shared between JwpubParser
// (congress programs) and MwbParser (meeting workbooks) since both read the
// same Publication table shape.
export const MEPS_LANGUAGE_INDEX: Record<number, CongressLang> = {
	0: 'en', 1: 'es', 2: 'de', 3: 'fr', 4: 'it', 207: 'ru', 785: 'pt',
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
