import { ParseError } from './parseErrors';

/**
 * Defends against zip-bomb-style memory exhaustion from a crafted or
 * corrupted .jwpub/RTF-ZIP file: fflate's `unzipSync()` and pako's
 * `inflate()` decompress synchronously and all at once, with no built-in
 * ceiling of their own, so a small, high-compression-ratio input could
 * otherwise expand to an amount that exhausts memory or freezes Obsidian
 * before the plugin ever gets a chance to reject it. These checks can't
 * prevent the peak allocation the decompression call itself performs
 * (neither library offers a streaming/abortable API for this) — but
 * bounding the raw file BEFORE we attempt to open it, and every individual
 * decompressed unit immediately AFTER, keeps a pathological result from
 * ever propagating further into the parser/decryption pipeline, and rejects
 * the most extreme cases outright rather than silently trying to process
 * them.
 *
 * Ceilings are deliberately generous: the largest LEGITIMATE file this code
 * handles is the full "Study Bible" (nwtsty) jwpub file, confirmed up to
 * roughly 125 MB (see BibleReader.ts's doc comment) — a real congress
 * program file is only a few MB. 300 MB leaves comfortable headroom above
 * that known legitimate case while still catching a multi-GB zip-bomb
 * expansion; 50 MB for a single decrypted content blob (one document's or
 * one verse's HTML) is similarly generous relative to anything that
 * actually appears in a real file.
 */
export const MAX_INPUT_FILE_BYTES = 300 * 1024 * 1024;
export const MAX_UNPACKED_ENTRY_BYTES = 300 * 1024 * 1024;
export const MAX_INFLATED_BLOB_BYTES = 50 * 1024 * 1024;

function formatMb(bytes: number): string {
	return `${Math.round(bytes / 1024 / 1024)} MB`;
}

/** The raw, still-compressed file the user picked (a .jwpub or RTF-ZIP). */
export function assertFileSize(bytes: Uint8Array): void {
	if (bytes.byteLength > MAX_INPUT_FILE_BYTES) throw new ParseError('fileTooLarge', formatMb(bytes.byteLength));
}

/** A single zip entry right after `unzipSync()` decompressed it (e.g. the
 *  jwpub "contents" entry, the inner .db file, one .rtf file in an RTF-ZIP). */
export function assertUnpackedEntrySize(bytes: Uint8Array): void {
	if (bytes.byteLength > MAX_UNPACKED_ENTRY_BYTES) throw new ParseError('decompressedTooLarge', formatMb(bytes.byteLength));
}

/** A single decrypted+inflated content blob (one document's or one verse
 *  row's HTML) right after `pako.inflate()`. */
export function assertInflatedBlobSize(bytes: Uint8Array): void {
	if (bytes.byteLength > MAX_INFLATED_BLOB_BYTES) throw new ParseError('decompressedTooLarge', formatMb(bytes.byteLength));
}
