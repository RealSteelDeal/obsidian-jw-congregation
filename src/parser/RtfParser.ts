import { unzipSync } from 'fflate';
import { Congress, CongressType, Day, ItemType, ProgramItem, Scripture, Session } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';
import { latin1Decode } from '../util/bytes';

// RTF HYPERLINK field: field text contains the URL between quotes
const HYPERLINK_RE = /HYPERLINK\s+"([^"]+)"/g;
// Bible finder URL pattern: bible=BBCCCVVV[-BBCCCVVV]
const BIBLE_CODE_RE = /bible=([\d]+-?[\d]*)/i;
// RTF paragraph/line/page breaks — the only control words that carry structural
// meaning for us. Everything else is decorative and gets discarded below.
const BREAK_RE = /\\(?:par|line|page)\b\s?/gi;

const WEEKDAY_PATTERN = /\b(Freitag|Samstag|Sonntag)\b/i;
const WEEKDAY_ONLY_RE = /^(Freitag|Samstag|Sonntag)$/i;
// German congress exports write "9 Uhr 20" rather than "9:20"; the minute is
// omitted entirely on the hour ("11 Uhr" == 11:00).
const TIME_RE = /\b(\d{1,2})\s+Uhr(?:\s+(\d{1,2}))?\b/;
// A trailing scripture citation in the decoded visible text reads e.g.
// "(Matthäus 5 Vers 3 bis 7 Vers 29; Lukas 6 Vers 17 bis 49)" — "Vers" is a
// reliable anchor since every citation in this export format includes it,
// unlike jwpub's colon-based "5:3" which doesn't appear here at all.
const CITATION_RE = /\s*\([^()]*\bVers\b[^()]*\)\s*$/i;
// Strips a leading "TYPE: " marker so the remaining text matches the clean
// title jwpub would produce (which strips the equivalent <strong>TYPE:</strong>).
const TYPE_PREFIX_RE = /^(?:Vortragsreihe|Symposium|Bibeldrama|Taufe|Interview|(?:Öffentlicher\s+)?Vortrag(?:\s+des\s+Vorsitzenden)?)\s*:\s*/i;
const SONG_RE = /^Lied\s*(\d+)/i;
const ASIDE_RE = /^(?:Musik(?:video)?|Pause\b.*)$/i;
const BIBLE_DRAMA_MARKER_RE = /^Bibeldrama\s*:?$/i;
const SERIES_MARKER_RE = /^(?:Vortragsreihe|Symposium)\s*:\s*(.+)$/i;
const SERIES_TITLE_EPISODE_RE = /^(.*?):\s*(Folge\s*\d+)$/i;
const BULLET_RE = /^(?:[•-]|\d+\.)\s*(.+)$/;
const CONGRESS_THEME_YEAR_RE = /^(.+?)\s+Kongress von Jehovas Zeugen\s+(\d{4})\b/i;

// RTF destination groups whose contents must never surface as visible text:
// font/color/style tables, document metadata, and a hyperlink field's
// invisible \fldinst half (the visible half is \fldrslt, not listed here).
const IGNORABLE_DESTINATIONS = new Set([
	'fonttbl', 'colortbl', 'stylesheet', 'info', 'generator', 'fldinst',
	'filetbl', 'themedata', 'colorschememapping', 'listtable', 'listoverridetable',
]);

interface Paragraph {
	/** Decoded, human-readable text of this paragraph. */
	text: string;
	/** Raw (still RTF-encoded) source of this paragraph — used to scope hyperlink lookups. */
	raw: string;
}

export class RtfParser {

	async parse(fileBuffer: Uint8Array): Promise<Congress> {
		const rtfSources = this.collectRtfSources(fileBuffer);
		if (rtfSources.length === 0) throw new Error('RTF-ZIP: keine .rtf-Dateien gefunden');

		const days: Day[] = [];
		let theme = '';
		let year = new Date().getFullYear(); // overwritten below when the cover page's own year is found

		for (const rawRtf of rtfSources) {
			const paragraphs = this.splitParagraphs(rawRtf);
			const wholeText = paragraphs.map(p => p.text).join(' ');

			const weekdayMatch = WEEKDAY_PATTERN.exec(wholeText);
			if (!weekdayMatch) continue;
			const weekday = weekdayMatch[1] ?? '';

			if (!theme) {
				const congressInfo = this.extractCongressThemeYear(paragraphs);
				if (congressInfo) {
					theme = congressInfo.theme;
					year = congressInfo.year;
				} else {
					theme = this.extractTheme(paragraphs);
				}
			}

			const items = this.extractItems(paragraphs);
			if (items.length === 0) continue;

			const sessions = this.splitIntoSessions(items);
			const { theme: dayTheme, themeScripture } = this.extractDayTheme(paragraphs);
			days.push({ name: weekday, weekday, theme: dayTheme, themeScripture, sessions });
		}

		// Sort days canonically: Freitag → Samstag → Sonntag
		days.sort((a, b) => this.dayOrder(a.weekday) - this.dayOrder(b.weekday));

		const type = this.detectType(days);

		return { type, theme, year, days };
	}

	/** Accepts either a single raw .rtf file or a .zip containing one or more .rtf files. */
	private collectRtfSources(fileBuffer: Uint8Array): string[] {
		if (this.isRawRtf(fileBuffer)) {
			return [latin1Decode(fileBuffer)];
		}

		const zip = unzipSync(fileBuffer);
		return Object.keys(zip)
			.filter(name => name.toLowerCase().endsWith('.rtf'))
			.map(name => latin1Decode(zip[name]!)); // RTF is latin-1 encoded
	}

	private isRawRtf(buf: Uint8Array): boolean {
		return latin1Decode(buf.subarray(0, 5)) === '{\\rtf';
	}

	/**
	 * Minimal brace-aware RTF-to-plain-text conversion. Unlike a flat
	 * "strip control words, drop braces" regex pass, this tracks group
	 * nesting so ignorable destination groups (marked with \* or a name in
	 * IGNORABLE_DESTINATIONS) never leak their contents into the output —
	 * which a flat regex pass can't distinguish from real body text.
	 */
	private rtfToText(rtf: string): string {
		let out = '';
		// One skip-flag per open brace depth; children inherit the parent's flag.
		const skipStack: boolean[] = [false];
		const len = rtf.length;
		let i = 0;
		let ucSkip = 1; // \ucN: number of fallback chars following each \u escape

		const isAlpha = (ch: string) => (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
		const isDigit = (ch: string) => ch >= '0' && ch <= '9';

		while (i < len) {
			const ch = rtf[i];
			const skipped = skipStack[skipStack.length - 1];

			if (ch === '{') {
				skipStack.push(skipped ?? false);
				i++;
				continue;
			}
			if (ch === '}') {
				if (skipStack.length > 1) skipStack.pop();
				i++;
				continue;
			}

			if (ch === '\\') {
				const next = rtf[i + 1];
				if (next === undefined) { i++; continue; }

				if (!isAlpha(next)) {
					// Control symbol: \{, \}, \\, \~, \_, \-, \*, \'xx, ...
					if (next === "'") {
						const hex = rtf.slice(i + 2, i + 4);
						i += 4;
						if (!skipped && /^[0-9a-f]{2}$/i.test(hex)) out += String.fromCharCode(parseInt(hex, 16));
						continue;
					}
					i += 2;
					if (next === '*') { skipStack[skipStack.length - 1] = true; continue; }
					if (skipped) continue;
					if (next === '{' || next === '}' || next === '\\') { out += next; continue; }
					if (next === '~') { out += ' '; continue; }
					continue;
				}

				// Control word: letters, optional signed numeric parameter, one optional
				// space delimiter (which is consumed as syntax, not printed).
				let j = i + 1;
				let word = '';
				while (j < len && isAlpha(rtf[j] ?? '')) { word += rtf[j]; j++; }
				let param = '';
				if (rtf[j] === '-') { param += '-'; j++; }
				while (j < len && isDigit(rtf[j] ?? '')) { param += rtf[j]; j++; }
				if (rtf[j] === ' ') j++;

				if (word === 'par' || word === 'line' || word === 'page' || word === 'tab') {
					i = j;
					if (!skipped) out += ' ';
					continue;
				}
				if (word === 'uc') {
					ucSkip = param ? Number(param) : 1;
					i = j;
					continue;
				}
				if (word === 'u') {
					i = j;
					if (!skipped && param !== '') {
						let code = Number(param);
						if (code < 0) code += 65536;
						out += String.fromCharCode(code);
					}
					// Skip the fallback "alternative representation" character(s) that
					// follow \uN per \ucN (our sources always use a single literal "?").
					for (let k = 0; k < ucSkip && rtf[i] === '?'; k++) i++;
					continue;
				}
				if (IGNORABLE_DESTINATIONS.has(word)) {
					skipStack[skipStack.length - 1] = true;
				}
				i = j;
				continue;
			}

			// Plain character
			i++;
			if (!skipped) out += ch;
		}

		return out.replace(/\s+/g, ' ').trim();
	}

	/**
	 * Splits the raw RTF into paragraphs on \par/\line/\page and decodes each one
	 * independently, keeping the raw source alongside so hyperlinks can be looked up
	 * per paragraph instead of across the whole document.
	 */
	private splitParagraphs(rawRtf: string): Paragraph[] {
		return rawRtf
			.split(BREAK_RE)
			.map(raw => ({ raw, text: this.rtfToText(raw) }))
			.filter(p => p.text.length > 0);
	}

	private matchTime(text: string): { time: string; raw: string } | null {
		const m = TIME_RE.exec(text);
		if (!m || !m[1]) return null;
		const minute = (m[2] ?? '0').padStart(2, '0');
		return { time: `${m[1]}:${minute}`, raw: m[0] };
	}

	private stripRtfCitation(text: string): string {
		return text.replace(CITATION_RE, '').trim();
	}

	private extractItems(paragraphs: Paragraph[]): ProgramItem[] {
		const items: ProgramItem[] = [];
		let i = 0;

		while (i < paragraphs.length) {
			const paragraph = paragraphs[i];
			if (!paragraph) { i++; continue; }

			const timeMatch = this.matchTime(paragraph.text);
			if (!timeMatch) { i++; continue; }

			const afterTime = paragraph.text.replace(timeMatch.raw, '').trim();

			const songMatch = SONG_RE.exec(afterTime);
			if (songMatch && songMatch[1]) {
				items.push({
					time: timeMatch.time, itemType: 'song', title: afterTime,
					scriptures: [], bulletPoints: [], songNumber: Number(songMatch[1]),
				});
				i++;
				continue;
			}

			if (ASIDE_RE.test(afterTime)) {
				items.push({ time: timeMatch.time, itemType: 'aside', title: afterTime, scriptures: [], bulletPoints: [] });
				i++;
				continue;
			}

			if (BIBLE_DRAMA_MARKER_RE.test(afterTime)) {
				const drama = this.extractBibleDrama(paragraphs, i, timeMatch.time);
				if (drama) { items.push(drama.item); i = drama.nextIndex; continue; }
				i++;
				continue;
			}

			const seriesMatch = SERIES_MARKER_RE.exec(afterTime);
			if (seriesMatch) {
				const title = seriesMatch[1]?.trim() ?? afterTime;
				const { parts, nextIndex } = this.extractSeriesParts(paragraphs, i + 1);
				items.push({ time: timeMatch.time, itemType: 'talk-series', title, scriptures: [], bulletPoints: [], parts });
				i = nextIndex;
				continue;
			}

			const title = this.cleanTitle(afterTime);
			if (!title) { i++; continue; }
			const itemType = this.detectItemType(paragraph.text);
			const scriptures = this.matchScriptures(paragraph.raw);
			items.push({ time: timeMatch.time, itemType, title, scriptures, bulletPoints: [] });
			i++;
		}
		return items;
	}

	/** Bibeldrama spans 3 paragraphs: the "Bibeldrama:" marker (with time), the
	 *  series title (as "Series: Folge N"), and the episode quote + citation. */
	private extractBibleDrama(
		paragraphs: Paragraph[], index: number, time: string,
	): { item: ProgramItem; nextIndex: number } | null {
		const seriesPara = paragraphs[index + 1];
		const episodePara = paragraphs[index + 2];
		if (!seriesPara || !episodePara) return null;

		const seriesRaw = seriesPara.text.trim();
		const episodeMatch = SERIES_TITLE_EPISODE_RE.exec(seriesRaw);
		const title = (episodeMatch?.[1] ?? seriesRaw).trim() || 'Bibeldrama';
		const folgeLabel = episodeMatch?.[2]?.trim();

		const quote = this.stripRtfCitation(episodePara.text);
		const subtitle = folgeLabel ? `${folgeLabel}: ${quote}`.trim() : (quote || undefined);
		const scriptures = this.matchScriptures(episodePara.raw);

		return {
			item: { time, itemType: 'bible-drama', title, subtitle, scriptures, bulletPoints: [] },
			nextIndex: index + 3,
		};
	}

	/** Vortragsreihe/Symposium bullet points, each becoming its own titled + linked part. */
	private extractSeriesParts(paragraphs: Paragraph[], startIndex: number): { parts: ProgramItem[]; nextIndex: number } {
		const parts: ProgramItem[] = [];
		let j = startIndex;

		while (j < paragraphs.length) {
			const p = paragraphs[j];
			if (!p) break;
			if (this.matchTime(p.text)) break; // next timed item begins

			const bulletMatch = BULLET_RE.exec(p.text);
			if (!bulletMatch) { j++; continue; }

			const title = this.stripRtfCitation(bulletMatch[1] ?? '').trim();
			if (title) {
				const scriptures = this.matchScriptures(p.raw);
				parts.push({ time: '', itemType: 'talk', title, scriptures, bulletPoints: [] });
			}
			j++;
		}
		return { parts, nextIndex: j };
	}

	/**
	 * Mirrors JwpubParser.extractDayTheme(): the day's motto quote + scripture
	 * sits in the paragraph right after the standalone weekday-title paragraph
	 * (e.g. "Freitag"), e.g. „Geben macht glücklicher als Empfangen“ (Apostel­geschichte
	 * 20 Vers 35). Requires a scripture link to be present, same as the jwpub
	 * path, so an unrelated paragraph is never mistaken for the motto.
	 */
	private extractDayTheme(paragraphs: Paragraph[]): { theme?: string; themeScripture?: Scripture } {
		const weekdayIndex = paragraphs.findIndex(p => WEEKDAY_ONLY_RE.test(p.text.trim()));
		if (weekdayIndex === -1) return {};

		const next = paragraphs[weekdayIndex + 1];
		if (!next) return {};

		const scriptures = this.matchScriptures(next.raw);
		if (scriptures.length === 0) return {};

		const theme = this.stripRtfCitation(next.text) || undefined;
		return { theme, themeScripture: scriptures[0] };
	}

	/** Congress-level theme + year, e.g. "Ewiges Glück Kongress von Jehovas Zeugen 2026". */
	private extractCongressThemeYear(paragraphs: Paragraph[]): { theme: string; year: number } | null {
		for (const p of paragraphs) {
			const m = CONGRESS_THEME_YEAR_RE.exec(p.text.trim());
			if (m && m[1] && m[2]) return { theme: m[1].trim(), year: Number(m[2]) };
		}
		return null;
	}

	/** Best-effort congress theme fallback for sources where extractCongressThemeYear finds nothing. */
	private extractTheme(paragraphs: Paragraph[]): string {
		for (const p of paragraphs) {
			const trimmed = p.text.trim();
			if (trimmed.length > 10 && !this.matchTime(trimmed) && !WEEKDAY_PATTERN.test(trimmed)) {
				return this.stripRtfCitation(trimmed).substring(0, 120);
			}
		}
		return '';
	}

	/**
	 * A single citation's display text is often split across several bold/plain
	 * formatting runs (e.g. "Matthäus " / "5 Vers 1" / ",2"), each wrapped in its
	 * own {\field...} — all pointing at the *same* HYPERLINK url. Deduping by url
	 * collapses those back into one reference instead of counting it several times.
	 */
	private matchScriptures(rawParagraph: string): Scripture[] {
		const scriptures: Scripture[] = [];
		const seenUrls = new Set<string>();
		for (const m of rawParagraph.matchAll(HYPERLINK_RE)) {
			const url = m[1];
			if (!url || seenUrls.has(url)) continue;
			seenUrls.add(url);
			const bibleMatch = BIBLE_CODE_RE.exec(url);
			if (!bibleMatch || !bibleMatch[1]) continue;
			try {
				scriptures.push(ScriptureNormalizer.fromRtf(bibleMatch[1]));
			} catch {
				// ignore malformed
			}
		}
		return scriptures;
	}

	private cleanTitle(afterTime: string): string {
		let cleaned = afterTime.replace(/^\s*[-–—·]\s*/, '');
		cleaned = cleaned.replace(TYPE_PREFIX_RE, '');
		cleaned = this.stripRtfCitation(cleaned);
		return cleaned.trim();
	}

	private detectItemType(text: string): ItemType {
		if (/Vortragsreihe|Symposium/i.test(text)) return 'talk-series';
		if (/Bibeldrama/i.test(text)) return 'bible-drama';
		if (/Taufe/i.test(text)) return 'baptism';
		if (/Interview/i.test(text)) return 'interview';
		if (/Vortrag/i.test(text)) return 'talk';
		return 'other';
	}

	private splitIntoSessions(items: ProgramItem[]): Session[] {
		const morning: ProgramItem[] = [];
		const afternoon: ProgramItem[] = [];
		let isAfternoon = false;
		for (const item of items) {
			const hour = parseInt(item.time.split(':')[0] ?? '0', 10);
			if (!isAfternoon && hour >= 13) isAfternoon = true;
			(isAfternoon ? afternoon : morning).push(item);
		}
		const sessions: Session[] = [];
		if (morning.length > 0) sessions.push({ name: 'Vormittag', items: morning });
		if (afternoon.length > 0) sessions.push({ name: 'Nachmittag', items: afternoon });
		return sessions;
	}

	private detectType(days: Day[]): CongressType {
		return days.length > 1 ? 'CO' : 'CA-copgm';
	}

	private dayOrder(weekday: string): number {
		const order: Record<string, number> = { Freitag: 0, Samstag: 1, Sonntag: 2 };
		return order[weekday] ?? 99;
	}
}
