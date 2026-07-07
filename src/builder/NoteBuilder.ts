import { Congress, Day, ProgramItem, Scripture } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';
import { SupportedLang } from '../normalizer/bookNames';

export interface NoteBuilderOptions {
	lang: SupportedLang;
	scriptureLinks: boolean;
	reviewNote: boolean;
	showTagField: boolean;
	showTimeField: boolean;
	showScriptureField: boolean;
	showSpeakerField: boolean;
	extraFields: string;
}

export interface GeneratedNote {
	filename: string;
	dayFolder?: string;
	content: string;
	/** True for purely derived content (no expected user edits) — safe to overwrite
	 *  on re-import so plugin updates reach already-imported congresses without the
	 *  user having to delete anything. Notes with writing space (talk notes, the
	 *  review note, the printed questions note) default to false/undefined and are
	 *  left untouched if they already exist, to never clobber user-added content. */
	regenerate?: boolean;
}

export interface GeneratedAttachment {
	filename: string;
	dayFolder?: string;
	data: Uint8Array;
	regenerate?: boolean;
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

		// Base name of the printed "Beantworte die folgenden Fragen" note (circuit
		// assemblies only) — the review note links straight to it instead of
		// duplicating its content.
		let questionsBaseName: string | undefined;

		for (const day of congress.days) {
			const dayFolder = isMultiDay ? day.weekday : undefined;
			const noteBaseNames = new Map<ProgramItem, string>();
			const dayNotes: GeneratedNote[] = [];

			let index = 0;
			for (const session of day.sessions) {
				for (let i = 0; i < session.items.length; i++) {
					const item = session.items[i]!;
					// Songs and asides (Pause/Musikvideo) show up in the overview only —
					// no dedicated, numbered note for either.
					if (item.itemType === 'song' || item.itemType === 'aside') continue;
					index++;
					const number = String(index).padStart(2, '0');

					const baseName = `${number}. ${this.slugify(item.title)}`;
					noteBaseNames.set(item, baseName);
					if (item.title === 'Beantworte die folgenden Fragen') {
						questionsBaseName = baseName;
					}

					// A song (often with a trailing "und Gebet") that directly follows
					// this item in the programme — mentioned and linked in the item's
					// own note too, not just the overview, so it isn't only visible one
					// note away.
					const next = session.items[i + 1];
					const trailingSong = next?.itemType === 'song' ? next : undefined;

					const content = item.itemType === 'talk-series'
						? this.renderSeriesNote(item, day, congress, trailingSong)
						: this.renderSingleNote(item, day, congress, trailingSong);
					dayNotes.push({ filename: `${baseName}.md`, dayFolder, content });
				}
			}

			let coverImageFilename: string | undefined;
			if (day.coverImage) {
				coverImageFilename = `Titelbild${this.extensionFor(day.coverImage.mimeType, day.coverImage.filename)}`;
				attachments.push({ filename: coverImageFilename, dayFolder, data: day.coverImage.data, regenerate: true });
			}

			notes.push({
				filename: '00. Übersicht.md',
				dayFolder,
				content: this.renderOverviewNote(day, congress, noteBaseNames, coverImageFilename),
				regenerate: true,
			});
			notes.push(...dayNotes);
		}

		if (this.opts.reviewNote) {
			notes.push({
				filename: 'Wiederholung.md',
				content: this.renderReviewNote(congress, questionsBaseName),
			});
		}

		return { congressFolder: this.congressFolderName(congress), notes, attachments };
	}

	// The congress-wide "review" meeting held the following week: the three
	// standard reflection questions always apply, plus a type-specific pointer —
	// circuit assemblies repeat the printed review questions from the programme
	// (which we already generated a note for), regional conventions instead play
	// a highlights video (not something we can extract from the programme file).
	private renderReviewNote(congress: Congress, questionsBaseName: string | undefined): string {
		const lines: string[] = [];
		lines.push('# Kongress-Wiederholung');
		lines.push('');
		lines.push('**Welche Gedanken haben dich Jehova nähergebracht?**');
		lines.push('');
		lines.push('');
		lines.push('**Welche Gedanken kannst du im Predigtdienst anwenden?**');
		lines.push('');
		lines.push('');
		lines.push('**Welche Gedanken kannst du in deinem persönlichen Leben anwenden?**');
		lines.push('');
		lines.push('');

		const isCA = congress.type === 'CA-copgm' || congress.type === 'CA-brpgm';
		if (isCA && questionsBaseName) {
			lines.push(`Der Versammlungsleiter stellt außerdem die gedruckten Wiederholungsfragen: [[${questionsBaseName}|Beantworte die folgenden Fragen]]`);
		} else if (!isCA) {
			lines.push('Der Bruder lässt das Video mit Auszügen aus dem Kongressprogramm abspielen.');
		}
		lines.push('');

		return lines.join('\n').trim() + '\n';
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
			return `${time}${this.songLinkText(item)}`;
		}

		const titleLink = baseName ? `[[${baseName}|${item.title}]]` : item.title;
		return `${time}${titleLink}${this.overviewScriptures(item.scriptures)}`;
	}

	// Only "Lied NNN" itself should be the clickable JW Library link — a trailing
	// remark from the same programme line (e.g. "und Gebet", "(Bekanntmachungen)")
	// is kept as plain text after it, not part of the link. Shared between the
	// overview's song line and a programme item's own "trailing song" mention
	// (see renderSingleNote()/renderSeriesNote()), so both link identically.
	private songLinkText(item: ProgramItem): string {
		const { label, remark } = this.splitSongTitle(item.title);
		const link = `[${label}](${this.songLink(item.songNumber!, item.songDocid)})`;
		return remark ? `${link} ${remark}` : link;
	}

	private splitSongTitle(title: string): { label: string; remark?: string } {
		const match = /^((?:Lied|Song)\s+\d+)[.,:;\s-]*(.*)$/i.exec(title.trim());
		if (!match || !match[1]) return { label: title };
		return { label: match[1], remark: match[2]?.trim() || undefined };
	}

	// Every dedicated per-item note carries a link back to the day's overview —
	// as close to "above the title" as Obsidian allows (content can't render
	// above the inline title, so this is the first line of body content instead).
	// Uses a folder-qualified link (not just "[[00. Übersicht]]") so multi-day
	// congresses, which have one "00. Übersicht" per day folder, resolve
	// unambiguously rather than relying on Obsidian's shortest-path guess.
	private overviewLinkLine(day: Day, congress: Congress): string {
		const folder = this.dayFolderName(day, congress);
		const target = folder ? `${folder}/00. Übersicht` : '00. Übersicht';
		return `[[${target}|↩ Zur Übersicht]]`;
	}

	private dayFolderName(day: Day, congress: Congress): string | undefined {
		return congress.type === 'CO' ? day.weekday : undefined;
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
	// real iPhone (bounced to a broken web fallback), and even the confirmed-correct
	// `docid=` content id failed both as a jwlibrary:// link (with and without the
	// full srcid/wtlocale/prefer param set) and, earlier, as a https://www.jw.org
	// link when tapped from within Obsidian. The one thing confirmed to work is
	// this exact URL shape, copied byte-for-byte from JW Library's own "Share" feature.
	// Deliberately NOT jwlibrary:// here, unlike scripture links — per user testing,
	// this exact https://www.jw.org form is the only one that has ever worked.
	//
	// The docid itself is NOT a linear function of the song number — Lied 14/54/94
	// happen to sit in a contiguous block (docid = 1102016800 + songNumber), but Lied
	// 160's real docid is 1102022960, not the predicted 1102016960. So `songDocid`
	// (read straight out of the jwpub file's own song link, see JwpubParser) is used
	// whenever available; the formula is only a fallback for the RTF import path,
	// which has no docid to read and can't do better than a guess.
	private songLink(songNumber: number, songDocid?: number): string {
		const docid = songDocid ?? 1102016800 + songNumber;
		return `https://www.jw.org/finder?srcid=jwlshare&wtlocale=X&prefer=lang&docid=${docid}`;
	}

	private renderSingleNote(item: ProgramItem, day: Day, congress: Congress, trailingSong?: ProgramItem): string {
		const lines: string[] = [];

		lines.push(this.overviewLinkLine(day, congress));
		lines.push('');

		if (item.subtitle) {
			lines.push(`*${item.subtitle}*`);
			lines.push('');
		}
		if (this.opts.showTagField && congress.type === 'CO') lines.push(`**Tag:** ${day.weekday}`);
		if (this.opts.showTimeField && item.time) lines.push(`**Uhrzeit:** ${item.time}`);

		if (this.opts.showScriptureField && item.scriptures.length > 0) {
			lines.push(this.scriptureBlock(item.scriptures));
		}

		if (this.opts.showSpeakerField) {
			lines.push('**Redner:**');
			lines.push('');
		}
		this.pushExtraFields(lines);

		if (item.bulletPoints.length > 0) {
			lines.push('---');
			for (const point of item.bulletPoints) {
				lines.push(`- ${point}`);
			}
			lines.push('');
		}

		if (trailingSong) {
			lines.push(`**Anschließend:** ${this.songLinkText(trailingSong)}`);
			lines.push('');
		}

		lines.push(this.noteSpace());

		return lines.join('\n');
	}

	private renderSeriesNote(item: ProgramItem, day: Day, congress: Congress, trailingSong?: ProgramItem): string {
		const lines: string[] = [];

		lines.push(this.overviewLinkLine(day, congress));
		lines.push('');

		if (item.subtitle) {
			lines.push(`*${item.subtitle}*`);
			lines.push('');
		}
		if (this.opts.showTagField && congress.type === 'CO') lines.push(`**Tag:** ${day.weekday}`);
		if (this.opts.showTimeField && item.time) lines.push(`**Uhrzeit:** ${item.time}`);

		if (this.opts.showScriptureField && item.scriptures.length > 0) {
			lines.push(this.scriptureBlock(item.scriptures));
		}

		lines.push('');

		const parts = item.parts ?? [];
		if (parts.length > 0) {
			for (const part of parts) {
				lines.push(`## ${part.title}`);
				if (part.subtitle) lines.push(`*${part.subtitle}*`);
				if (this.opts.showScriptureField && part.scriptures.length > 0) {
					lines.push(this.scriptureBlock(part.scriptures));
				}
				if (this.opts.showSpeakerField) {
					lines.push('**Redner:**');
					lines.push('');
				}
				this.pushExtraFields(lines);
				lines.push(this.noteSpace());
			}
		} else {
			if (this.opts.showSpeakerField) {
				lines.push('**Redner:**');
				lines.push('');
			}
			this.pushExtraFields(lines);
			lines.push(this.noteSpace());
		}

		if (trailingSong) {
			lines.push(`**Anschließend:** ${this.songLinkText(trailingSong)}`);
			lines.push('');
		}

		return lines.join('\n');
	}

	// User-defined extra fields (settings.extraFields, one per line — e.g. a custom
	// "**Notizen:**" line), appended right after the standard fields. Each field
	// gets its own dedicated blank writing space directly beneath it (like
	// noteSpace() does for the note as a whole), so it reads as a genuine extra
	// field rather than just an inserted label sharing the note's bottom space.
	private pushExtraFields(lines: string[]): void {
		const extra = this.opts.extraFields.trim();
		if (!extra) return;
		for (const line of extra.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			lines.push(trimmed);
			lines.push('');
			lines.push('');
		}
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
