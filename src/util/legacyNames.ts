/**
 * Earlier spellings of names the plugin generates itself — so that correcting
 * how a folder or note is named does not strand what an earlier version
 * already created under the old name. Without this, an update would no
 * longer find such a note and a re-import would create a second folder next
 * to the first.
 *
 * Two corrections so far, both from 02.10.2026:
 * - Zero-width spaces (U+200B) are removed from every programme, not only
 *   Korean ones. Two English item titles carried one before a dash, and so
 *   did the file names of their notes.
 * - Circuit-assembly folders quote the theme once. The theme arrives from
 *   the file already quoted, and the folder template added a second pair:
 *   „„…““, ““…””, « « … » », and in Italian, Portuguese and Spanish ʺ“…”ʺ,
 *   whose ASCII quotes the file-name sanitiser had turned into ʺ. Those three
 *   now use “…”, as their programmes print it.
 */

/** A name with every corrected detail evened out: two names with the same
 *  key differ only in what has since been corrected — zero-width spaces,
 *  quotation marks, and the spacing French puts inside « ». */
function legacyKey(name: string): string {
	return name.replace(/\u200B/g, '').replace(/[„“”"«»ʺ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Whether `a` and `b` are the same generated name, one of them in an
 *  earlier spelling. */
export function sameUnderLegacySpelling(a: string, b: string): boolean {
	return legacyKey(a) === legacyKey(b);
}

/**
 * The one entry of `existing` that is `name` in an earlier spelling, or
 * undefined. Nothing is returned when `name` itself exists (there is nothing
 * to adopt) or when several entries would fit — renaming one of them would
 * be a guess, and leaving both alone costs at most a duplicate the user can
 * see.
 */
export function findLegacySpelling(existing: readonly string[], name: string): string | undefined {
	if (existing.includes(name)) return undefined;
	const matches = existing.filter(other => sameUnderLegacySpelling(other, name));
	return matches.length === 1 ? matches[0] : undefined;
}
