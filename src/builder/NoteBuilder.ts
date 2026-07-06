import { Congress, Day, ItemType, ProgramItem, Scripture } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';
import { SupportedLang } from '../normalizer/bookNames';

export interface NoteBuilderOptions {
	lang: SupportedLang;
	scriptureLinks: boolean;
}

export interface GeneratedNote {
	filename: string;
	content: string;
}

export class NoteBuilder {

	constructor(private readonly opts: NoteBuilderOptions) {}

	buildNotes(congress: Congress): GeneratedNote[] {
		const notes: GeneratedNote[] = [];
		for (const day of congress.days) {
			for (const session of day.sessions) {
				for (const item of session.items) {
					notes.push(this.buildItemNote(item, day, congress));
				}
			}
		}
		return notes;
	}

	private buildItemNote(item: ProgramItem, day: Day, congress: Congress): GeneratedNote {
		const slug = this.slugify(`${day.weekday} ${item.time} ${item.title}`);
		const filename = `${congress.year} ${slug}.md`;
		const content = item.itemType === 'talk-series'
			? this.renderSeriesNote(item, day, congress)
			: this.renderSingleNote(item, day, congress);

		return { filename, content };
	}

	private renderSingleNote(item: ProgramItem, day: Day, congress: Congress): string {
		const lines: string[] = [];

		lines.push(this.frontmatter(item, day, congress));
		lines.push(`# ${item.title}`);
		if (item.subtitle) lines.push(`*${item.subtitle}*`);
		lines.push('');

		if (item.scriptures.length > 0) {
			lines.push(this.scriptureBlock(item.scriptures));
		}

		if (item.bulletPoints.length > 0) {
			for (const point of item.bulletPoints) {
				lines.push(`- ${point}`);
			}
			lines.push('');
		}

		lines.push(this.noteSpace());

		return lines.join('\n');
	}

	private renderSeriesNote(item: ProgramItem, day: Day, congress: Congress): string {
		const lines: string[] = [];

		lines.push(this.frontmatter(item, day, congress));
		lines.push(`# ${item.title}`);
		if (item.subtitle) lines.push(`*${item.subtitle}*`);
		lines.push('');

		if (item.scriptures.length > 0) {
			lines.push(this.scriptureBlock(item.scriptures));
		}

		const parts = item.parts ?? [];
		if (parts.length > 0) {
			for (const part of parts) {
				lines.push(`## ${part.title}`);
				if (part.subtitle) lines.push(`*${part.subtitle}*`);
				if (part.scriptures.length > 0) {
					lines.push(this.scriptureBlock(part.scriptures));
				}
				lines.push(this.noteSpace());
			}
		} else {
			lines.push(this.noteSpace());
		}

		return lines.join('\n');
	}

	private frontmatter(item: ProgramItem, day: Day, congress: Congress): string {
		const themeRef = congress.themeScripture
			? ScriptureNormalizer.format(congress.themeScripture, this.opts.lang)
			: '';
		return [
			'---',
			`typ: ${congress.type}`,
			`motto: "${congress.theme}"`,
			themeRef ? `motto_bibelstelle: "${themeRef}"` : '',
			`tag: ${day.weekday}`,
			day.date ? `datum: ${day.date}` : '',
			`jahr: ${congress.year}`,
			`programmpunkt: "${item.title}"`,
			`uhrzeit: "${item.time}"`,
			`typ_detail: ${item.itemType}`,
			'---',
			'',
		].filter(l => l !== '').join('\n');
	}

	private scriptureBlock(scriptures: Scripture[]): string {
		const links = scriptures.map(s => this.formatScripture(s)).join(' · ');
		return `**Bibeltexte:** ${links}\n`;
	}

	private formatScripture(s: Scripture): string {
		if (this.opts.scriptureLinks) {
			return ScriptureNormalizer.toMarkdownLink(s, this.opts.lang);
		}
		return ScriptureNormalizer.format(s, this.opts.lang);
	}

	private noteSpace(): string {
		return '\n\n\n';
	}

	private slugify(text: string): string {
		return text
			.replace(/[<>:"/\\|?*]/g, '')
			.replace(/\s+/g, ' ')
			.trim()
			.substring(0, 80);
	}

	static itemTypeLabel(type: ItemType, lang: SupportedLang): string {
		const labels: Record<ItemType, Record<SupportedLang, string>> = {
			'talk':        { de: 'Vortrag',         en: 'Talk' },
			'talk-series': { de: 'Vortragsreihe',   en: 'Symposium' },
			'bible-drama': { de: 'Bibeldrama',       en: 'Bible Drama' },
			'baptism':     { de: 'Taufe',            en: 'Baptism' },
			'interview':   { de: 'Interview',        en: 'Interview' },
			'symposium':   { de: 'Symposium',        en: 'Symposium' },
			'other':       { de: 'Sonstiges',        en: 'Other' },
		};
		return labels[type][lang];
	}
}
