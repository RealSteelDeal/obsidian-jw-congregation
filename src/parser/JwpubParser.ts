import type { Unzipped } from 'fflate';
import type { Database } from 'sql.js';
import { Congress, CongressType, CoverImage, Day, ItemType, ProgramItem, Scripture, Session } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';
import { CongressLang } from '../normalizer/bookNames';
import { NL, NoteStrings } from '../i18n';
import { DbRow, decryptBlob, deriveKey, openJwpubDatabase, readPublication } from '../util/jwpubCrypto';
import { assertPlatformSupport, BIBLE_HREF_RE, MEPS_LANGUAGE_INDEX, SONG_DOCID_HREF_RE, SONG_HREF_SELECTOR } from '../util/jwpubLinks';

// Time at start of paragraph text — same "H:MM" shape in German (24h) and
// English (12h without am/pm) programme files; French uses a period instead
// of a colon ("9.20"), confirmed against the real French CO/CA programme
// files — captured by the same group and normalized to a colon below so the
// generated notes' time field stays consistently formatted across languages.
const TIME_RE = /^\s*(\d{1,2})[:.](\d{2})/;
// Standalone music line (no song link, no talk) — shown in the overview as an
// aside, without its own note. Real-world variants, confirmed against each
// language's real CO/CA programme files: "Musik" (German CA), "Musikvideo"
// (German CO), "Music" (English CA), "Music-Video Presentation" (English CO;
// the hyphen may be a non-breaking variant, hence the class), "Musique"/"Vidéo
// musicale" (French), "Musica"/"Video musicale" (Italian), "Música"/"Vídeo
// musical" (Portuguese), "Музыка"/"Музыкальное видео" (Russian), "Música"/
// "Video musical" (Spanish).
const MUSIC_VIDEO_RE = /^(Musik(?:video)?|Music(?:[\s‐-―-]?Video)?(?:\s?Presentation)?|Vidéo musicale|Musique|Video musicale|Musica|Vídeo musical|Música|Video musical|Музыкальное видео|Музыка)$/iu;
// Standalone break line, optionally with a duration, e.g. "Pause" or
// "Pause (15 Min.)" / "Intermission" — same treatment: overview-only, no note.
// No standalone equivalent observed in the real French/Italian/Portuguese/
// Russian/Spanish programme files (their breaks are always folded into the
// preceding song line, e.g. "Cantico 14 e intervallo") — nothing to add here
// until a real file shows one.
const PAUSE_RE = /^((?:Pause|Intermission)\b.*)$/i;
// Printed review-questions blocks/documents. Real h1s (colon stripped for
// display, see NL[lang].questionsTitle): German "Beantworte die folgenden
// Fragen:", English "Find Answers to These Questions:", French "Soyez
// attentifs aux réponses à ces questions :", Italian "Rispondete a queste
// domande:", Portuguese "Esteja atento às respostas para as seguintes
// perguntas:", Russian "Узнайте ответы на эти вопросы:", Spanish "Anota las
// respuestas a las siguientes preguntas:". "Answer the following questions"
// kept as a defensive extra variant.
const QUESTIONS_RE = /^(Beantworte die folgenden Fragen|Find answers to these questions|Answer the following questions|Soyez attentifs aux réponses à ces questions|Rispondete a queste domande|Esteja atento às respostas para as seguintes perguntas|Узнайте ответы на эти вопросы|Anota las respuestas a las siguientes preguntas)/iu;

export class JwpubParser {

	/**
	 * @param sqlWasmBinary The sql.js WASM binary. Callers own how it's obtained
	 *   (esbuild's "binary" loader embeds it as base64 in main.js at bundle time;
	 *   Node scripts can read it straight from node_modules) — this class only cares
	 *   that it receives the bytes.
	 */
	constructor(private readonly sqlWasmBinary: Uint8Array) {}

	// Language of the file currently being parsed, set at the start of
	// buildCongress() from the publication's MepsLanguageIndex — see
	// MEPS_LANGUAGE_INDEX below for the confirmed mapping. Anything unknown
	// falls back to German — the plugin's primary audience — with the
	// language-tolerant regexes above still giving such files a fighting
	// chance structurally.
	private lang: CongressLang = 'de';

	private get t(): NoteStrings {
		return NL[this.lang];
	}

	async parse(fileBuffer: Uint8Array): Promise<Congress> {
		assertPlatformSupport();
		const { db, innerZip } = await openJwpubDatabase(fileBuffer, this.sqlWasmBinary);
		const pub = readPublication(db);
		const keyIv = await deriveKey(pub);
		const docs = this.readDocuments(db);
		const meta = this.readMetadata(db);

		const congress = await this.buildCongress(docs, meta, keyIv, pub, db, innerZip);
		db.close();
		return congress;
	}

	// ──────────────────────────────────────────────────────────────────────────
	// DB access
	// ──────────────────────────────────────────────────────────────────────────

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
	// Congress assembly
	// ──────────────────────────────────────────────────────────────────────────

	private async buildCongress(
		docs: DbRow[],
		meta: Map<number, Map<string, string>>,
		keyIv: { key: Uint8Array; iv: Uint8Array },
		pub: DbRow,
		db: Database,
		innerZip: Unzipped,
	): Promise<Congress> {
		const symbol = String(pub['Symbol']);
		const year   = Number(pub['Year']);
		const type   = this.detectType(symbol);
		// sql.js may return numeric columns as strings — always cast (same caveat
		// as IssueTagNumber in deriveKey()).
		this.lang = MEPS_LANGUAGE_INDEX[Number(pub['MepsLanguageIndex'])] ?? 'de';

		// Theme: for CO the cover doc title is the theme ("Ewiges Glück").
		// For CA the cover doc title is the publication name; the actual congress
		// motto is the title of document 1 (the program document).
		const coverMeta  = meta.get(0);
		const rawTheme   = coverMeta?.get('MEPS:Title') ?? '';
		const isCA       = type === 'CA-copgm' || type === 'CA-brpgm';
		const theme      = isCA ? (meta.get(1)?.get('MEPS:Title') ?? rawTheme) : rawTheme;

		const days: Day[] = [];
		let themeScripture: Scripture | undefined;
		// CA congresses only have a title image on the cover document (DocumentId 0),
		// not on the single day's own document — used as a fallback for days that
		// don't have their own image (see below).
		let congressCoverImage: CoverImage | undefined;

		for (const doc of docs) {
			const docId = Number(doc['DocumentId']);
			const raw   = doc['Content'] as Uint8Array;

			let html: string;
			try {
				html = await decryptBlob(raw, keyIv.key, keyIv.iv);
			} catch {
				continue;
			}

			const dom = new DOMParser().parseFromString(html, 'text/html');

			// Cover document: extract theme scripture + congress-level cover image
			if (docId === 0) {
				themeScripture = this.extractThemeScripture(dom);
				congressCoverImage = this.extractCoverImage(db, innerZip, docId);
				continue;
			}

			// Standalone "Beantworte die folgenden Fragen" document — attach to the
			// day it belongs to (the most recently parsed one) as its own session.
			const questionsItem = this.extractQuestionsDocument(dom);
			if (questionsItem) {
				const targetDay = days[days.length - 1];
				if (targetDay) {
					targetDay.sessions.push({ name: this.t.reviewQuestionsSession, items: [questionsItem] });
				}
				continue;
			}

			// Skip other info pages (no <h2>Vormittag/Nachmittag)
			const dayName = this.extractDayName(dom);
			if (!dayName) continue;

			const day = this.parseDay(dom, dayName);
			if (day.sessions.some(s => s.items.length > 0)) {
				day.coverImage = this.extractCoverImage(db, innerZip, docId) ?? congressCoverImage;
				days.push(day);
			}
		}

		// Keep the review-questions session last on its day, regardless of the
		// order in which its source document appeared in the jwpub file.
		const questionsSession = this.t.reviewQuestionsSession;
		for (const day of days) {
			day.sessions.sort((a, b) =>
				(a.name === questionsSession ? 1 : 0) - (b.name === questionsSession ? 1 : 0),
			);
		}

		// CO: sort Friday → Saturday → Sunday
		days.sort((a, b) => this.dayOrder(a.weekday) - this.dayOrder(b.weekday));

		return { type, theme, themeScripture, year, days, lang: this.lang };
	}

	// ──────────────────────────────────────────────────────────────────────────
	// HTML parsing
	// ──────────────────────────────────────────────────────────────────────────

	/**
	 * Extracts a day's own motto quote + scripture, e.g. „Geben macht glücklicher
	 * als Empfangen“ (Apostelgeschichte 20:35) — sits in the <p> right after
	 * </header> (title image + weekday), before .bodyTxt. Some congress types
	 * (CA) only cite the scripture there, since the quote is already the page's
	 * own <h1> — detected by the paragraph having no text beyond the link itself.
	 */
	private extractDayTheme(dom: Document): { theme?: string; themeScripture?: Scripture } {
		const header = dom.querySelector('header');
		const p = header?.nextElementSibling;
		if (!p || p.tagName !== 'P') return {};

		const link = p.querySelector('a[href^="jwpub://b/NWTR/"]');
		const themeScripture = link ? this.hrefToScripture(link.getAttribute('href') ?? '') : undefined;

		const linkText = link?.textContent?.trim() ?? '';
		const fullText = (p.textContent ?? '').trim();
		if (!fullText || fullText === linkText) return { themeScripture };

		const theme = this.stripScriptureCitation(fullText) || undefined;
		return { theme, themeScripture };
	}

	private extractThemeScripture(dom: Document): Scripture | undefined {
		// CA: <p class="themeScrp"><a href="jwpub://b/NWTR/...">
		const a = dom.querySelector('p.themeScrp a[href]');
		if (a) return this.hrefToScripture(a.getAttribute('href') ?? '');

		// CO cover doc: first <a href="jwpub://b/NWTR/..."> anywhere
		const firstRef = dom.querySelector('a[href^="jwpub://b/NWTR/"]');
		if (firstRef) return this.hrefToScripture(firstRef.getAttribute('href') ?? '');

		return undefined;
	}

	/**
	 * Looks up the document's title image via the DocumentMultimedia/Multimedia
	 * tables (CategoryType 8 = the "cnt_1" banner variant embedded at the top of
	 * the document, as opposed to CategoryType 9, a square thumbnail used elsewhere)
	 * and reads the actual image bytes from the inner zip.
	 */
	private extractCoverImage(db: Database, innerZip: Unzipped, docId: number): CoverImage | undefined {
		const res = db.exec(
			`SELECT m.FilePath AS FilePath, m.MimeType AS MimeType
			 FROM DocumentMultimedia dm
			 JOIN Multimedia m ON m.MultimediaId = dm.MultimediaId
			 WHERE dm.DocumentId = ${docId} AND m.CategoryType = 8
			 LIMIT 1`,
		);
		const cols = res[0]?.columns;
		const vals = res[0]?.values[0];
		if (!cols || !vals) return undefined;

		const row      = Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
		const filePath = String(row['FilePath'] ?? '');
		if (!filePath) return undefined;

		const entry = innerZip[filePath];
		if (!entry) return undefined;

		return {
			data: entry,
			filename: filePath,
			mimeType: String(row['MimeType'] ?? 'image/jpeg'),
		};
	}

	private extractDayName(dom: Document): string | null {
		const h1 = dom.querySelector('h1');
		if (!h1) return null;
		const text = h1.textContent?.trim() ?? '';

		// CO: explicit weekday in h1, verbatim per language (German, English,
		// French, Italian, Portuguese, Russian, Spanish programme files).
		const match = /\b(Freitag|Samstag|Sonntag|Friday|Saturday|Sunday|Vendredi|Samedi|Dimanche|Venerdì|Sabato|Domenica|Sexta-feira|Sábado|Domingo|Пятница|Суббота|Воскресенье|Viernes)\b/iu.exec(text);
		if (match) return match[1] ?? null;

		// CA: one-day congress — h1 has theme, not weekday.
		// Detect by presence of session structure (h2 inside bodyTxt).
		const hasSession = dom.querySelector('.bodyTxt h2') !== null;
		if (hasSession) return this.t.caFallbackDay;

		return null;
	}

	private parseDay(dom: Document, dayName: string): Day {
		const bodyTxt = dom.querySelector('.bodyTxt');
		const sessions: Session[] = [];
		const { theme, themeScripture } = this.extractDayTheme(dom);

		if (!bodyTxt) return { name: dayName, weekday: dayName, theme, themeScripture, sessions };

		// Split by <h2> session headers (their text — "Vormittag"/"Morning"/… —
		// is taken over verbatim, so session names follow the file's language
		// automatically; the default below is only a fallback for items that
		// unexpectedly appear before the first <h2>).
		const children = Array.from(bodyTxt.children);
		let currentSessionName = this.t.defaultSession;
		let currentItems: ProgramItem[] = [];

		for (const child of children) {
			if (child.tagName === 'H2') {
				if (currentItems.length > 0) {
					sessions.push({ name: currentSessionName, items: currentItems });
					currentItems = [];
				}
				currentSessionName = child.textContent?.trim() ?? this.t.defaultSession;
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

		return { name: dayName, weekday: dayName, theme, themeScripture, sessions };
	}

	private parseLi(li: HTMLElement): ProgramItem | null {
		const firstP = li.querySelector('p');
		if (!firstP) return null;

		const firstText = firstP.textContent ?? '';

		// Extract time
		const timeMatch = TIME_RE.exec(firstText);
		if (!timeMatch) return null;
		const time = `${timeMatch[1]}:${timeMatch[2]}`;
		const textAfterTime = firstText.replace(TIME_RE, '').trim();

		// "Musikvideo" / "Pause" lines — shown in the overview like a song (no
		// dedicated note), since they're programme markers rather than talks.
		if (MUSIC_VIDEO_RE.test(textAfterTime) || PAUSE_RE.test(textAfterTime)) {
			return { time, itemType: 'aside', title: textAfterTime, scriptures: [], bulletPoints: [] };
		}

		// Song reference (has a jwpub://p/ link but no bible ref) — captured as its
		// own item so it can be listed & linked in the day overview, but doesn't get
		// its own note. Uses the full paragraph text (not just the link text) so any
		// adjoining remark in the same line — e.g. "Lied 43 und Gebet" / "Song
		// No. 14 and Intermission" — is kept.
		const songLink     = li.querySelector(SONG_HREF_SELECTOR);
		const hasBibleLink = li.querySelector('a[href^="jwpub://b/NWTR/"]') !== null;
		if (songLink && !hasBibleLink) {
			return this.parseSongLine(time, textAfterTime, songLink);
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
		if (QUESTIONS_RE.test(textAfterTime)) {
			return this.parseQuestionsBlock(li, time);
		}

		// Regular item
		const title = this.extractTitle(firstP, time, hasTypeMarker);
		if (!title) return null;

		const scriptures = this.extractScriptures(li);
		return { time, itemType, title, scriptures, bulletPoints: [] };
	}

	private parseSongLine(time: string, fullText: string, songLink: Element): ProgramItem | null {
		const linkText = songLink.textContent?.trim() ?? '';
		const numMatch = /(\d+)/.exec(linkText);
		if (!numMatch) return null;
		const songNumber = Number(numMatch[1]);
		const docidMatch = SONG_DOCID_HREF_RE.exec(songLink.getAttribute('href') ?? '');
		const songDocid = docidMatch?.[1] ? Number(docidMatch[1]) : undefined;
		return {
			time,
			itemType: 'song',
			title: fullText || linkText || this.t.song(songNumber),
			scriptures: [],
			bulletPoints: [],
			songNumber,
			songDocid,
		};
	}

	private parseBibleDrama(li: HTMLElement, time: string, itemType: ItemType): ProgramItem | null {
		const paragraphs = Array.from(li.querySelectorAll('p'));
		// P0: "10:10 BIBELDRAMA:"  (skip)
		// P1: series title (bold+italic)
		// P2: episode subtitle + refs (italic)
		const seriesTitle = paragraphs[1]?.textContent?.trim() ?? '';
		const episodeText = this.stripScriptureCitation(paragraphs[2]?.textContent?.trim() ?? '');
		const title    = seriesTitle || this.t.bibleDramaFallback;
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
			title: this.t.questionsTitle,
			scriptures: [],
			bulletPoints: [],
			parts,
		};
	}

	/** Standalone review-questions document ("Beantworte die folgenden Fragen:" /
	 *  "Find Answers to These Questions:"). */
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
			title: this.t.questionsTitle,
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

		// Real-world markers, confirmed against each language's real CO/CA
		// programme files (CA files use mixed case, hence the upper-casing
		// above) — German: "BIBELDRAMA:", "VORTRAGSREIHE:", "TAUFE:", "VORTRAG
		// DES VORSITZENDEN:", "ÖFFENTLICHER VORTRAG:"; English: "FEATURE BIBLE
		// DRAMA:", "SYMPOSIUM:", "BAPTISM:", "CHAIRMAN’S ADDRESS:", "PUBLIC
		// BIBLE DISCOURSE:"; French: "FILM :", "EXPOSÉ EN … PARTIES :" (same
		// term in CO and CA), "DISCOURS DE BAPTÊME :", "DISCOURS …:"; Italian:
		// "VIDEORACCONTO:", "SIMPOSIO:" (CO) / "SERIE DI DISCORSI:" (CA — a
		// genuinely different term, unlike every other language here),
		// "BATTESIMO:", "DISCORSO …:"; Portuguese: "VÍDEO:", "SIMPÓSIO:",
		// "BATISMO:", "DISCURSO …:"; Russian: "ВИДЕОПОСТАНОВКА:", "СЕРИЯ
		// РЕЧЕЙ:", "РЕЧЬ О КРЕЩЕНИИ:", "…РЕЧЬ:" (baptism checked first so its
		// own "РЕЧЬ" doesn't fall through to the generic talk match below);
		// Spanish: "PRODUCCIÓN AUDIOVISUAL:", "SERIE DE DISCURSOS:", "DISCURSO
		// DE BAUTISMO:", "DISCURSO …:".
		if (/BIBELDRAMA|BIBLE\s*DRAMA|\bFILM\b|VIDEORACCONTO|\bVÍDEO\b|ВИДЕОПОСТАНОВКА|PRODUCCIÓN AUDIOVISUAL/u.test(marker)) return ['bible-drama', true];
		if (/VORTRAGSREIHE|SYMPOSIUM|EXPOSÉ.*PARTIES|SIMPOSIO|SERIE DI DISCORSI|SIMPÓSIO|СЕРИЯ РЕЧЕЙ|SERIE DE DISCURSOS/u.test(marker)) return ['talk-series', true];
		if (/TAUFE|BAPTISM|BAPTÊME|BATTESIMO|BATISMO|КРЕЩЕНИИ|BAUTISMO/u.test(marker)) return ['baptism', true];
		if (/INTERVIEW/.test(marker))                      return ['interview', true];
		if (/VORTRAG|TALK|REDE|CHAIRMAN|ADDRESS|DISCOURSE|DISCOURS|DISCORSO|DISCURSO|РЕЧЬ/u.test(marker)) return ['talk', true];

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
		const order: Record<string, number> = {
			Freitag: 0, Samstag: 1, Sonntag: 2,
			Friday: 0, Saturday: 1, Sunday: 2,
			Vendredi: 0, Samedi: 1, Dimanche: 2,
			Venerdì: 0, Sabato: 1, Domenica: 2,
			'Sexta-feira': 0, Sábado: 1, Domingo: 2,
			Пятница: 0, Суббота: 1, Воскресенье: 2,
			Viernes: 0,
		};
		return order[weekday] ?? 99;
	}
}
