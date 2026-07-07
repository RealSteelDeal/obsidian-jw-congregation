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

export interface StudyNote {
	/** e.g. "5:1" — VerseCommentary.Label, may itself carry markup. */
	label: string;
	html: string;
}

/**
 * One piece of a verse's body text, in document order. `footnote`/`crossref`
 * segments are the inline marker letters (a, b, c, …) from the chapter HTML —
 * kept as their own segment type (rather than folded into the surrounding
 * text) so the UI can render them as small superscripts at the exact position
 * they appear in the source, instead of only listing them below the verse.
 */
export type VerseSegment =
	| { kind: 'text'; text: string }
	| { kind: 'footnote'; symbol: string }
	| { kind: 'crossref'; symbol: string };

export interface VerseDetail {
	number: string;
	/** True when this verse is the first of a new chapter — printed Bibles (and
	 *  the jwpub chapter HTML itself, via a "cl" vs "vl" span class) show a large
	 *  chapter number instead of the usual small verse number in that case. */
	isChapterStart: boolean;
	segments: VerseSegment[];
	footnotes: FootnoteRef[];
	crossReferences: CrossReference[];
	studyNotes: StudyNote[];
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

			let isChapterStart = false;
			// Falls back to the (marker-free) BibleVerse.Content as a single text
			// segment when the chapter HTML isn't reachable at all — better than
			// showing nothing.
			let segments: VerseSegment[] = [{ kind: 'text', text: BibleReader.htmlToPlainText(verse.html) }];
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
					const extracted = this.extractVerseContent(dom, ref.book, ref.chapter, ref.verse);
					isChapterStart = extracted.isChapterStart;
					if (extracted.segments.length > 0) segments = extracted.segments;
					const bookDocId = this.bookDocumentId.get(ref.book);
					if (bookDocId !== undefined) {
						footnotes = await this.resolveFootnotes(bookDocId, extracted.footnoteMarkers);
					}
					crossReferences = await this.resolveCrossReferences(verseId, extracted.crossRefMarkers);
				}
			}

			const studyNotes = await this.resolveStudyNotes(verseId);
			details.push({ number: verse.number, isChapterStart, segments, footnotes, crossReferences, studyNotes });
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

	/**
	 * Finds this verse's own span(s) in the chapter DOM and walks their direct
	 * children to rebuild the verse's body as an ordered list of text/marker
	 * segments — this is the *only* source that has footnote/cross-reference
	 * markers positioned correctly inline (BibleVerse.Content, used elsewhere as
	 * a fallback, has neither the markers nor the chapter/verse-number span).
	 *
	 * A verse's first span (id suffix "-1") starts with a leading number span:
	 * `<span class="cl"><strong>5</strong> <span class="tt cl" ...></span></span>`
	 * for a chapter's first verse, or `<span class="vl">12 <span class="tt vl"
	 * ...></span></span>` for a regular verse — confirmed against a real nwtsty
	 * chapter dump. That leading span is skipped here (the verse number is
	 * already shown separately from BibleVerse.Label); only its "cl" vs "vl"
	 * class is used, to flag chapter starts for the caller. Continuation spans
	 * of the same verse (e.g. "-2" when a verse's text resumes after a
	 * paragraph break) have no leading number span at all.
	 *
	 * Marker spans (`data-fnid`/`data-mid`) each contain their visible symbol
	 * plus an empty `.tt` tooltip child — subtracted out via markerSymbol()
	 * rather than trusted to stay empty forever.
	 */
	private extractVerseContent(
		dom: Document,
		book: number,
		chapter: number,
		verse: number,
	): {
		isChapterStart: boolean;
		segments: VerseSegment[];
		footnoteMarkers: { id: number; symbol: string }[];
		crossRefMarkers: { id: number; symbol: string }[];
	} {
		const prefix = `v${book}-${chapter}-${verse}-`;
		const spans = Array.from(dom.querySelectorAll(`span[id^="${prefix}"]`));
		let isChapterStart = false;
		const segments: VerseSegment[] = [];
		const footnoteMarkers: { id: number; symbol: string }[] = [];
		const crossRefMarkers: { id: number; symbol: string }[] = [];

		for (const span of spans) {
			for (const child of Array.from(span.childNodes)) {
				if (child.nodeType === Node.TEXT_NODE) {
					const text = child.textContent ?? '';
					if (text) segments.push({ kind: 'text', text });
					continue;
				}
				if (!child.instanceOf(HTMLElement)) continue;

				if (child.classList.contains('cl') || child.classList.contains('vl')) {
					if (child.classList.contains('cl')) isChapterStart = true;
					continue;
				}
				if (child.hasAttribute('data-fnid')) {
					const id = Number(child.getAttribute('data-fnid'));
					const symbol = this.markerSymbol(child);
					if (Number.isFinite(id)) {
						footnoteMarkers.push({ id, symbol });
						segments.push({ kind: 'footnote', symbol });
					}
					continue;
				}
				if (child.hasAttribute('data-mid')) {
					const id = Number(child.getAttribute('data-mid'));
					const symbol = this.markerSymbol(child);
					if (Number.isFinite(id)) {
						crossRefMarkers.push({ id, symbol });
						segments.push({ kind: 'crossref', symbol });
					}
					continue;
				}
				// Unrecognised inline element — keep its text rather than silently
				// dropping it.
				const text = child.textContent ?? '';
				if (text) segments.push({ kind: 'text', text });
			}
		}
		return { isChapterStart, segments, footnoteMarkers, crossRefMarkers };
	}

	/** A marker span's visible symbol is its own text minus its empty `.tt` tooltip child's text. */
	private markerSymbol(el: HTMLElement): string {
		const ttText = el.querySelector('.tt')?.textContent ?? '';
		const full = el.textContent ?? '';
		return full.slice(0, full.length - ttText.length).trim();
	}

	private static htmlToPlainText(html: string): string {
		return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? '';
	}

	/** Study notes ("Studienanmerkungen") attached directly to a verse — VerseCommentaryMap keys them by BibleVerseId, no chapter-DOM parsing needed. */
	private async resolveStudyNotes(verseId: number): Promise<StudyNote[]> {
		if (!this.db || !this.key || !this.iv) return [];
		const res = this.db.exec(`
			SELECT vc.Label AS Label, vc.Content AS Content
			FROM VerseCommentaryMap m
			JOIN VerseCommentary vc ON vc.VerseCommentaryId = m.VerseCommentaryId
			WHERE m.BibleVerseId = ${verseId}
		`);
		if (!res[0]) return [];
		const cols = res[0].columns;
		const out: StudyNote[] = [];
		for (const row of res[0].values) {
			const label = String(row[cols.indexOf('Label')] ?? '');
			const content = row[cols.indexOf('Content')] as Uint8Array | undefined;
			if (!content) continue;
			out.push({ label, html: await decryptBlob(content, this.key, this.iv) });
		}
		return out;
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
