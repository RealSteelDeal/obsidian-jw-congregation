import AdmZip from 'adm-zip';
import { Congress, CongressType, Day, ItemType, ProgramItem, Scripture, Session } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';

// RTF HYPERLINK field: field text contains the URL between quotes
const HYPERLINK_RE = /HYPERLINK\s+"([^"]+)"/g;
// Unicode escape in RTF: \uNNNN (followed by replacement char)
const UNICODE_RE = /\\u(\d+)\??/g;
// Bible finder URL pattern: bible=BBCCCVVV[-BBCCCVVV]
const BIBLE_CODE_RE = /bible=([\d]+-?[\d]*)/i;

const WEEKDAY_PATTERN = /\b(Freitag|Samstag|Sonntag)\b/i;
// Time pattern
const TIME_RE = /\b(\d{1,2}:\d{2})\b/;
// Lines that are only cover/info pages (skip them)
const SKIP_SECTION_RE = /\b(Informationen|Deckblatt|Programm\b)/i;

export class RtfParser {

	async parse(fileBuffer: Buffer): Promise<Congress> {
		const zip = new AdmZip(fileBuffer);
		const rtfEntries = zip.getEntries()
			.filter(e => e.entryName.toLowerCase().endsWith('.rtf'));

		if (rtfEntries.length === 0) throw new Error('RTF-ZIP: keine .rtf-Dateien gefunden');

		const days: Day[] = [];
		let theme = '';

		for (const entry of rtfEntries) {
			const raw = entry.getData().toString('latin1'); // RTF is latin-1 encoded
			const text = this.decodeRtf(raw);

			if (SKIP_SECTION_RE.test(text.slice(0, 300))) continue;

			const weekdayMatch = WEEKDAY_PATTERN.exec(text);
			if (!weekdayMatch) continue;

			const weekday = weekdayMatch[1] ?? '';
			const items = this.extractItems(raw, text);
			if (items.length === 0) continue;

			const sessions = this.splitIntoSessions(items);
			days.push({ name: weekday, weekday, sessions });

			if (!theme) theme = this.extractTheme(text);
		}

		// Sort days canonically: Freitag → Samstag → Sonntag
		days.sort((a, b) => this.dayOrder(a.weekday) - this.dayOrder(b.weekday));

		const type = this.detectType(days);
		const year = new Date().getFullYear(); // RTF has no year metadata; use current

		return { type, theme, year, days };
	}

	private decodeRtf(rtf: string): string {
		// Strip RTF control words, decode unicode escapes, collapse whitespace
		return rtf
			.replace(UNICODE_RE, (_, code) => String.fromCharCode(Number(code)))
			.replace(/\\[a-z]+\d*\s?/gi, ' ')
			.replace(/[{}]/g, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	private extractItems(rawRtf: string, decodedText: string): ProgramItem[] {
		const items: ProgramItem[] = [];

		// Collect all hyperlinks from raw RTF for scripture/song references
		const hyperlinks = this.collectHyperlinks(rawRtf);

		// Split decoded text into lines and process time-keyed paragraphs
		const lines = decodedText.split(/[\r\n]+/);
		let i = 0;
		while (i < lines.length) {
			const line = lines[i]?.trim() ?? '';
			const timeMatch = TIME_RE.exec(line);
			if (!timeMatch) { i++; continue; }

			const time = timeMatch[1] ?? '';
			// Skip songs and pauses
			if (/\b(Lied|Pause)\b/i.test(line)) { i++; continue; }

			const title = this.cleanTitle(line, time);
			if (!title) { i++; continue; }

			const itemType = this.detectItemType(line);
			const scriptures = this.matchScriptures(hyperlinks, line);
			const bulletPoints = this.collectBullets(lines, i + 1);

			const item: ProgramItem = { time, itemType, title, scriptures, bulletPoints };
			items.push(item);
			i++;
		}
		return items;
	}

	private collectHyperlinks(rawRtf: string): string[] {
		const links: string[] = [];
		for (const m of rawRtf.matchAll(HYPERLINK_RE)) {
			if (m[1]) links.push(m[1]);
		}
		return links;
	}

	private matchScriptures(links: string[], line: string): Scripture[] {
		// Only link scriptures that appear near the current line (heuristic: use all from block)
		const scriptures: Scripture[] = [];
		for (const url of links) {
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

	private collectBullets(lines: string[], startIndex: number): string[] {
		const bullets: string[] = [];
		for (let j = startIndex; j < Math.min(startIndex + 10, lines.length); j++) {
			const l = lines[j]?.trim() ?? '';
			if (TIME_RE.test(l)) break; // next program item starts
			if (l.startsWith('•') || l.startsWith('-') || l.match(/^\d+\./)) {
				bullets.push(l.replace(/^[•\-\d.]\s*/, ''));
			}
		}
		return bullets;
	}

	private cleanTitle(line: string, time: string): string {
		return line
			.replace(time, '')
			.replace(/^\s*[-–—·]\s*/, '')
			.trim()
			.split(/[.!?]/)[0]?.trim() ?? '';
	}

	private extractTheme(text: string): string {
		// Theme is typically the first substantial non-time line
		const lines = text.split(/\s{3,}/);
		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed.length > 10 && !TIME_RE.test(trimmed) && !WEEKDAY_PATTERN.test(trimmed)) {
				return trimmed.substring(0, 120);
			}
		}
		return '';
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
