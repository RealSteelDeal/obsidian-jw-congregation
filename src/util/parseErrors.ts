/**
 * Structured error codes for anticipated failures inside the parsing/
 * decryption layer (SourceRouter, JwpubParser, RtfParser, util/jwpubCrypto,
 * MwbSourceRouter, MwbParser). These are thrown as a `ParseError` instead of
 * a plain `Error` with a hardcoded message, so the UI layer (main.ts) can
 * translate the failure into the user's chosen interface language via
 * `Strings.describeParseError` — previously these messages were hardcoded in
 * German (or a German/English mix), so e.g. a French-interface user hitting
 * a broken import file would see a German sentence stitched into their
 * otherwise fully translated Notice. Anything NOT a ParseError (an
 * unexpected exception from a third-party library, a DOM API, etc.) still
 * falls back to its own `String(err)` message in main.ts's `describeError()`
 * — this only covers the failure modes this codebase itself anticipates and names.
 */
export type ParseErrorCode =
	| 'unknownFormat'
	| 'noWebCrypto'
	| 'noWebAssembly'
	| 'rtfNoFiles'
	| 'jwpubMissingContents'
	| 'jwpubNoDatabase'
	| 'jwpubEmptyPublication'
	| 'fileTooLarge'
	| 'decompressedTooLarge'
	| 'notMwbPublication'
	| 'mwbLanguageNotSupported'
	| 'mwbNoWeekDocuments';

export class ParseError extends Error {
	constructor(readonly code: ParseErrorCode, readonly detail?: string) {
		super(detail ? `${code}: ${detail}` : code);
		this.name = 'ParseError';
	}
}
