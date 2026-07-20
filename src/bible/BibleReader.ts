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
	private bookByMepsDocumentId = new Map<number, number>();
	private chapterBoundsCache = new Map<string, { firstVerseId: number; firstNumberedVerseId: number; lastVerseId: number } | null>();

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
		this.buildMepsDocumentIndex(db);
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

	// Study notes cross-reference each other via "jwpub://c/<lang>:<mepsDocId>/
	// <chapter>:<verse>$…" links ("Anm. zu Mat 5:18" / "See study note on
	// Mt 5:18"). The href carries chapter and verse directly, but the BOOK only
	// indirectly through the MEPS document id of the target book's own document.
	// The mapping lives in the file itself: Bible-book documents (Type = 2) carry
	// their book number in Document.ChapterNumber (verified against a real nwtsty:
	// MepsDocumentId 1001070144 → ChapterNumber 40 → Matthäus). Read, not guessed —
	// the ids only LOOK sequential per book, and the song-docid saga showed where
	// trusting such an apparent formula ends.
	private buildMepsDocumentIndex(db: Database): void {
		const res = db.exec('SELECT MepsDocumentId, ChapterNumber FROM Document WHERE Type = 2');
		if (!res[0]) return;
		const cols = res[0].columns;
		for (const row of res[0].values) {
			const mepsId = Number(row[cols.indexOf('MepsDocumentId')]);
			const book = Number(row[cols.indexOf('ChapterNumber')]);
			if (mepsId && book >= 1 && book <= 66) this.bookByMepsDocumentId.set(mepsId, book);
		}
	}

	/**
	 * Parses a study-note cross-reference href ("jwpub://c/X:1001070144/5:18$p/…")
	 * into the scripture it points at — or undefined for anything that isn't such
	 * a link or whose target book document isn't in this Bible file. Verified
	 * against all 3557 study notes of a real German nwtsty: every jwpub://c/ link
	 * there starts with this <mepsDocId>/<chapter>:<verse> segment (single verse,
	 * never a range); the $-suffixed tail is a paragraph anchor we don't need.
	 */
	parseCommentaryHref(href: string): Scripture | undefined {
		const m = /^jwpub:\/\/c\/[^:/]+:(\d+)\/(\d+):(\d+)/.exec(href);
		if (!m || !m[1] || !m[2] || !m[3]) return undefined;
		const book = this.bookByMepsDocumentId.get(Number(m[1]));
		if (book === undefined) return undefined;
		return { book, chapter: Number(m[2]), verseStart: Number(m[3]) };
	}

	/**
	 * Resolves the BibleVerseId of a single book:chapter:verse. Not every verse
	 * is directly indexed (only verses that happen to be cited somewhere in
	 * this particular Bible edition are) — e.g. Matthew 13:34 isn't cited
	 * anywhere in a real nwtsty file, even though its neighbour 13:35 is.
	 *
	 * `scanTo` (inclusive, same chapter, may be below `verse` — direction
	 * doesn't matter) additionally searches for any OTHER indexed verse in that
	 * span to derive the target's id by a constant offset — BibleVerseId is
	 * sequential within a chapter, so one indexed neighbour is enough. Pass it
	 * only when a genuine same-chapter neighbour exists to scan towards; it's
	 * meaningless across chapterEnd (see resolveStartId()/resolveEndId()).
	 *
	 * Falls back to the chapter's own BibleChapter row (verse 1 = FirstVerseId,
	 * ids sequential within a chapter) when neither the direct lookup nor the
	 * scan succeed — covers verses cited nowhere in the file, which otherwise
	 * showed "no verse text available" even though the text exists.
	 */
	private resolveVerseId(book: number, chapter: number, verse: number, scanTo?: number): number | undefined {
		const direct = this.verseIdByReference.get(`${book}:${chapter}:${verse}`);
		if (direct !== undefined) return direct;

		if (scanTo !== undefined) {
			const step = scanTo >= verse ? 1 : -1;
			for (let v = verse + step; step > 0 ? v <= scanTo : v >= scanTo; v += step) {
				const id = this.verseIdByReference.get(`${book}:${chapter}:${v}`);
				if (id !== undefined) return id - (v - verse);
			}
		}

		const bounds = this.chapterBounds(book, chapter);
		if (bounds) {
			// firstNumberedVerseId, not firstVerseId: a psalm superscription
			// occupies the chapter's first row without being verse 1 (see
			// chapterBounds()).
			const id = bounds.firstNumberedVerseId + verse - 1;
			if (id <= bounds.lastVerseId) return id;
		}
		return undefined;
	}

	/** Resolves the BibleVerseId of `scripture`'s first verse. */
	private resolveStartId(scripture: Scripture): number | undefined {
		const { book, chapter, verseStart, verseEnd, chapterEnd } = scripture;
		// A same-chapter verseEnd is a genuine neighbour to scan towards; a
		// cross-chapter one belongs to a different chapter's own numbering and
		// would derive a meaningless offset.
		const scanTo = chapterEnd === undefined || chapterEnd === chapter ? verseEnd : undefined;
		return this.resolveVerseId(book, chapter, verseStart, scanTo);
	}

	/** Resolves the BibleVerseId of `scripture`'s last verse — same as its first
	 *  verse when there's no range at all. */
	private resolveEndId(scripture: Scripture): number | undefined {
		if (scripture.verseEnd === undefined) return this.resolveStartId(scripture);
		const endChapter = scripture.chapterEnd ?? scripture.chapter;
		return this.resolveVerseId(scripture.book, endChapter, scripture.verseEnd);
	}

	/**
	 * First/last BibleVerseId of a chapter, from the file's BibleChapter table
	 * (cached). `firstNumberedVerseId` is where verse 1 actually sits: psalms
	 * with a superscription ("Ein Psalm Davids." / "Von David.") carry it as an
	 * extra BibleVerse row BEFORE verse 1 — inside the chapter's id range but
	 * with an empty Label, since it isn't a numbered verse (confirmed against a
	 * real nwtsty: Psalm 15's FirstVerseId row has Label '' and the
	 * superscription as its text; Psalm 1, which has no superscription, starts
	 * straight at verse 1). Naive `firstVerseId + verse - 1` arithmetic was
	 * off by one for every such psalm, resolving Psalm 15:2 to verse 1's row.
	 * Detected from the row's own Label rather than a hardcoded psalm list —
	 * the file says which chapters have one.
	 */
	private chapterBounds(book: number, chapter: number): { firstVerseId: number; firstNumberedVerseId: number; lastVerseId: number } | null {
		const key = `${book}:${chapter}`;
		const cached = this.chapterBoundsCache.get(key);
		if (cached !== undefined) return cached;

		let bounds: { firstVerseId: number; firstNumberedVerseId: number; lastVerseId: number } | null = null;
		if (this.db) {
			const res = this.db.exec(
				`SELECT FirstVerseId, LastVerseId FROM BibleChapter
				 WHERE BookNumber = ${Number(book)} AND ChapterNumber = ${Number(chapter)} LIMIT 1`,
			);
			const row = res[0]?.values[0];
			if (row && row[0] != null && row[1] != null) {
				const firstVerseId = Number(row[0]);
				const lastVerseId = Number(row[1]);
				const labelRes = this.db.exec(`SELECT Label FROM BibleVerse WHERE BibleVerseId = ${firstVerseId}`);
				const label = String(labelRes[0]?.values[0]?.[0] ?? '').trim();
				const firstNumberedVerseId = label === '' && firstVerseId < lastVerseId ? firstVerseId + 1 : firstVerseId;
				bounds = { firstVerseId, firstNumberedVerseId, lastVerseId };
			}
		}
		this.chapterBoundsCache.set(key, bounds);
		return bounds;
	}

	/** 1-based number of verses in the chapter, or undefined when the chapter is unknown.
	 *  Used by the popup's context expansion to stop "next verse" at the chapter end —
	 *  verse ids continue straight into the NEXT chapter, so without this bound an
	 *  expansion would silently show foreign verses. */
	chapterVerseCount(book: number, chapter: number): number | undefined {
		const bounds = this.chapterBounds(book, chapter);
		if (!bounds) return undefined;
		return bounds.lastVerseId - bounds.firstNumberedVerseId + 1;
	}

	/**
	 * Returns each verse in the reference as `{ number, html }` (`number` is the
	 * verse-number label, e.g. "15"; `html` is the still-marked-up, decrypted
	 * verse text), in order — or undefined if the range can't be resolved at
	 * all (see resolveStartId()), no Bible file has been loaded, or reading it
	 * failed (see the try/catch note on getVerseDetails() below).
	 */
	async getVerses(scripture: Scripture): Promise<{ number: string; html: string }[] | undefined> {
		if (!this.db || !this.key || !this.iv) return undefined;
		try {
			const startId = this.resolveStartId(scripture);
			if (startId === undefined) return undefined;
			const endId = this.resolveEndId(scripture) ?? startId;
			if (endId < startId) return undefined;

			const verseCount = endId - startId + 1;
			const verses: { number: string; html: string }[] = [];
			for (let i = 0; i < verseCount; i++) {
				const verse = await this.readVerseRow(startId + i);
				if (verse) verses.push(verse);
			}
			return verses.length > 0 ? verses : undefined;
		} catch {
			// A schema this code doesn't expect (e.g. a table only the study
			// edition has) or a corrupt/truncated blob would otherwise throw all
			// the way up into the popup — every caller already treats undefined
			// as "nothing to show", so that's a strictly safer failure mode than
			// an unhandled exception.
			return undefined;
		}
	}

	/**
	 * Like getVerses(), but each verse also includes its footnotes and cross-
	 * references. More expensive than getVerses() (one extra chapter-HTML
	 * decrypt+parse per distinct chapter touched, plus one small query per
	 * footnote/cross-reference marker) — intended for the verse popup, which
	 * already shows a loading state while this runs.
	 *
	 * Wrapped in a try/catch: this and getVerses() are the only two entry
	 * points every `db.exec()` call in this class is ultimately reached
	 * through (directly or via a private helper), none of which handle a
	 * query failure themselves. A plain `nwt` file, for instance, is not
	 * guaranteed to have the `VerseCommentary`/`VerseCommentaryMap` tables
	 * `resolveStudyNotes()` queries (those were found while investigating a
	 * `nwtsty` file specifically) — every caller already treats `undefined`
	 * as "nothing to show" (see BibleVerseModal), so turning an unexpected
	 * schema/data issue into that same "no result" outcome, instead of an
	 * unhandled exception reaching the popup, is a strictly safer default.
	 */
	async getVerseDetails(scripture: Scripture): Promise<VerseDetail[] | undefined> {
		if (!this.db || !this.key || !this.iv) return undefined;
		try {
			const startId = this.resolveStartId(scripture);
			if (startId === undefined) return undefined;

			let endId = this.resolveEndId(scripture) ?? startId;
			// Verse ids continue seamlessly past a chapter's last verse — clamp to the
			// true END chapter's bound (when known) so neither an overlong same-chapter
			// citation (no chapterEnd) nor a cross-chapter one running past its own
			// declared end chapter can silently bleed foreign verses into the popup.
			const endChapter = scripture.chapterEnd ?? scripture.chapter;
			const endBounds = this.chapterBounds(scripture.book, endChapter);
			if (endBounds) endId = Math.min(endId, endBounds.lastVerseId);
			if (endId < startId) return undefined;
			const verseCount = endId - startId + 1;

			const chapterDomCache = new Map<string, Document | undefined>();
			const details: VerseDetail[] = [];

			// Tracks (chapter, verse) across the range as ids are walked one by one,
			// crossing chapter boundaries via each chapter's own BibleChapter bounds.
			// Necessary now that a range can cross chapters, where "start chapter,
			// verseStart + i" is only valid within the very first chapter of the
			// range — this cursor is the general form of that, still falling back to
			// arithmetic (not the citation index) for verses cited nowhere in the
			// file, e.g. Psalm 117:2.
			let cursorChapter = scripture.chapter;
			let cursorVerse = scripture.verseStart;
			let cursorBounds = this.chapterBounds(scripture.book, cursorChapter);

			for (let i = 0; i < verseCount; i++) {
				const verseId = startId + i;
				if (i > 0) {
					if (cursorBounds && verseId > cursorBounds.lastVerseId) {
						cursorChapter++;
						cursorVerse = 1;
						cursorBounds = this.chapterBounds(scripture.book, cursorChapter);
					} else {
						cursorVerse++;
					}
				}

				const verse = await this.readVerseRow(verseId);
				if (!verse) continue;

				const ref = this.referenceByVerseId.get(verseId)
					?? { book: scripture.book, chapter: cursorChapter, verse: cursorVerse };

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
		} catch {
			return undefined;
		}
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
			// A continuation span (poetic line break within the same verse, e.g.
			// Psalm 1:1's three lines) carries no separating whitespace of its
			// own — the line break itself was the visual separator in the
			// source, lost once every span's text becomes one flat segment
			// list. Without this, adjacent lines run together ("folgtund"
			// instead of "folgt und") in both the popup's own verse text and
			// the "insert as quote" output, which share these segments.
			// The last segment before a new span may just as well be a footnote/
			// crossref marker (e.g. verse 1 ends its second line with a
			// cross-reference letter right before the third line's span
			// starts) — only a 'text' segment already ending in whitespace
			// means the boundary is genuinely already separated; anything
			// else (a marker, or text with no trailing space) still needs one.
			const lastSegment = segments[segments.length - 1];
			const alreadySeparated = lastSegment?.kind === 'text' && /\s$/.test(lastSegment.text);
			if (lastSegment && !alreadySeparated) {
				segments.push({ kind: 'text', text: ' ' });
			}
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
