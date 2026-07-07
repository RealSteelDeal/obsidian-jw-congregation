import AdmZip from 'adm-zip';
import { Congress, CongressType, Day, ItemType, ProgramItem, Scripture, Session } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';

// RTF HYPERLINK field: field text contains the URL between quotes
const HYPERLINK_RE = /HYPERLINK\s+"([^"]+)"/g;
// Unicode escape in RTF: \uNNNN (followed by replacement char)
const UNICODE_RE = /\\u(\d+)\??/g;
// Bible finder URL pattern: bible=BBCCCVVV[-BBCCCVVV]
const BIBLE_CODE_RE = /bible=([\d]+-?[\d]*)/i;
// RTF paragraph/line/page breaks — the only control words that carry structural
// meaning for us. Everything else is decorative and gets discarded below.
const BREAK_RE = /\\(?:par|line|page)\b\s?/gi;

const WEEKDAY_PATTERN = /\b(Freitag|Samstag|Sonntag)\b/i;
// Time pattern
const TIME_RE = /\b(\d{1,2}:\d{2})\b/;
// Lines that are only cover/info pages (skip them)
const SKIP_SECTION_RE = /\b(Informationen|Deckblatt|Programm\b)/i;

interface Paragraph {
	/** Decoded, human-readable text of this paragraph. */
	text: string;
	/** Raw (still RTF-encoded) source of this paragraph — used to scope hyperlink lookups. */
	raw: string;
}

export class RtfParser {

	async parse(fileBuffer: Buffer): Promise<Congress> {
		const rtfSources = this.collectRtfSources(fileBuffer);
		if (rtfSources.length === 0) throw new Error('RTF-ZIP: keine .rtf-Dateien gefunden');

		const days: Day[] = [];
		let theme = '';

		for (const rawRtf of rtfSources) {
			const wholeText = this.decodeWholeDocument(rawRtf);

			if (SKIP_SECTION_RE.test(wholeText.slice(0, 300))) continue;

			const weekdayMatch = WEEKDAY_PATTERN.exec(wholeText);
			if (!weekdayMatch) continue;

			const weekday = weekdayMatch[1] ?? '';
			const items = this.extractItems(rawRtf);
			if (items.length === 0) continue;

			const sessions = this.splitIntoSessions(items);
			// Deliberately no per-day theme/themeScripture here (unlike JwpubParser's
			// extractDayTheme): RTF gives us flattened whole-document text with no HTML
			// structure to anchor on, so there's no reliable way to tell "the day's
			// motto paragraph" apart from any other line. A regex guess would risk
			// silently grabbing the wrong sentence — worse than not showing it at all.
			// This is the emergency fallback path (jwpub decryption failed); the
			// feature is only worth the risk where the source actually supports it.
			days.push({ name: weekday, weekday, sessions });

			if (!theme) theme = this.extractTheme(wholeText);
		}

		// Sort days canonically: Freitag → Samstag → Sonntag
		days.sort((a, b) => this.dayOrder(a.weekday) - this.dayOrder(b.weekday));

		const type = this.detectType(days);
		const year = new Date().getFullYear(); // RTF has no year metadata; use current

		return { type, theme, year, days };
	}

	/** Accepts either a single raw .rtf file or a .zip containing one or more .rtf files. */
	private collectRtfSources(fileBuffer: Buffer): string[] {
		if (this.isRawRtf(fileBuffer)) {
			return [fileBuffer.toString('latin1')];
		}

		const zip = new AdmZip(fileBuffer);
		return zip.getEntries()
			.filter(e => e.entryName.toLowerCase().endsWith('.rtf'))
			.map(e => e.getData().toString('latin1')); // RTF is latin-1 encoded
	}

	private isRawRtf(buf: Buffer): boolean {
		return buf.subarray(0, 5).toString('latin1') === '{\\rtf';
	}

	/** Whole-document decode (paragraph breaks collapsed) — used for weekday/theme/skip detection only. */
	private decodeWholeDocument(rtf: string): string {
		return rtf
			.replace(UNICODE_RE, (_, code) => String.fromCharCode(Number(code)))
			.replace(/\\[a-z]+-?\d*\s?/gi, ' ')
			.replace(/[{}]/g, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	/** Decodes a single already-isolated paragraph (no BREAK_RE inside, so nothing to collapse). */
	private decodeParagraph(rawParagraph: string): string {
		return rawParagraph
			.replace(UNICODE_RE, (_, code) => String.fromCharCode(Number(code)))
			.replace(/\\[a-z]+-?\d*\s?/gi, ' ')
			.replace(/[{}]/g, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	/**
	 * Splits the raw RTF into paragraphs on \par/\line/\page and decodes each one
	 * independently, keeping the raw source alongside so hyperlinks can be looked up
	 * per paragraph instead of across the whole document.
	 */
	private splitParagraphs(rawRtf: string): Paragraph[] {
		return rawRtf
			.split(BREAK_RE)
			.map(raw => ({ raw, text: this.decodeParagraph(raw) }))
			.filter(p => p.text.length > 0);
	}

	private extractItems(rawRtf: string): ProgramItem[] {
		const items: ProgramItem[] = [];
		const paragraphs = this.splitParagraphs(rawRtf);

		let i = 0;
		while (i < paragraphs.length) {
			const paragraph = paragraphs[i];
			if (!paragraph) { i++; continue; }

			const timeMatch = TIME_RE.exec(paragraph.text);
			if (!timeMatch) { i++; continue; }

			const time = timeMatch[1] ?? '';
			// Skip songs and pauses
			if (/\b(Lied|Pause)\b/i.test(paragraph.text)) { i++; continue; }

			const title = this.cleanTitle(paragraph.text, time);
			if (!title) { i++; continue; }

			const itemType = this.detectItemType(paragraph.text);
			const scriptures = this.matchScriptures(paragraph.raw);
			const bulletPoints = this.collectBullets(paragraphs, i + 1);

			items.push({ time, itemType, title, scriptures, bulletPoints });
			i++;
		}
		return items;
	}

	private matchScriptures(rawParagraph: string): Scripture[] {
		const scriptures: Scripture[] = [];
		for (const m of rawParagraph.matchAll(HYPERLINK_RE)) {
			const url = m[1];
			if (!url) continue;
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

	private collectBullets(paragraphs: Paragraph[], startIndex: number): string[] {
		const bullets: string[] = [];
		for (let j = startIndex; j < Math.min(startIndex + 10, paragraphs.length); j++) {
			const text = paragraphs[j]?.text ?? '';
			if (TIME_RE.test(text)) break; // next program item starts
			if (text.startsWith('•') || text.startsWith('-') || /^\d+\./.test(text)) {
				bullets.push(text.replace(/^[•\-\d.]\s*/, ''));
			}
		}
		return bullets;
	}

	private cleanTitle(text: string, time: string): string {
		return text
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
