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
	 * Resolves the BibleVerseId of `scripture`'s first verse. Not every single
	 * verse is directly indexed (only verses that happen to be cited somewhere
	 * in this particular Bible edition are) — e.g. Matthew 13:34 isn't cited
	 * anywhere in a real nwtsty file, even though its neighbour 13:35 is. Since
	 * BibleVerseId is sequential within a chapter, any indexed verse inside the
	 * requested range (or immediately adjacent to it) is enough to derive the
	 * range's actual start id by a constant offset — no need for every verse to
	 * be indexed individually.
	 */
	private resolveStartId(scripture: Scripture): number | undefined {
		const { book, chapter, verseStart, verseEnd } = scripture;
		const direct = this.verseIdByReference.get(`${book}:${chapter}:${verseStart}`);
		if (direct !== undefined) return direct;

		for (let v = verseStart + 1; v <= (verseEnd ?? verseStart); v++) {
			const id = this.verseIdByReference.get(`${book}:${chapter}:${v}`);
			if (id !== undefined) return id - (v - verseStart);
		}
		return undefined;
	}

	/**
	 * Returns each verse in the reference as `{ number, html }` (`number` is the
	 * verse-number label, e.g. "15"; `html` is the still-marked-up, decrypted
	 * verse text), in order — or undefined if the range can't be resolved at
	 * all (see resolveStartId()) or no Bible file has been loaded.
	 */
	async getVerses(scripture: Scripture): Promise<{ number: string; html: string }[] | undefined> {
		if (!this.db || !this.key || !this.iv) return undefined;

		const startId = this.resolveStartId(scripture);
		if (startId === undefined) return undefined;

		// BibleVerseId is sequential across the whole canon, so a verse range
		// (even spanning a chapter/book boundary) is just a run of consecutive ids.
		const verseCount = (scripture.verseEnd ?? scripture.verseStart) - scripture.verseStart + 1;
		const verses: { number: string; html: string }[] = [];
		for (let i = 0; i < verseCount; i++) {
			const res = this.db.exec(`SELECT Label, Content FROM BibleVerse WHERE BibleVerseId = ${startId + i}`);
			const row = res[0]?.values[0];
			if (!row) continue;
			const content = row[1] as Uint8Array | undefined;
			if (!content) continue;
			verses.push({
				number: String(row[0] ?? ''),
				html: await decryptBlob(content, this.key, this.iv),
			});
		}
		return verses.length > 0 ? verses : undefined;
	}
}
