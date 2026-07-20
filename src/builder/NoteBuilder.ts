import { Congress, Day, ProgramItem, Scripture } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';
import { CongressLang } from '../normalizer/bookNames';
import { NL, NoteStrings } from '../i18n';
import { pushMarked } from '../util/noteMerge';

export interface NoteBuilderOptions {
	scriptureLinks: boolean;
	reviewNote: boolean;
	showTagField: boolean;
	showTimeField: boolean;
	showScriptureField: boolean;
	showSpeakerField: boolean;
	extraFields: string;
	frontmatter: boolean;
}

export interface GeneratedNote {
	filename: string;
	dayFolder?: string;
	content: string;
	/** True for purely derived content (no expected user edits) — safe to overwrite
	 *  outright on a plain re-import (JwCongregationPlugin.importFile()). Notes with
	 *  writing space (talk notes, the review note) default to false/undefined and are
	 *  left untouched there. JwCongregationPlugin.updateFile() (the "Update convention
	 *  notes" command) instead merges those via the %%jw:id%% markers this class wraps
	 *  around every derived field — see util/noteMerge.ts. */
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

	// Notes are generated in the language of the imported FILE (Congress.lang),
	// not the plugin's UI language — mixing e.g. German labels into an English
	// programme would help nobody. Set at the start of buildNotes()/
	// congressFolderName() from the congress being rendered; 'de' is only the
	// pre-first-call placeholder.
	private lang: CongressLang = 'de';

	constructor(private readonly opts: NoteBuilderOptions) {}

	private get t(): NoteStrings {
		return NL[this.lang];
	}

	// Opt-in YAML frontmatter (settings.frontmatter). Keys are deliberately
	// stable ENGLISH identifiers regardless of the note language — Dataview/
	// Bases queries written once must keep working across mixed-language
	// vaults; only the VALUES follow the file (weekday names, theme).
	private frontmatterLines(congress: Congress, day?: Day, time?: string): string[] {
		if (!this.opts.frontmatter) return [];
		const esc = (v: string) => v.replace(/"/g, '\\"');
		const lines = ['---', `convention: "${esc(congress.theme)}"`, `type: ${congress.type}`];
		if (day) lines.push(`day: ${day.weekday}`);
		if (time) lines.push(`time: "${time}"`);
		lines.push('---', '');
		return lines;
	}

	congressFolderName(congress: Congress): string {
		this.lang = congress.lang;
		const { year, theme, type } = congress;
		const clean = this.sanitizeFolderName(theme);
		const season = `${year - 1}-${year}`;
		switch (type) {
			case 'CO':        return this.sanitizeFolderName(this.t.folderCO(year, clean));
			case 'CA-copgm':  return this.sanitizeFolderName(this.t.folderCAco(season, clean));
			case 'CA-brpgm':  return this.sanitizeFolderName(this.t.folderCAbr(season, clean));
		}
	}

	buildNotes(congress: Congress): BuildResult {
		this.lang = congress.lang;
		const notes: GeneratedNote[] = [];
		const attachments: GeneratedAttachment[] = [];
		const isMultiDay = congress.type === 'CO';

		// Base name of the printed review-questions note (circuit assemblies
		// only) — the review note links straight to it instead of duplicating
		// its content.
		let questionsBaseName: string | undefined;

		for (const day of congress.days) {
			const dayFolder = isMultiDay ? day.weekday : undefined;
			const noteBaseNames = new Map<ProgramItem, string>();
			const dayNotes: GeneratedNote[] = [];

			// First pass: assign every note its number/base name up front. Rendering
			// needs the *complete* map, because each note's "Anschließend" hint links
			// to the FOLLOWING item's note — whose name wouldn't exist yet if naming
			// and rendering happened in the same pass.
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
					if (item.title === this.t.questionsTitle) {
						questionsBaseName = baseName;
					}
				}
			}

			// Second pass: render. Whatever directly follows this item in the
			// programme — a song (often with a trailing "und Gebet"), a plain aside
			// (Pause, Musikvideo, …) or the next regular programme item — is
			// mentioned at the end of the item's own note too, not just in the
			// overview, so the flow of the programme is visible without switching
			// notes. Deliberately session-scoped: the last item of a session gets no
			// hint pointing across the lunch break.
			for (const session of day.sessions) {
				for (let i = 0; i < session.items.length; i++) {
					const item = session.items[i]!;
					if (item.itemType === 'song' || item.itemType === 'aside') continue;

					const next = session.items[i + 1];
					const trailingText = next ? this.trailingItemText(next, noteBaseNames.get(next)) : undefined;

					const content = item.itemType === 'talk-series'
						? this.renderSeriesNote(item, day, congress, trailingText)
						: this.renderSingleNote(item, day, congress, trailingText);
					dayNotes.push({ filename: `${noteBaseNames.get(item)!}.md`, dayFolder, content });
				}
			}

			let coverImageFilename: string | undefined;
			if (day.coverImage) {
				coverImageFilename = `${this.t.coverImageBase}${this.extensionFor(day.coverImage.mimeType, day.coverImage.filename)}`;
				attachments.push({ filename: coverImageFilename, dayFolder, data: day.coverImage.data, regenerate: true });
			}

			notes.push({
				filename: `${this.t.overviewBase}.md`,
				dayFolder,
				content: this.renderOverviewNote(day, congress, noteBaseNames, coverImageFilename),
				regenerate: true,
			});
			notes.push(...dayNotes);
		}

		if (this.opts.reviewNote) {
			notes.push({
				filename: `${this.t.reviewNoteBase}.md`,
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
	// The pointer sits as an italic "Hinweis:" line at the very top (same styling
	// slot as a programme item's subtitle, e.g. "*Folge 4: …*"), not at the
	// bottom — per user request, so the practical instruction is read before the
	// questions rather than discovered after them. Deliberately NO "#" heading:
	// Obsidian already renders the filename ("Wiederholung") as the note's inline
	// title, so an in-note heading showed up as a duplicate second title.
	private renderReviewNote(congress: Congress, questionsBaseName: string | undefined): string {
		const lines: string[] = [];
		lines.push(...this.frontmatterLines(congress));

		pushMarked(lines, 'hint', () => {
			const isCA = congress.type === 'CA-copgm' || congress.type === 'CA-brpgm';
			if (isCA && questionsBaseName) {
				const link = `[[${questionsBaseName}|${this.t.questionsTitle}]]`;
				lines.push(`*${this.t.reviewHintCA(link)}*`);
				lines.push('');
			} else if (!isCA) {
				lines.push(`*${this.t.reviewHintCO}*`);
				lines.push('');
			}
		});

		this.t.reviewQuestions.forEach((question, i) => {
			pushMarked(lines, `question-${i + 1}`, () => {
				lines.push(`**${question}**`);
			});
			lines.push('');
			lines.push('');
		});

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
		lines.push(...this.frontmatterLines(congress, day));

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
		// "Lied 12 und Gebet" (German) / "Song No. 160 and Prayer" (English) —
		// the optional "No."/"no"/"№" infix only appears in some languages
		// (English "No.", French "no", Russian "№"; Italian/Portuguese/Spanish
		// have none, confirmed against real programme files of each language).
		const match = /^((?:Lied|Song|Cantique|Cantico|Cântico|Песня|Canción)(?:\s+(?:No\.|no|№))?\s+\d+)[.,:;\s-]*(.*)$/iu.exec(title.trim());
		if (!match || !match[1]) return { label: title };
		return { label: match[1], remark: match[2]?.trim() || undefined };
	}

	// Own writing space (e.g. for the talk itself) needs clear air below it before
	// the "Anschließend" hint, or the two run together — trims whatever blank
	// lines the preceding section already ended with (usually just one, after
	// "**Redner:**") and replaces them with a fixed 3-line gap, regardless of
	// what came right before.
	//
	// The gap lines carry a literal no-break space (U+00A0) instead of being
	// empty: Markdown collapses any run of truly blank lines into a single
	// paragraph break when rendering, so plain empty lines would be invisible in
	// Reading View (confirmed by real-world testing — the gap only showed in the
	// raw source). A line whose only content is a no-break space is "non-empty"
	// to the renderer and keeps its own line height, while looking blank and
	// being freely type-over-able in the editor. Deliberately the raw character,
	// NOT the `&nbsp;` entity: Live Preview displays the entity as literal
	// "&nbsp;" text (also confirmed by real-world testing), while the raw
	// character is invisible in every view.
	private pushAnschliessendGap(lines: string[]): void {
		// trim() (not === '') because a preceding noteSpace() sits in the array as
		// one single '\n\n\n' element, not as individual empty lines — a plain
		// equality check walks right past it and the gap ends up 10 lines tall
		// for series notes (confirmed against a real imported note).
		while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();
		lines.push('');
		for (let i = 0; i < 3; i++) lines.push('\u00A0');
		lines.push('');
	}

	// A trailing song gets its usual JW-Library-linked treatment; a regular
	// programme item links to its own note; an aside (Pause, Musikvideo, …) has
	// no link target, so its plain title is enough.
	private trailingItemText(item: ProgramItem, baseName: string | undefined): string {
		if (item.itemType === 'song') return this.songLinkText(item);
		if (baseName) return `[[${baseName}|${item.title}]]`;
		return item.title;
	}

	// Every dedicated per-item note carries a link back to the day's overview —
	// as close to "above the title" as Obsidian allows (content can't render
	// above the inline title, so this is the first line of body content instead).
	// Uses a folder-qualified link (not just "[[00. Übersicht]]") so multi-day
	// congresses, which have one overview note per day folder, resolve
	// unambiguously rather than relying on Obsidian's shortest-path guess.
	private overviewLinkLine(day: Day, congress: Congress): string {
		const folder = this.dayFolderName(day, congress);
		const target = folder ? `${folder}/${this.t.overviewBase}` : this.t.overviewBase;
		return `[[${target}|${this.t.backToOverview}]]`;
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
		const label = ScriptureNormalizer.format(s, this.lang);
		if (!this.opts.scriptureLinks) return label;
		return `<a href="${ScriptureNormalizer.toJwLibraryLink(s, this.lang)}">${label}</a>`;
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
		return `https://www.jw.org/finder?srcid=jwlshare&wtlocale=${ScriptureNormalizer.wtlocale(this.lang)}&prefer=lang&docid=${docid}`;
	}

	// Every derived block below is wrapped in a pushMarked() marker so a later
	// "update" re-import (see noteMerge.ts) can patch just that block in an
	// already-existing, user-edited note — e.g. fixing a wrong weekday or
	// scripture link without touching the speaker name or notes the user
	// typed into the surrounding writing space.
	private renderSingleNote(item: ProgramItem, day: Day, congress: Congress, trailingText?: string): string {
		const lines: string[] = [];
		lines.push(...this.frontmatterLines(congress, day, item.time || undefined));

		pushMarked(lines, 'header', () => {
			lines.push(this.overviewLinkLine(day, congress));
			lines.push('');

			if (item.subtitle) {
				lines.push(`*${item.subtitle}*`);
				lines.push('');
			}
			if (this.opts.showTagField && congress.type === 'CO') lines.push(`**${this.t.dayLabel}:** ${day.weekday}`);
			if (this.opts.showTimeField && item.time) lines.push(`**${this.t.timeLabel}:** ${item.time}`);

			if (this.opts.showScriptureField && item.scriptures.length > 0) {
				lines.push(this.scriptureBlock(item.scriptures));
			}
		});

		if (this.opts.showSpeakerField) {
			lines.push(`**${this.t.speakerLabel}:**`);
			lines.push('');
		}
		this.pushExtraFields(lines);

		pushMarked(lines, 'bullets', () => {
			if (item.bulletPoints.length > 0) {
				lines.push('---');
				for (const point of item.bulletPoints) {
					lines.push(`- ${point}`);
				}
				lines.push('');
			}
		});

		if (trailingText) {
			// The gap-trimming logic pops trailing blank lines from `lines`
			// itself (including ones pushed before this point) — it must run
			// BEFORE pushMarked() captures its start index, or the marker
			// would wrap (and on a later merge, discard) content that isn't
			// actually part of this footer.
			this.pushAnschliessendGap(lines);
			pushMarked(lines, 'footer', () => {
				lines.push(`**${this.t.nextLabel}:** ${trailingText}`);
				lines.push('');
			});
		}

		lines.push(this.noteSpace());

		return lines.join('\n');
	}

	private renderSeriesNote(item: ProgramItem, day: Day, congress: Congress, trailingText?: string): string {
		const lines: string[] = [];
		lines.push(...this.frontmatterLines(congress, day, item.time || undefined));

		pushMarked(lines, 'header', () => {
			lines.push(this.overviewLinkLine(day, congress));
			lines.push('');

			if (item.subtitle) {
				lines.push(`*${item.subtitle}*`);
				lines.push('');
			}
			if (this.opts.showTagField && congress.type === 'CO') lines.push(`**${this.t.dayLabel}:** ${day.weekday}`);
			if (this.opts.showTimeField && item.time) lines.push(`**${this.t.timeLabel}:** ${item.time}`);

			if (this.opts.showScriptureField && item.scriptures.length > 0) {
				lines.push(this.scriptureBlock(item.scriptures));
			}

			lines.push('');
		});

		const parts = item.parts ?? [];
		if (parts.length > 0) {
			// Marker id is positional ("part-1", "part-2", …), not
			// content-based — a later merge only succeeds when the fresh
			// render has the exact same NUMBER of parts in the exact same
			// order as the existing note, which safely covers "a part's
			// title/scriptures got corrected" while refusing to guess when
			// parts were added, removed or reordered (see noteMerge.ts).
			parts.forEach((part, i) => {
				pushMarked(lines, `part-${i + 1}`, () => {
					lines.push(`## ${part.title}`);
					if (part.subtitle) lines.push(`*${part.subtitle}*`);
					if (this.opts.showScriptureField && part.scriptures.length > 0) {
						lines.push(this.scriptureBlock(part.scriptures));
					}
				});
				if (this.opts.showSpeakerField) {
					lines.push(`**${this.t.speakerLabel}:**`);
					lines.push('');
				}
				this.pushExtraFields(lines);
				lines.push(this.noteSpace());
			});
		} else {
			if (this.opts.showSpeakerField) {
				lines.push(`**${this.t.speakerLabel}:**`);
				lines.push('');
			}
			this.pushExtraFields(lines);
			lines.push(this.noteSpace());
		}

		if (trailingText) {
			this.pushAnschliessendGap(lines);
			pushMarked(lines, 'footer', () => {
				lines.push(`**${this.t.nextLabel}:** ${trailingText}`);
				lines.push('');
			});
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
		return `**${this.t.scripturesLabel}:** (${links})`;
	}

	private formatScripture(s: Scripture): string {
		if (this.opts.scriptureLinks) {
			return ScriptureNormalizer.toMarkdownLink(s, this.lang);
		}
		return ScriptureNormalizer.format(s, this.lang);
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
