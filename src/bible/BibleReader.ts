import type { Database } from 'sql.js';
import { Scripture } from '../models/congress';
import { decryptBlob, deriveKey, openJwpubDatabase, readPublication } from '../util/jwpubCrypto';

// Matches jwpub://b/NWTR/book:chapter:verse — the single-verse citation format used
// by BibleCitation/Hyperlink rows *inside* a Bible publication (cross-references,
// footnote "see also" links, ...). Ranges also match; only the first verse is used
// to seed the index (see buildVerseIdIndex()).
const BIBLE_HREF_RE = /^jwpub:\/\/b\/NWTR\/(\d+):(\d+):(\d+)/;

export interface FootnoteRef {
	symbol: string;
	html: string;
}

export interface CrossReference {
	symbol: string;
	/** The target verse's reference, if resolvable (see buildVerseIdIndex()) — not
	 *  every target verse happens to be indexed, since the index only covers
	 *  verses that are themselves cited via a jwpub://b/NWTR/ link somewhere. */
	scripture?: Scripture;
	/** The target verse's own text, if its BibleVerseId could be read. */
	html?: string;
}

export interface VerseDetail {
	number: string;
	html: string;
	footnotes: FootnoteRef[];
	crossReferences: CrossReference[];
}

/**
 * Reads verse text (and, for VerseDetail, footnotes/cross-references) out of a
 * Bible publication jwpub file (nwt / nwtsty) that the user has supplied
 * themselves — same trust model as the congress programme files: we only ever
 * read a file the user already legitimately owns, never bundle or fetch Bible
 * content ourselves.
 *
 * The Bible text itself does *not* live in the `Document` table (that's only
 * intro pages, "Frage 1: Wer ist Gott?"-style articles, etc.) — it's in
 * dedicated `BibleVerse`/`BibleChapter` tables, addressed by a `BibleVerseId`
 * that's sequential across the whole Bible but not otherwise derivable from
 * book/chapter/verse without knowing every preceding chapter's verse count.
 * Rather than hardcode a versification table (fragile, translation-specific),
 * `buildVerseIdIndex()` builds the book:chapter:verse ↔ BibleVerseId lookup
 * (both directions) from the file's own `BibleCitation`/`Hyperlink` tables,
 * which already pair every internally-cited verse's jwpub://b/NWTR/… reference
 * with its BibleVerseId — the file tells us its own addressing scheme, no
 * guessing.
 *
 * Footnotes and cross-references (verified against a real nwtsty file):
 * `BibleChapter.Content` embeds `<span data-fnid="N" class="fn">symbol</span>`
 * (footnote marker, N = `Footnote.FootnoteIndex` scoped to the verse's own book
 * document — see `BibleBook.BookDocumentId`) and `<span data-mid="N" class="m">
 * symbol</span>` (cross-reference marker, N = `BibleCitation.BlockNumber`,
 * scoped to `BibleCitation.BibleVerseId` = the citing verse's own id — a single
 * marker can have multiple `ElementNumber`s, i.e. multiple targets).
 */
export class BibleReader {
	private db: Database | null = null;
	private key: Uint8Array | null = null;
	private iv: Uint8Array | null = null;
	private verseIdByReference = new Map<string, number>();
	private referenceByVerseId = new Map<number, { book: number; chapter: number; verse: number }>();
	private bookDocumentId = new Map<number, number>();

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
		this.buildBookDocumentIndex(db);
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
			if (!m || !m[1] || !m[2] || !m[3]) continue;
			const book = Number(m[1]);
			const chapter = Number(m[2]);
			const verse = Number(m[3]);
			// First match wins — later duplicates (the same verse cited again
			// elsewhere) would map to the same BibleVerseId anyway.
			const key = `${book}:${chapter}:${verse}`;
			if (!this.verseIdByReference.has(key)) {
				this.verseIdByReference.set(key, firstVerseId);
			}
			if (!this.referenceByVerseId.has(firstVerseId)) {
				this.referenceByVerseId.set(firstVerseId, { book, chapter, verse });
			}
		}
	}

	private buildBookDocumentIndex(db: Database): void {
		const res = db.exec('SELECT BibleBookId, BookDocumentId FROM BibleBook');
		if (!res[0]) return;
		const cols = res[0].columns;
		for (const row of res[0].values) {
			const book = Number(row[cols.indexOf('BibleBookId')]);
			const docId = Number(row[cols.indexOf('BookDocumentId')]);
			this.bookDocumentId.set(book, docId);
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

		const verseCount = (scripture.verseEnd ?? scripture.verseStart) - scripture.verseStart + 1;
		const verses: { number: string; html: string }[] = [];
		for (let i = 0; i < verseCount; i++) {
			const verse = await this.readVerseRow(startId + i);
			if (verse) verses.push(verse);
		}
		return verses.length > 0 ? verses : undefined;
	}

	/**
	 * Like getVerses(), but each verse also includes its footnotes and cross-
	 * references. More expensive than getVerses() (one extra chapter-HTML
	 * decrypt+parse per distinct chapter touched, plus one small query per
	 * footnote/cross-reference marker) — intended for the verse popup, which
	 * already shows a loading state while this runs.
	 */
	async getVerseDetails(scripture: Scripture): Promise<VerseDetail[] | undefined> {
		if (!this.db || !this.key || !this.iv) return undefined;

		const startId = this.resolveStartId(scripture);
		if (startId === undefined) return undefined;

		const verseCount = (scripture.verseEnd ?? scripture.verseStart) - scripture.verseStart + 1;
		const chapterDomCache = new Map<string, Document | undefined>();
		const details: VerseDetail[] = [];

		for (let i = 0; i < verseCount; i++) {
			const verseId = startId + i;
			const verse = await this.readVerseRow(verseId);
			if (!verse) continue;

			// scripture.book/chapter only reliably names verse i===0 if the range
			// crosses a chapter boundary — the verse-id-based reverse index is the
			// authoritative source whenever this particular verse happens to be in it.
			const ref = this.referenceByVerseId.get(verseId)
				?? (i === 0 ? { book: scripture.book, chapter: scripture.chapter, verse: scripture.verseStart } : undefined);

			let footnotes: FootnoteRef[] = [];
			let crossReferences: CrossReference[] = [];
			if (ref) {
				const chapterKey = `${ref.book}:${ref.chapter}`;
				let dom = chapterDomCache.get(chapterKey);
				if (dom === undefined && !chapterDomCache.has(chapterKey)) {
					dom = await this.loadChapterDom(ref.book, ref.chapter);
					chapterDomCache.set(chapterKey, dom);
				}
				if (dom) {
					const marks = this.findVerseMarkers(dom, ref.book, ref.chapter, ref.verse);
					const bookDocId = this.bookDocumentId.get(ref.book);
					if (bookDocId !== undefined) {
						footnotes = await this.resolveFootnotes(bookDocId, marks.footnotes);
					}
					crossReferences = await this.resolveCrossReferences(verseId, marks.crossRefs);
				}
			}

			details.push({ number: verse.number, html: verse.html, footnotes, crossReferences });
		}
		return details.length > 0 ? details : undefined;
	}

	private async readVerseRow(verseId: number): Promise<{ number: string; html: string } | undefined> {
		if (!this.db || !this.key || !this.iv) return undefined;
		const res = this.db.exec(`SELECT Label, Content FROM BibleVerse WHERE BibleVerseId = ${verseId}`);
		const row = res[0]?.values[0];
		if (!row) return undefined;
		const content = row[1] as Uint8Array | undefined;
		if (!content) return undefined;
		return { number: String(row[0] ?? ''), html: await decryptBlob(content, this.key, this.iv) };
	}

	private async loadChapterDom(book: number, chapter: number): Promise<Document | undefined> {
		if (!this.db || !this.key || !this.iv) return undefined;
		const res = this.db.exec(`SELECT Content FROM BibleChapter WHERE BookNumber = ${book} AND ChapterNumber = ${chapter}`);
		const content = res[0]?.values[0]?.[0] as Uint8Array | undefined;
		if (!content) return undefined;
		const html = await decryptBlob(content, this.key, this.iv);
		return new DOMParser().parseFromString(html, 'text/html');
	}

	/** Finds this verse's own span(s) in the chapter DOM and extracts its footnote/cross-reference markers, in document order. */
	private findVerseMarkers(
		dom: Document,
		book: number,
		chapter: number,
		verse: number,
	): { footnotes: { id: number; symbol: string }[]; crossRefs: { id: number; symbol: string }[] } {
		const prefix = `v${book}-${chapter}-${verse}-`;
		const spans = Array.from(dom.querySelectorAll(`span[id^="${prefix}"]`));
		const footnotes: { id: number; symbol: string }[] = [];
		const crossRefs: { id: number; symbol: string }[] = [];
		for (const span of spans) {
			span.querySelectorAll('[data-fnid]').forEach(el => {
				const id = Number(el.getAttribute('data-fnid'));
				if (Number.isFinite(id)) footnotes.push({ id, symbol: (el.textContent ?? '').trim() });
			});
			span.querySelectorAll('[data-mid]').forEach(el => {
				const id = Number(el.getAttribute('data-mid'));
				if (Number.isFinite(id)) crossRefs.push({ id, symbol: (el.textContent ?? '').trim() });
			});
		}
		return { footnotes, crossRefs };
	}

	private async resolveFootnotes(
		bookDocumentId: number,
		markers: { id: number; symbol: string }[],
	): Promise<FootnoteRef[]> {
		if (!this.db || !this.key || !this.iv || markers.length === 0) return [];
		const out: FootnoteRef[] = [];
		for (const marker of markers) {
			const res = this.db.exec(
				`SELECT Content FROM Footnote WHERE DocumentId = ${bookDocumentId} AND FootnoteIndex = ${marker.id}`,
			);
			const content = res[0]?.values[0]?.[0] as Uint8Array | undefined;
			if (!content) continue;
			out.push({ symbol: marker.symbol, html: await decryptBlob(content, this.key, this.iv) });
		}
		return out;
	}

	private async resolveCrossReferences(
		sourceVerseId: number,
		markers: { id: number; symbol: string }[],
	): Promise<CrossReference[]> {
		if (!this.db || markers.length === 0) return [];
		const out: CrossReference[] = [];
		for (const marker of markers) {
			const res = this.db.exec(`
				SELECT FirstBibleVerseId FROM BibleCitation
				WHERE BibleVerseId = ${sourceVerseId} AND BlockNumber = ${marker.id} AND FirstBibleVerseId IS NOT NULL
				ORDER BY ElementNumber
			`);
			if (!res[0]) continue;
			for (const row of res[0].values) {
				const targetId = Number(row[0]);
				const ref = this.referenceByVerseId.get(targetId);
				const scripture = ref ? { book: ref.book, chapter: ref.chapter, verseStart: ref.verse } : undefined;
				const target = await this.readVerseRow(targetId);
				out.push({ symbol: marker.symbol, scripture, html: target?.html });
			}
		}
		return out;
	}
}
