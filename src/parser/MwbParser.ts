import type { Database } from 'sql.js';
import {
	MemorialReadingDay,
	MemorialReadingSchedule,
	Mwb,
	MwbItem,
	MwbSection,
	MwbSong,
	MwbWeek,
} from '../models/mwb';
import { Scripture } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';
import { NL, NoteStrings } from '../i18n';
import { DbRow, decryptBlob, deriveKey, openJwpubDatabase, readPublication } from '../util/jwpubCrypto';
import { ParseError } from '../util/parseErrors';
import { assertPlatformSupport, BIBLE_HREF_RE, MEPS_LANGUAGE_INDEX, SONG_DOCID_HREF_RE, SONG_HREF_SELECTOR } from '../util/jwpubLinks';

// A numbered programme item's heading, e.g. "1. „Das Los derer, die uns
// ausplündern“" — the number is taken verbatim, never recomputed, since it's
// already stable in the source and numbering continues across all 3 sections
// (not restarted per section).
const NUMBERED_ITEM_RE = /^(\d+)\.\s*(.+)$/;
// Trailing "(N Min.)" duration marker — German-only for v1 (see MwbParser's
// class doc comment on language scope).
const DURATION_RE = /\((\d{1,3})\s*Min\.?\)/;
// A leading run of ALL-CAPS words followed by a period, e.g. "VON HAUS ZU
// HAUS." / "INFORMELL." — the assignment-type label some ministry items
// carry inline. Captured verbatim (not mapped to a closed vocabulary): only
// 3 distinct labels have been confirmed across 6 real files spanning half a
// year, nowhere near enough to trust a hardcoded list for the other ~20
// weeks/year not yet seen — a missed/mismatched label would silently drop
// real information, where verbatim capture loses nothing.
const ASSIGNMENT_TYPE_RE = /^([A-ZÄÖÜß][A-ZÄÖÜß\s]{2,40})\./;

/**
 * Parses a Life-and-Ministry-Meeting-Workbook ("Leben und Dienst" / mwb)
 * jwpub file into an `Mwb` (see models/mwb.ts). Mirrors JwpubParser's overall
 * shape (open → read Publication → decrypt each Document → parse its HTML),
 * reusing the same low-level jwpub decryption/decompression pipeline
 * (util/jwpubCrypto.ts, util/jwpubLinks.ts) — only the per-document HTML
 * traversal differs, since a meeting workbook's DOM shape (h2 section
 * headers with a sequence of numbered h3 items, not a congress's
 * `ul.noMarker > li` list) is structurally unrelated to JwpubParser's.
 *
 * v1 is deliberately German-only: the three section-heading labels and the
 * Congregation-Bible-Study title (NoteStrings.treasuresLabel/ministryLabel/
 * livingLabel/cbsLabel) double as both display text AND parser detection
 * anchors, and only German real files have been examined so far — matching
 * unverified text in another language risks silently misparsing every week.
 * Any other detected MepsLanguageIndex is rejected with a clear ParseError
 * rather than guessed at.
 */
export class MwbParser {

	constructor(private readonly sqlWasmBinary: Uint8Array) {}

	private get t(): NoteStrings {
		return NL.de;
	}

	async parse(fileBuffer: Uint8Array): Promise<Mwb> {
		assertPlatformSupport();
		const { db } = await openJwpubDatabase(fileBuffer, this.sqlWasmBinary);
		const pub = readPublication(db);

		const lang = MEPS_LANGUAGE_INDEX[Number(pub['MepsLanguageIndex'])];
		if (lang !== 'de') {
			db.close();
			throw new ParseError('mwbLanguageNotSupported');
		}

		const keyIv = await deriveKey(pub);
		const docs = this.readDocuments(db);

		const mwb = await this.buildMwb(docs, pub, keyIv);
		db.close();
		return mwb;
	}

	private readDocuments(db: Database): DbRow[] {
		const res = db.exec('SELECT DocumentId, Title, Content FROM Document ORDER BY DocumentId');
		if (!res[0]) return [];
		const cols = res[0].columns;
		return res[0].values.map(row => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
	}

	private async buildMwb(docs: DbRow[], pub: DbRow, keyIv: { key: Uint8Array; iv: Uint8Array }): Promise<Mwb> {
		const weeks: MwbWeek[] = [];
		let memorialReading: MemorialReadingSchedule | undefined;

		for (const doc of docs) {
			const docId = Number(doc['DocumentId']);
			if (docId === 0) continue; // cover/title page, no week content

			const rawTitle = String(doc['Title']);
			const raw = doc['Content'] as Uint8Array;

			let html: string;
			try {
				html = await decryptBlob(raw, keyIv.key, keyIv.iv);
			} catch {
				continue; // one bad document must not kill the whole import
			}

			const dom = new DOMParser().parseFromString(html, 'text/html');

			if (rawTitle.includes('Bibelleseprogramm')) {
				memorialReading = this.parseMemorialReadingDocument(dom, rawTitle) ?? memorialReading;
				continue;
			}

			const week = this.parseWeekDocument(dom);
			if (week) weeks.push(week);
		}

		if (weeks.length === 0) {
			throw new ParseError('mwbNoWeekDocuments');
		}

		return {
			symbol: String(pub['Symbol']),
			year: Number(pub['Year']),
			issueTagNumber: String(pub['IssueTagNumber']),
			weeks,
			memorialReading,
			lang: 'de',
		};
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Generic DOM flattening
	// ──────────────────────────────────────────────────────────────────────────

	/**
	 * Flattens `container`'s subtree into a document-order sequence of
	 * "blocks", where each block is either a heading element (h2/h3) or a
	 * content-bearing element (paragraph, list, image, …). A wrapper `<div>`
	 * that itself contains a nested h2/h3 is transparently unwrapped (its own
	 * children are flattened in its place) — real mwb markup wraps a
	 * section's very first item together with its own content in one such
	 * div, while every other item's heading is a plain top-level sibling
	 * followed by separate top-level content divs. Unwrapping generically
	 * handles both shapes without hardcoding "the first item is special".
	 */
	private collectBlocks(container: Element): Element[] {
		const blocks: Element[] = [];
		for (const child of Array.from(container.children)) {
			if (child.tagName === 'H2' || child.tagName === 'H3') {
				blocks.push(child);
				continue;
			}
			if (child.querySelector('h2, h3')) {
				blocks.push(...this.collectBlocks(child));
			} else {
				blocks.push(child);
			}
		}
		return blocks;
	}

	/** `Element.querySelectorAll` only ever matches DESCENDANTS — real markup
	 *  sometimes puts the interesting class directly on a top-level block
	 *  itself (e.g. the Memorial reading schedule's `.gen-field` divs are
	 *  themselves top-level blocks after collectBlocks() unwraps their parent,
	 *  not nested inside another container), so callers that scan a list of
	 *  blocks for a selector must check each block itself too. */
	private matchingSelfOrDescendants(el: Element, selector: string): Element[] {
		const self = el.matches(selector) ? [el] : [];
		return [...self, ...Array.from(el.querySelectorAll(selector))];
	}

	private cleanText(text: string): string {
		// U+00AD SOFT HYPHEN appears inside some real headings (e.g.
		// "Versammlungs­bibelstudium") purely as a line-break hint — invisible
		// to a human reader, but breaks a naive strict-equality label match.
		return text.replace(/­/g, '').replace(/\s+/g, ' ').trim();
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Week document
	// ──────────────────────────────────────────────────────────────────────────

	private parseWeekDocument(dom: Document): MwbWeek | null {
		const bodyTxt = dom.querySelector('.bodyTxt');
		if (!bodyTxt) return null;

		const header = dom.querySelector('header');
		const h1 = header?.querySelector('h1');
		if (!h1) return null;
		const dateRangeLabel = this.cleanText(h1.textContent ?? '');

		const h2InHeader = header?.querySelector('h2');
		const bibleReadingLabel = this.cleanText(h2InHeader?.textContent ?? '');
		const bibleReading = h2InHeader ? this.extractScriptures([h2InHeader]) : [];

		type PartialItem = { number: number; title: string; section: MwbSection | null; contentEls: Element[] };
		const items: MwbItem[] = [];
		const songHeadingEls: Element[] = [];
		let currentSection: MwbSection | null = null;
		let currentItem: PartialItem | null = null;

		const flushItem = () => {
			if (currentItem) items.push(this.finalizeItem(currentItem));
			currentItem = null;
		};

		for (const block of this.collectBlocks(bodyTxt)) {
			if (block.tagName === 'H2') {
				flushItem();
				currentSection = this.matchSection(block.textContent ?? '');
				continue;
			}
			if (block.tagName === 'H3') {
				const text = this.cleanText(block.textContent ?? '');
				const m = NUMBERED_ITEM_RE.exec(text);
				if (m) {
					flushItem();
					currentItem = { number: Number(m[1]), title: m[2]!.trim(), section: currentSection, contentEls: [] };
				} else {
					flushItem();
					songHeadingEls.push(block);
				}
				continue;
			}
			// Plain content block — belongs to whichever item most recently
			// started (may span several separate top-level siblings, e.g. a
			// duration paragraph, an image div and a sub-question list div
			// all following the same item's heading in turn).
			if (currentItem) currentItem.contentEls.push(block);
		}
		flushItem();

		if (items.length === 0) return null;

		const songs = this.classifySongHeadings(songHeadingEls, dateRangeLabel);
		if (!songs) return null;

		// Positional CBS fallback: the title match inside finalizeItem() already
		// catches "Versammlungsbibelstudium" in every real file seen so far —
		// this only guards against an unexpected title variant, never
		// overriding an already-found match.
		if (!items.some(i => i.isCongregationBibleStudy)) {
			for (let i = items.length - 1; i >= 0; i--) {
				if (items[i]!.section === 'living') {
					items[i]!.isCongregationBibleStudy = true;
					break;
				}
			}
		}

		return {
			dateRangeLabel,
			bibleReadingLabel,
			bibleReading,
			openingSong: songs.opening,
			midWeekSong: songs.midWeek,
			closingSong: songs.closing,
			items,
		};
	}

	private matchSection(headingText: string): MwbSection | null {
		const text = this.cleanText(headingText).toUpperCase();
		const t = this.t;
		if (t.treasuresLabel && text === t.treasuresLabel.toUpperCase()) return 'treasures';
		if (t.ministryLabel && text === t.ministryLabel.toUpperCase()) return 'ministry';
		if (t.livingLabel && text === t.livingLabel.toUpperCase()) return 'living';
		console.warn(`MwbParser: unrecognized section heading "${headingText}" — items after it keep the previous section.`);
		return null;
	}

	private finalizeItem(partial: { number: number; title: string; section: MwbSection | null; contentEls: Element[] }): MwbItem {
		const t = this.t;
		const title = partial.title;
		const isCongregationBibleStudy = !!t.cbsLabel && this.cleanText(title).toUpperCase() === t.cbsLabel.toUpperCase();
		return {
			number: partial.number,
			section: partial.section ?? 'living',
			title,
			durationMin: this.extractDuration(partial.contentEls),
			assignmentType: this.extractAssignmentType(partial.contentEls),
			sourceCitation: this.extractSourceCitation(partial.contentEls),
			scriptures: this.extractScriptures(partial.contentEls),
			subQuestions: this.extractSubQuestions(partial.contentEls),
			isCongregationBibleStudy,
		};
	}

	private extractDuration(els: Element[]): number | undefined {
		for (const el of els) {
			const m = DURATION_RE.exec(el.textContent ?? '');
			if (m) return Number(m[1]);
		}
		return undefined;
	}

	private extractAssignmentType(els: Element[]): string | undefined {
		for (const el of els) {
			const text = this.cleanText(el.textContent ?? '');
			const withoutDuration = text.replace(/^\(\d{1,3}\s*Min\.?\)\s*/, '');
			const m = ASSIGNMENT_TYPE_RE.exec(withoutDuration);
			if (m) return m[1]!.trim();
		}
		return undefined;
	}

	private extractSourceCitation(els: Element[]): string | undefined {
		let last: string | undefined;
		for (const el of els) {
			for (const link of Array.from(el.querySelectorAll('a.xt[href^="jwpub://p/"]'))) {
				const text = link.textContent?.trim();
				if (text) last = text;
			}
		}
		return last;
	}

	private extractScriptures(els: Element[]): Scripture[] {
		const scriptures: Scripture[] = [];
		for (const el of els) {
			const links = Array.from(el.querySelectorAll('a[href]'));
			for (const link of links) {
				const href = link.getAttribute('href') ?? '';
				const m = BIBLE_HREF_RE.exec(href);
				if (!m || !m[1]) continue;
				try {
					scriptures.push(ScriptureNormalizer.fromJwpub(m[1]));
				} catch {
					// ignore malformed
				}
			}
		}
		return scriptures;
	}

	private extractSubQuestions(els: Element[]): string[] {
		const questions: string[] = [];
		for (const el of els) {
			for (const li of Array.from(el.querySelectorAll('li'))) {
				const clone = li.cloneNode(true) as HTMLElement;
				clone.querySelectorAll('textarea, .dc-screenReaderText').forEach(node => node.remove());
				const text = this.cleanText(clone.textContent ?? '');
				if (text) questions.push(text);
			}
		}
		return questions;
	}

	private parseSongHeading(h3: Element): MwbSong | null {
		const songLink = h3.querySelector(SONG_HREF_SELECTOR);
		if (!songLink) return null;
		const linkText = songLink.textContent?.trim() ?? '';
		const numMatch = /(\d+)/.exec(linkText);
		if (!numMatch) return null;
		const songNumber = Number(numMatch[1]);
		const docidMatch = SONG_DOCID_HREF_RE.exec(songLink.getAttribute('href') ?? '');
		const songDocid = docidMatch?.[1] ? Number(docidMatch[1]) : undefined;

		const fullText = h3.textContent ?? '';
		const includesPrayer = /und Gebet/i.test(fullText) || undefined;
		const includesIntroWords = /Einleitende Worte/i.test(fullText) || undefined;

		return { songNumber, songDocid, includesPrayer, includesIntroWords };
	}

	private classifySongHeadings(
		els: Element[],
		dateRangeLabel: string,
	): { opening: MwbSong; midWeek?: MwbSong; closing: MwbSong } | null {
		if (els.length === 3) {
			const opening = this.parseSongHeading(els[0]!);
			const midWeek = this.parseSongHeading(els[1]!);
			const closing = this.parseSongHeading(els[2]!);
			if (!opening || !closing) return null;
			return { opening, midWeek: midWeek ?? undefined, closing };
		}
		if (els.length === 2) {
			console.warn(`MwbParser: week "${dateRangeLabel}" has 2 song headings instead of the usual 3 — no mid-week song recorded.`);
			const opening = this.parseSongHeading(els[0]!);
			const closing = this.parseSongHeading(els[1]!);
			if (!opening || !closing) return null;
			return { opening, closing };
		}
		console.warn(`MwbParser: week "${dateRangeLabel}" has ${els.length} song headings (expected 2-3) — skipping this week.`);
		return null;
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Memorial Bible-reading-schedule document
	// ──────────────────────────────────────────────────────────────────────────

	/** The "Bibelleseprogramm für das Gedächtnismahl" insert (Memorial season
	 *  only) — a per-day checklist of Bible readings, structurally unrelated
	 *  to a normal week (no 3-section programme, no numbered items). */
	private parseMemorialReadingDocument(dom: Document, title: string): MemorialReadingSchedule | null {
		const bodyTxt = dom.querySelector('.bodyTxt');
		if (!bodyTxt) return null;

		const header = dom.querySelector('header');
		const intro = this.cleanText(header?.querySelector('p')?.textContent ?? '') || undefined;

		const days: MemorialReadingDay[] = [];
		let current: MemorialReadingDay | null = null;

		for (const block of this.collectBlocks(bodyTxt)) {
			if (block.tagName === 'H2') {
				if (current) days.push(current);
				current = { dayLabel: this.cleanText(block.textContent ?? ''), readings: [] };
				continue;
			}
			if (!current) continue;

			for (const genField of this.matchingSelfOrDescendants(block, '.gen-field')) {
				const bibleLink = genField.querySelector('a[href^="jwpub://b/NWTR/"]');
				const href = bibleLink?.getAttribute('href') ?? '';
				const m = BIBLE_HREF_RE.exec(href);
				if (!m || !m[1]) continue;
				try {
					current.readings.push({ scripture: ScriptureNormalizer.fromJwpub(m[1]) });
				} catch {
					// ignore malformed
				}
			}
			// A source-citation link (e.g. "Jesus – der Weg, Kap. 101") sits as
			// its own sibling paragraph, not inside .gen-field — attach it to
			// the day's most recently added reading.
			for (const link of this.matchingSelfOrDescendants(block, 'a.xt[href^="jwpub://p/"]')) {
				const text = link.textContent?.trim();
				const lastReading = current.readings[current.readings.length - 1];
				if (text && lastReading) lastReading.sourceCitation = text;
			}
		}
		if (current) days.push(current);

		if (days.length === 0) return null;
		return { title, intro, days };
	}
}
