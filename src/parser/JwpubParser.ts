import AdmZip from 'adm-zip';
import initSqlJs, { Database } from 'sql.js';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { Congress, CongressType, Day, ItemType, ProgramItem, Scripture, Session } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';

const inflate = promisify(zlib.inflate);

const XOR_CONSTANT = Buffer.from(
	'11cbb5587e32846d4c26790c633da289f66fe5842a3a585ce1bc3a294af5ada7',
	'hex',
);

// Matches jwpub://b/NWTR/book:chapter:verse[-book:chapter:verse]
const BIBLE_HREF_RE = /^jwpub:\/\/b\/NWTR\/([\d:]+(?:-[\d:]+)?)$/;
// Time at start of paragraph text
const TIME_RE = /^\s*(\d{1,2}:\d{2})/;
// Skip items that are only music or song lines
const SKIP_TEXT_RE = /^\s*\d{1,2}:\d{2}\s+(Musik(?:video)?)\s*$/i;
// "Beantworte die folgenden Fragen:" / "Answer the following questions:" style Q&A blocks
const QUESTIONS_RE = /^(Beantworte die folgenden Fragen|Answer the following questions)/i;

interface DbRow {
	[col: string]: unknown;
}

export class JwpubParser {

	/**
	 * @param sqlWasmBinary The sql.js WASM binary. Callers own how it's obtained
	 *   (esbuild's "binary" loader embeds it as base64 in main.js at bundle time;
	 *   Node scripts can read it straight from node_modules) — this class only cares
	 *   that it receives the bytes.
	 */
	constructor(private readonly sqlWasmBinary: Uint8Array) {}

	async parse(fileBuffer: Buffer): Promise<Congress> {
		const db = await this.openContents(fileBuffer);
		const pub = this.readPublication(db);
		const keyIv = this.deriveKey(pub);
		const docs = this.readDocuments(db);
		const meta = this.readMetadata(db);

		const congress = await this.buildCongress(docs, meta, keyIv, pub);
		db.close();
		return congress;
	}

	// ──────────────────────────────────────────────────────────────────────────
	// DB access
	// ──────────────────────────────────────────────────────────────────────────

	private async openContents(fileBuffer: Buffer): Promise<Database> {
		const outerZip = new AdmZip(fileBuffer);
		const contentsEntry = outerZip.getEntry('contents');
		if (!contentsEntry) throw new Error('jwpub: missing "contents" entry');

		const innerZip = new AdmZip(contentsEntry.getData());
		const dbEntry = innerZip.getEntries().find(e => e.entryName.endsWith('.db'));
		if (!dbEntry) throw new Error('jwpub: no .db file in contents');

		const wasmBinary = this.sqlWasmBinary.buffer.slice(
			this.sqlWasmBinary.byteOffset,
			this.sqlWasmBinary.byteOffset + this.sqlWasmBinary.byteLength,
		) as ArrayBuffer;
		const SQL = await initSqlJs({ wasmBinary });
		return new SQL.Database(dbEntry.getData());
	}

	private readPublication(db: Database): DbRow {
		const res = db.exec('SELECT * FROM Publication LIMIT 1');
		if (!res[0]) throw new Error('jwpub: Publication table empty');
		const cols = res[0].columns;
		const vals = res[0].values[0] ?? [];
		return Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
	}

	private readDocuments(db: Database): DbRow[] {
		const res = db.exec('SELECT DocumentId, Title, Content FROM Document ORDER BY DocumentId');
		if (!res[0]) return [];
		const cols = res[0].columns;
		return res[0].values.map(row => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
	}

	private readMetadata(db: Database): Map<number, Map<string, string>> {
		const res = db.exec('SELECT DocumentId, MetadataKey, Value FROM DocumentMetadata');
		const map = new Map<number, Map<string, string>>();
		if (!res[0]) return map;
		for (const row of res[0].values) {
			const docId = Number(row[0]);
			const key   = String(row[1]);
			const value = String(row[2] ?? '');
			if (!map.has(docId)) map.set(docId, new Map());
			map.get(docId)!.set(key, value);
		}
		return map;
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Key derivation (spec §4.3)
	// ──────────────────────────────────────────────────────────────────────────

	private deriveKey(pub: DbRow): { key: Buffer; iv: Buffer } {
		const mepsLang      = Number(pub['MepsLanguageIndex']);
		const symbol        = String(pub['Symbol']);
		const year          = Number(pub['Year']);
		const issueTag      = Number(pub['IssueTagNumber']); // cast: sql.js may return string "0"

		let cardString = `${mepsLang}_${symbol}_${year}`;
		if (issueTag !== 0) cardString += `_${issueTag}`;

		const hash  = crypto.createHash('sha256').update(cardString).digest();
		const xored = Buffer.alloc(32);
		for (let i = 0; i < 32; i++) xored[i] = (hash[i] ?? 0) ^ (XOR_CONSTANT[i] ?? 0);
		return { key: xored.subarray(0, 16), iv: xored.subarray(16, 32) };
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Decryption
	// ──────────────────────────────────────────────────────────────────────────

	private async decrypt(content: Buffer, key: Buffer, iv: Buffer): Promise<string> {
		const decipher  = crypto.createDecipheriv('aes-128-cbc', key, iv);
		const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
		const inflated  = await inflate(decrypted);
		return inflated.toString('utf-8');
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Congress assembly
	// ──────────────────────────────────────────────────────────────────────────

	private async buildCongress(
		docs: DbRow[],
		meta: Map<number, Map<string, string>>,
		keyIv: { key: Buffer; iv: Buffer },
		pub: DbRow,
	): Promise<Congress> {
		const symbol = String(pub['Symbol']);
		const year   = Number(pub['Year']);
		const type   = this.detectType(symbol);

		// Theme: for CO the cover doc title is the theme ("Ewiges Glück").
		// For CA the cover doc title is the publication name; the actual congress
		// motto is the title of document 1 (the program document).
		const coverMeta  = meta.get(0);
		const rawTheme   = coverMeta?.get('MEPS:Title') ?? '';
		const isCA       = type === 'CA-copgm' || type === 'CA-brpgm';
		const theme      = isCA ? (meta.get(1)?.get('MEPS:Title') ?? rawTheme) : rawTheme;

		const days: Day[] = [];
		let themeScripture: Scripture | undefined;

		for (const doc of docs) {
			const docId = Number(doc['DocumentId']);
			const raw   = Buffer.from(doc['Content'] as Uint8Array);

			let html: string;
			try {
				html = await this.decrypt(raw, keyIv.key, keyIv.iv);
			} catch {
				continue;
			}

			const dom = new DOMParser().parseFromString(html, 'text/html');

			// Cover document: extract theme scripture
			if (docId === 0) {
				themeScripture = this.extractThemeScripture(dom);
				continue;
			}

			// Standalone "Beantworte die folgenden Fragen" document — attach to the
			// day it belongs to (the most recently parsed one) as its own session.
			const questionsItem = this.extractQuestionsDocument(dom);
			if (questionsItem) {
				const targetDay = days[days.length - 1];
				if (targetDay) {
					targetDay.sessions.push({ name: 'Wiederholungsfragen', items: [questionsItem] });
				}
				continue;
			}

			// Skip other info pages (no <h2>Vormittag/Nachmittag)
			const dayName = this.extractDayName(dom);
			if (!dayName) continue;

			const day = this.parseDay(dom, dayName);
			if (day.sessions.some(s => s.items.length > 0)) {
				days.push(day);
			}
		}

		// Keep "Wiederholungsfragen" as the last session of its day, regardless of
		// the order in which its source document appeared in the jwpub file.
		for (const day of days) {
			day.sessions.sort((a, b) =>
				(a.name === 'Wiederholungsfragen' ? 1 : 0) - (b.name === 'Wiederholungsfragen' ? 1 : 0),
			);
		}

		// CO: sort Freitag → Samstag → Sonntag
		days.sort((a, b) => this.dayOrder(a.weekday) - this.dayOrder(b.weekday));

		return { type, theme, themeScripture, year, days };
	}

	// ──────────────────────────────────────────────────────────────────────────
	// HTML parsing
	// ──────────────────────────────────────────────────────────────────────────

	private extractThemeScripture(dom: Document): Scripture | undefined {
		// CA: <p class="themeScrp"><a href="jwpub://b/NWTR/...">
		const a = dom.querySelector('p.themeScrp a[href]');
		if (a) return this.hrefToScripture(a.getAttribute('href') ?? '');

		// CO cover doc: first <a href="jwpub://b/NWTR/..."> anywhere
		const firstRef = dom.querySelector('a[href^="jwpub://b/NWTR/"]');
		if (firstRef) return this.hrefToScripture(firstRef.getAttribute('href') ?? '');

		return undefined;
	}

	private extractDayName(dom: Document): string | null {
		const h1 = dom.querySelector('h1');
		if (!h1) return null;
		const text = h1.textContent?.trim() ?? '';

		// CO: explicit weekday in h1
		const match = /\b(Freitag|Samstag|Sonntag)\b/i.exec(text);
		if (match) return match[1] ?? null;

		// CA: one-day congress — h1 has theme, not weekday.
		// Detect by presence of session structure (h2 inside bodyTxt).
		const hasSession = dom.querySelector('.bodyTxt h2') !== null;
		if (hasSession) return 'Samstag';

		return null;
	}

	private parseDay(dom: Document, dayName: string): Day {
		const bodyTxt = dom.querySelector('.bodyTxt');
		const sessions: Session[] = [];

		if (!bodyTxt) return { name: dayName, weekday: dayName, sessions };

		// Split by <h2> session headers
		const children = Array.from(bodyTxt.children);
		let currentSessionName = 'Vormittag';
		let currentItems: ProgramItem[] = [];

		for (const child of children) {
			if (child.tagName === 'H2') {
				if (currentItems.length > 0) {
					sessions.push({ name: currentSessionName, items: currentItems });
					currentItems = [];
				}
				currentSessionName = child.textContent?.trim() ?? 'Vormittag';
				continue;
			}

			if (child.tagName === 'UL' && child.classList.contains('noMarker')) {
				for (const li of Array.from(child.children)) {
					if (li.tagName !== 'LI') continue;
					const item = this.parseLi(li as HTMLElement);
					if (item) currentItems.push(item);
				}
			}
		}

		if (currentItems.length > 0) {
			sessions.push({ name: currentSessionName, items: currentItems });
		}

		return { name: dayName, weekday: dayName, sessions };
	}

	private parseLi(li: HTMLElement): ProgramItem | null {
		const firstP = li.querySelector('p');
		if (!firstP) return null;

		const firstText = firstP.textContent ?? '';

		// Extract time
		const timeMatch = TIME_RE.exec(firstText);
		if (!timeMatch) return null;
		const time = timeMatch[1] ?? '';

		// Skip Musik/Musikvideo lines
		if (SKIP_TEXT_RE.test(firstText)) return null;

		// Song reference (has jwpub://p/X: link but no bible ref) — captured as its own
		// item so it can be listed & linked in the day overview, but doesn't get its own note.
		const songLink     = li.querySelector('a[href^="jwpub://p/X:"]');
		const hasBibleLink = li.querySelector('a[href^="jwpub://b/NWTR/"]') !== null;
		if (songLink && !hasBibleLink) {
			return this.parseSongLine(time, songLink);
		}

		// Detect type from span.du-color or <strong> prefix
		const [itemType, hasTypeMarker] = this.detectItemType(li);

		// Extract title, subtitle, sub-parts
		if (itemType === 'bible-drama') {
			return this.parseBibleDrama(li, time, itemType);
		}
		if (itemType === 'talk-series') {
			return this.parseTalkSeries(li, time, itemType, hasTypeMarker);
		}

		// "Beantworte die folgenden Fragen:" Q&A block — same shape as a talk series
		// (a title followed by a numbered sub-list), just without a TYPE: marker.
		const textAfterTime = firstText.replace(TIME_RE, '').trim();
		if (QUESTIONS_RE.test(textAfterTime)) {
			return this.parseQuestionsBlock(li, time);
		}

		// Regular item
		const title = this.extractTitle(firstP, time, hasTypeMarker);
		if (!title) return null;

		const scriptures = this.extractScriptures(li);
		return { time, itemType, title, scriptures, bulletPoints: [] };
	}

	private parseSongLine(time: string, songLink: Element): ProgramItem | null {
		const text = songLink.textContent?.trim() ?? '';
		const numMatch = /(\d+)/.exec(text);
		if (!numMatch) return null;
		const songNumber = Number(numMatch[1]);
		return {
			time,
			itemType: 'song',
			title: text || `Lied ${songNumber}`,
			scriptures: [],
			bulletPoints: [],
			songNumber,
		};
	}

	private parseBibleDrama(li: HTMLElement, time: string, itemType: ItemType): ProgramItem | null {
		const paragraphs = Array.from(li.querySelectorAll('p'));
		// P0: "10:10 BIBELDRAMA:"  (skip)
		// P1: series title (bold+italic)
		// P2: episode subtitle + refs (italic)
		const seriesTitle = paragraphs[1]?.textContent?.trim() ?? '';
		const episodeText = paragraphs[2]?.textContent?.trim() ?? '';
		const title    = seriesTitle || 'Bibeldrama';
		const subtitle = episodeText || undefined;
		const scriptures = this.extractScriptures(li);
		return { time, itemType, title, subtitle, scriptures, bulletPoints: [] };
	}

	private parseTalkSeries(li: HTMLElement, time: string, itemType: ItemType, hasTypeMarker: boolean): ProgramItem | null {
		const firstP   = li.querySelector('p');
		const title    = this.extractTitle(firstP!, time, hasTypeMarker);
		if (!title) return null;

		// Scriptures directly on the series (if any) — excludes the nested sub-parts
		// list, whose scriptures are already shown individually per part.
		const sourceList = li.querySelector('ul.source, ol.source');
		const scriptures = this.extractScriptures(li, sourceList);
		const parts = this.extractSubParts(li);

		return { time, itemType, title, scriptures, bulletPoints: [], parts };
	}

	private parseQuestionsBlock(li: HTMLElement, time: string): ProgramItem | null {
		const parts = this.extractSubParts(li);
		if (parts.length === 0) return null;
		return {
			time,
			itemType: 'talk-series',
			title: 'Beantworte die folgenden Fragen',
			scriptures: [],
			bulletPoints: [],
			parts,
		};
	}

	/** Standalone "Beantworte die folgenden Fragen" / "Answer the following questions" document. */
	private extractQuestionsDocument(dom: Document): ProgramItem | null {
		const h1 = dom.querySelector('h1');
		const h1Text = h1?.textContent?.trim() ?? '';
		if (!QUESTIONS_RE.test(h1Text)) return null;

		const body = dom.querySelector('.bodyTxt') ?? dom.body;
		if (!body) return null;
		const parts = this.extractSubParts(body as HTMLElement);
		if (parts.length === 0) return null;

		return {
			time: '',
			itemType: 'talk-series',
			title: 'Beantworte die folgenden Fragen',
			scriptures: [],
			bulletPoints: [],
			parts,
		};
	}

	/** Extracts numbered sub-items from a nested <ul class="source"> (or any nested list) inside `container`. */
	private extractSubParts(container: HTMLElement): ProgramItem[] {
		const parts: ProgramItem[] = [];
		const sourceList = container.querySelector('ul.source, ol.source') ?? container.querySelector('ul, ol');
		if (!sourceList) return parts;

		let index = 1;
		for (const subLi of Array.from(sourceList.children)) {
			if (subLi.tagName !== 'LI') continue;
			const subP = subLi.querySelector('p') ?? subLi;
			let subTitle = (subP.textContent ?? '').replace(/^[•-]\s*/, '').replace(/^\d+\.\s*/, '').trim();
			subTitle = this.stripScriptureCitation(subTitle);
			if (!subTitle) continue;
			const subScriptures = this.extractScriptures(subLi as HTMLElement);
			parts.push({
				time: '',
				itemType: 'talk',
				title: `${index}. ${subTitle}`,
				scriptures: subScriptures,
				bulletPoints: [],
			});
			index++;
		}
		return parts;
	}

	/**
	 * Returns [itemType, hasExplicitTypeMarker].
	 * hasExplicitTypeMarker is true when a labeled span/strong is present (needed to
	 * decide whether to strip the "TYPE: " prefix from the title).
	 */
	private detectItemType(li: HTMLElement): [ItemType, boolean] {
		// CO style: <span class="du-color--..."><strong>TYPE:</strong></span>
		const colorSpan = li.querySelector('span[class*="du-color--"]');
		const spanText  = colorSpan?.textContent?.trim().toUpperCase() ?? '';

		// CA style: direct <strong>Type:</strong> inside first <p>
		const firstP      = li.querySelector('p');
		const firstStrong = firstP?.querySelector('strong');
		const strongText  = firstStrong?.textContent?.trim().toUpperCase() ?? '';

		const marker = spanText || strongText;

		if (/BIBELDRAMA|BIBLE\s*DRAMA/.test(marker))  return ['bible-drama', true];
		if (/VORTRAGSREIHE|SYMPOSIUM/.test(marker))   return ['talk-series', true];
		if (/TAUFE|BAPTISM/.test(marker))             return ['baptism', true];
		if (/INTERVIEW/.test(marker))                  return ['interview', true];
		if (/VORTRAG|TALK|REDE/.test(marker))         return ['talk', true];

		return ['talk', false];
	}

	private extractTitle(p: HTMLElement, time: string, hasTypeMarker: boolean): string {
		let text = p.textContent ?? '';
		// Remove leading time
		text = text.replace(TIME_RE, '').trim();
		// Only strip the "TYPE: " prefix when an explicit type marker exists.
		// Without this guard the regex would eat into scripture references like "Mt 5:1".
		if (hasTypeMarker) {
			text = text.replace(/^[^:]+:\s*/, '').trim();
		}
		// Remove leading punctuation
		text = text.replace(/^[-–—·]\s*/, '').trim();
		return this.stripScriptureCitation(text);
	}

	// Remove a trailing parenthetical scripture citation, e.g. "(Psalm 16:11; 100:2)"
	private stripScriptureCitation(text: string): string {
		return text.replace(/\s*\([^()]*\d+:\d+[^()]*\)\s*$/, '').trim();
	}

	/**
	 * @param exclude Skip links inside this element — used so a talk-series' own
	 *   scripture list doesn't also swallow every scripture already covered by its
	 *   sub-parts (which are nested inside `container`).
	 */
	private extractScriptures(container: HTMLElement, exclude?: Element | null): Scripture[] {
		const scriptures: Scripture[] = [];
		const links = container.querySelectorAll('a[href]');
		for (const link of Array.from(links)) {
			if (exclude && exclude.contains(link)) continue;
			const href = link.getAttribute('href') ?? '';
			const m    = BIBLE_HREF_RE.exec(href);
			if (!m || !m[1]) continue;
			try {
				scriptures.push(ScriptureNormalizer.fromJwpub(m[1]));
			} catch {
				// ignore malformed
			}
		}
		return scriptures;
	}

	private hrefToScripture(href: string): Scripture | undefined {
		const m = BIBLE_HREF_RE.exec(href);
		if (!m || !m[1]) return undefined;
		try {
			return ScriptureNormalizer.fromJwpub(m[1]);
		} catch {
			return undefined;
		}
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Helpers
	// ──────────────────────────────────────────────────────────────────────────

	private detectType(symbol: string): CongressType {
		if (/^CO-/.test(symbol))     return 'CO';
		if (/brpgm/.test(symbol))    return 'CA-brpgm';
		return 'CA-copgm';
	}

	private dayOrder(weekday: string): number {
		const order: Record<string, number> = { Freitag: 0, Samstag: 1, Sonntag: 2 };
		return order[weekday] ?? 99;
	}
}
