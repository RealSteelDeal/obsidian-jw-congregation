import type { Database } from 'sql.js';
import { Scripture } from '../models/congress';
import { decryptBlob, deriveKey, openJwpubDatabase, readPublication } from '../util/jwpubCrypto';

// Matches jwpub://b/NWTR/book:chapter:verse — the single-verse citation format used
// by BibleCitation/Hyperlink rows *inside* a Bible publication (cross-references,
// footnote "see also" links, ...). Ranges also match; only the first verse is used
// to seed the index (see buildVerseIdIndex()).
const BIBLE_HREF_RE = /^jwpub:\/\/b\/NWTR\/(\d+):(\d+):(\d+)/;

/**
 * Reads verse text out of a Bible publication jwpub file (nwt / nwtsty) that the
 * user has supplied themselves — same trust model as the congress programme
 * files: we only ever read a file the user already legitimately owns, never
 * bundle or fetch Bible content ourselves.
 *
 * The Bible text itself does *not* live in the `Document` table (that's only
 * intro pages, "Frage 1: Wer ist Gott?"-style articles, etc.) — it's in
 * dedicated `BibleVerse`/`BibleChapter` tables, addressed by a `BibleVerseId`
 * that's sequential across the whole Bible but not otherwise derivable from
 * book/chapter/verse without knowing every preceding chapter's verse count.
 * Rather than hardcode a versification table (fragile, translation-specific),
 * `buildVerseIdIndex()` builds the book:chapter:verse → BibleVerseId lookup
 * from the file's own `BibleCitation`/`Hyperlink` tables, which already pair
 * every internally-cited verse's jwpub://b/NWTR/… reference with its
 * BibleVerseId — the file tells us its own addressing scheme, no guessing.
 */
export class BibleReader {
	private db: Database | null = null;
	private key: Uint8Array | null = null;
	private iv: Uint8Array | null = null;
	private verseIdByReference = new Map<string, number>();

	constructor(private readonly sqlWasmBinary: Uint8Array) {}

	get isLoaded(): boolean {
		return this.db !== null;
	}

	async load(fileBuffer: Uint8Array): Promise<void> {
		const { db } = await openJwpubDatabase(fileBuffer, this.sqlWasmBinary);
		const pub = readPublication(db);
		const { key, iv } = await deriveKey(pub);
		this.db = db;
		this.key = key;
		this.iv = iv;
		this.buildVerseIdIndex(db);
	}

	private buildVerseIdIndex(db: Database): void {
		const res = db.exec(`
			SELECT h.Link AS Link, c.FirstBibleVerseId AS FirstBibleVerseId
			FROM BibleCitation c
			JOIN Hyperlink h ON h.HyperlinkId = c.HyperlinkId
			WHERE h.Link LIKE 'jwpub://b/NWTR/%' AND c.FirstBibleVerseId IS NOT NULL
		`);
		if (!res[0]) return;
		const cols = res[0].columns;
		for (const row of res[0].values) {
			const link = String(row[cols.indexOf('Link')]);
			const firstVerseId = Number(row[cols.indexOf('FirstBibleVerseId')]);
			const m = BIBLE_HREF_RE.exec(link);
			if (!m) continue;
			const key = `${m[1]}:${m[2]}:${m[3]}`;
			// First match wins — later duplicates (the same verse cited again
			// elsewhere) would map to the same BibleVerseId anyway.
			if (!this.verseIdByReference.has(key)) {
				this.verseIdByReference.set(key, firstVerseId);
			}
		}
	}

	/**
	 * Returns the decrypted verse HTML for each verse in the reference (one
	 * string per verse, in order), or undefined if the starting verse isn't in
	 * the index (e.g. a verse never cited anywhere in this particular Bible
	 * edition) or no Bible file has been loaded.
	 */
	async getVerseHtml(scripture: Scripture): Promise<string[] | undefined> {
		if (!this.db || !this.key || !this.iv) return undefined;

		const startId = this.verseIdByReference.get(
			`${scripture.book}:${scripture.chapter}:${scripture.verseStart}`,
		);
		if (startId === undefined) return undefined;

		// BibleVerseId is sequential across the whole canon, so a verse range
		// (even spanning a chapter/book boundary) is just a run of consecutive ids.
		const verseCount = (scripture.verseEnd ?? scripture.verseStart) - scripture.verseStart + 1;
		const html: string[] = [];
		for (let i = 0; i < verseCount; i++) {
			const res = this.db.exec(`SELECT Content FROM BibleVerse WHERE BibleVerseId = ${startId + i}`);
			const content = res[0]?.values[0]?.[0] as Uint8Array | undefined;
			if (!content) continue;
			html.push(await decryptBlob(content, this.key, this.iv));
		}
		return html.length > 0 ? html : undefined;
	}
}
