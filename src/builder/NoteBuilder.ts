import { Congress, Day, ProgramItem, Scripture } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';
import { SupportedLang } from '../normalizer/bookNames';

export interface NoteBuilderOptions {
	lang: SupportedLang;
	scriptureLinks: boolean;
}

export interface GeneratedNote {
	filename: string;
	dayFolder?: string;
	content: string;
}

export interface GeneratedAttachment {
	filename: string;
	dayFolder?: string;
	data: Uint8Array;
}

export interface BuildResult {
	congressFolder: string;
	notes: GeneratedNote[];
	attachments: GeneratedAttachment[];
}

export class NoteBuilder {

	constructor(private readonly opts: NoteBuilderOptions) {}

	congressFolderName(congress: Congress): string {
		const { year, theme, type } = congress;
		const clean = this.sanitizeFolderName(theme);
		const season = `${year - 1}-${year}`;
		switch (type) {
			case 'CO':        return `Regionaler Kongress ${year} – ${clean}`;
			case 'CA-copgm':  return `Kreiskongressprogramm ${season} – mit dem Kreisaufseher – „${clean}“`;
			case 'CA-brpgm':  return `Kreiskongressprogramm ${season} – mit dem Vertreter des Zweigbüros – „${clean}“`;
		}
	}

	buildNotes(congress: Congress): BuildResult {
		const notes: GeneratedNote[] = [];
		const attachments: GeneratedAttachment[] = [];
		const isMultiDay = congress.type === 'CO';

		for (const day of congress.days) {
			const dayFolder = isMultiDay ? day.weekday : undefined;
			const noteBaseNames = new Map<ProgramItem, string>();
			const dayNotes: GeneratedNote[] = [];

			let index = 0;
			for (const session of day.sessions) {
				for (const item of session.items) {
					// Songs and asides (Pause/Musikvideo) show up in the overview only —
					// no dedicated, numbered note for either.
					if (item.itemType === 'song' || item.itemType === 'aside') continue;
					index++;
					const number = String(index).padStart(2, '0');

					const baseName = `${number}. ${this.slugify(item.title)}`;
					noteBaseNames.set(item, baseName);

					const content = item.itemType === 'talk-series'
						? this.renderSeriesNote(item, day, congress)
						: this.renderSingleNote(item, day, congress);
					dayNotes.push({ filename: `${baseName}.md`, dayFolder, content });
				}
			}

			let coverImageFilename: string | undefined;
			if (day.coverImage) {
				coverImageFilename = `Titelbild${this.extensionFor(day.coverImage.mimeType, day.coverImage.filename)}`;
				attachments.push({ filename: coverImageFilename, dayFolder, data: day.coverImage.data });
			}

			notes.push({
				filename: '00. Übersicht.md',
				dayFolder,
				content: this.renderOverviewNote(day, congress, noteBaseNames, coverImageFilename),
			});
			notes.push(...dayNotes);
		}

		return { congressFolder: this.congressFolderName(congress), notes, attachments };
	}

	private extensionFor(mimeType: string, originalFilename: string): string {
		const known: Record<string, string> = {
			'image/jpeg': '.jpg',
			'image/png': '.png',
			'image/gif': '.gif',
			'image/webp': '.webp',
		};
		if (known[mimeType]) return known[mimeType];
		const match = /\.[a-z0-9]+$/i.exec(originalFilename);
		return match?.[0] ?? '.jpg';
	}

	private renderOverviewNote(
		day: Day,
		congress: Congress,
		noteBaseNames: Map<ProgramItem, string>,
		coverImageFilename?: string,
	): string {
		const lines: string[] = [];

		if (coverImageFilename) {
			lines.push(`![[${coverImageFilename}]]`);
			lines.push('');
		}

		if (congress.type === 'CO') {
			lines.push(`# ${day.weekday}`);
			lines.push('');
			if (day.theme) {
				const scripture = day.themeScripture ? ` (${this.formatScripture(day.themeScripture)})` : '';
				lines.push(`${day.theme}${scripture}`);
				lines.push('');
			}
		}

		for (const session of day.sessions) {
			lines.push(`## ${session.name}`);
			for (const item of session.items) {
				lines.push(`- ${this.overviewLine(item, noteBaseNames.get(item))}`);

				const parts = item.parts ?? [];
				const parentBaseName = noteBaseNames.get(item);
				for (const part of parts) {
					lines.push(`  - ${this.overviewPartLine(part, parentBaseName)}`);
				}
			}
			lines.push('');
		}

		return lines.join('\n').trim() + '\n';
	}

	private overviewLine(item: ProgramItem, baseName: string | undefined): string {
		const time = item.time ? `**${item.time}** – ` : '';

		if (item.itemType === 'song' && item.songNumber) {
			// Only "Lied NNN" itself should be the clickable JW Library link — a
			// trailing remark from the same programme line (e.g. "und Gebet",
			// "(Bekanntmachungen)") is kept as plain text after it, not part of the link.
			const { label, remark } = this.splitSongTitle(item.title);
			const link = `[${label}](${this.songLink(item.songNumber)})`;
			return remark ? `${time}${link} ${remark}` : `${time}${link}`;
		}

		const titleLink = baseName ? `[[${baseName}|${item.title}]]` : item.title;
		return `${time}${titleLink}${this.overviewScriptures(item.scriptures)}`;
	}

	private splitSongTitle(title: string): { label: string; remark?: string } {
		const match = /^((?:Lied|Song)\s+\d+)[.,:;\s-]*(.*)$/i.exec(title.trim());
		if (!match || !match[1]) return { label: title };
		return { label: match[1], remark: match[2]?.trim() || undefined };
	}

	private overviewPartLine(part: ProgramItem, parentBaseName: string | undefined): string {
		const titleLink = parentBaseName
			? `[[${parentBaseName}#${part.title}|${part.title}]]`
			: part.title;
		return `${titleLink}${this.overviewScriptures(part.scriptures)}`;
	}

	// Scripture references in the day overview are wrapped in a span (raw HTML,
	// which Obsidian's Markdown renderer passes through) so styles.css can visually
	// de-emphasize them — a bullet with time + title + half a dozen scripture links
	// otherwise reads as a wall of blue links with the title lost among them.
	//
	// Rendered in parentheses like the official printed programme, e.g.
	// "(Matthäus 5:1, 2)" or "(Matthäus 5:3-16; Lukas 6:17-49)" for multiple refs.
	private overviewScriptures(scriptures: Scripture[]): string {
		if (scriptures.length === 0) return '';
		const refs = scriptures.map(s => this.overviewScriptureLink(s)).join('; ');
		return ` <span class="jw-overview-refs">(${refs})</span>`;
	}

	private overviewScriptureLink(s: Scripture): string {
		const label = ScriptureNormalizer.format(s, this.opts.lang);
		if (!this.opts.scriptureLinks) return label;
		return `<a href="${ScriptureNormalizer.toJwLibraryLink(s)}">${label}</a>`;
	}

	// Neither `pub=sjjm&issue=0&track=N` nor `lank=pub-sjjm_${N+500}` worked on a
	// real iPhone (JW Library opened, didn't recognize the query, and bounced to
	// a broken web fallback both times). The correct content id — confirmed via
	// JW Library's own "Share" feature for two real songs from "Singt voller
	// Freude für Jehova" (Lied 54 → docid=1102016854, Lied 94 → docid=1102016894,
	// both giving the same base offset 1102016800, i.e. docid = 1102016800 + songNumber) —
	// is `docid=`. That confirmation came via the https://www.jw.org universal
	// link, which itself worked fine when tapped outside Obsidian but bounced
	// back to jw.org's bare homepage when tapped from within a note: Obsidian's
	// mobile in-app browser can render http(s) content itself, so the tap never
	// reaches the OS-level Universal Link handoff that would hand it to JW
	// Library. A jwlibrary:// custom-scheme link has no such escape hatch — the
	// in-app browser can't render it as a page, so Obsidian is forced to hand it
	// to the OS directly — which is why every jwlibrary:// attempt so far has at
	// least opened the app (just previously with a query it didn't understand).
	// `srcid`/`wtlocale`/`prefer` are also part of the app's own confirmed share
	// link (only the scheme+host were swapped here) — carried over in case the
	// jwlibrary:// finder handler needs them too, not just the bare docid.
	private songLink(songNumber: number): string {
		return `jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&docid=${1102016800 + songNumber}`;
	}

	private renderSingleNote(item: ProgramItem, day: Day, congress: Congress): string {
		const lines: string[] = [];

		if (item.subtitle) {
			lines.push(`*${item.subtitle}*`);
			lines.push('');
		}
		if (congress.type === 'CO') lines.push(`**Tag:** ${day.weekday}`);
		if (item.time) lines.push(`**Uhrzeit:** ${item.time}`);

		if (item.scriptures.length > 0) {
			lines.push(this.scriptureBlock(item.scriptures));
		}

		lines.push('**Redner:**');
		lines.push('');

		if (item.bulletPoints.length > 0) {
			lines.push('---');
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

		if (item.subtitle) {
			lines.push(`*${item.subtitle}*`);
			lines.push('');
		}
		if (congress.type === 'CO') lines.push(`**Tag:** ${day.weekday}`);
		if (item.time) lines.push(`**Uhrzeit:** ${item.time}`);

		if (item.scriptures.length > 0) {
			lines.push(this.scriptureBlock(item.scriptures));
		}

		lines.push('');

		const parts = item.parts ?? [];
		if (parts.length > 0) {
			for (const part of parts) {
				lines.push(`## ${part.title}`);
				if (part.subtitle) lines.push(`*${part.subtitle}*`);
				if (part.scriptures.length > 0) {
					lines.push(this.scriptureBlock(part.scriptures));
				}
				lines.push('**Redner:**');
				lines.push('');
				lines.push(this.noteSpace());
			}
		} else {
			lines.push('**Redner:**');
			lines.push('');
			lines.push(this.noteSpace());
		}

		return lines.join('\n');
	}

	private scriptureBlock(scriptures: Scripture[]): string {
		const links = scriptures.map(s => this.formatScripture(s)).join('; ');
		return `**Bibeltexte:** (${links})`;
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

	// Characters forbidden in Windows file/folder names, mapped to visually similar
	// Unicode look-alikes so punctuation (e.g. a trailing "?") isn't silently lost
	// from titles that double as filenames.
	private static readonly FS_CHAR_MAP: Record<string, string> = {
		'<': '‹', '>': '›', ':': '꞉', '"': 'ʺ', '/': '⁄', '\\': '＼', '|': '｜', '*': '＊', '?': '？',
	};

	private replaceForbiddenChars(text: string): string {
		return text.replace(/[<>:"/\\|?*]/g, ch => NoteBuilder.FS_CHAR_MAP[ch] ?? '');
	}

	private slugify(text: string): string {
		return this.replaceForbiddenChars(text)
			.replace(/\s+/g, ' ')
			.trim()
			.substring(0, 80);
	}

	private sanitizeFolderName(text: string): string {
		return this.replaceForbiddenChars(text)
			.replace(/\s+/g, ' ')
			.trim();
	}
}
