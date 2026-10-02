import { Mwb, MwbSection, MwbSong, MwbTextSegment, MwbWeek } from '../models/mwb';
import { Scripture } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';
import { songFinderUrl } from '../normalizer/songDocIds';
import { NL, NoteStrings } from '../i18n';
import { CongressLang } from '../normalizer/bookNames';
import { pushMarked } from '../util/noteMerge';

export interface MwbBuilderOptions {
	scriptureLinks: boolean;
	showDurationField: boolean;
	/** Whether a source-material citation (e.g. "th Lektion 11") renders as a
	 *  clickable jw.org/finder link — off shows the plain label only. */
	showSourceCitationField: boolean;
	frontmatter: boolean;
}

export interface GeneratedMwbNote {
	filename: string;
	content: string;
	/** True for purely derived content — currently unused (every mwb note has
	 *  writing space and goes through the marker-merge path instead), kept for
	 *  parity with NoteBuilder.GeneratedNote's shape. */
	regenerate?: boolean;
}

export interface GeneratedMwbAttachment {
	filename: string;
	data: Uint8Array;
	regenerate?: boolean;
}

export interface MwbBuildResult {
	issueFolder: string;
	notes: GeneratedMwbNote[];
	attachments: GeneratedMwbAttachment[];
}

/**
 * Turns a parsed `Mwb` (see models/mwb.ts, MwbParser) into one Markdown note
 * per week — NOT one note per programme item, unlike NoteBuilder's congress
 * notes (explicit user decision: a week's schedule is consumed as a whole,
 * not fragmented into a file per assignment). Every numbered item still gets
 * its own `item-N` marker (the Congregation Bible Study gets `cbs` instead,
 * since it's always the last item and worth a stable, memorable id)
 * with writing space after it — mirrors NoteBuilder.renderSeriesNote()'s
 * `part-N` scheme, just applied to a whole week's items in one note instead
 * of one talk-series' parts. Reuses `pushMarked`/`mergeNoteContent` (see
 * util/noteMerge.ts) unmodified — merge stability requires a re-parsed week
 * to yield the same NUMBER of items in the same order, exactly like the
 * existing `part-N` precedent.
 *
 * Writes in the workbook's own language (Mwb.lang — German or Korean, see
 * MwbParser), the way NoteBuilder does for convention programmes. Every text
 * it adds itself comes from NoteStrings; the German values are exactly the
 * ones this class used to hardcode, so German notes are unchanged.
 */
export class MwbNoteBuilder {

	// Set from the workbook at the start of buildNotes()/issueFolderName();
	// 'de' is only the placeholder before the first call.
	private lang: CongressLang = 'de';

	private get t(): NoteStrings {
		return NL[this.lang];
	}

	constructor(private readonly opts: MwbBuilderOptions) {}

	private frontmatterLines(week: MwbWeek, year: number): string[] {
		if (!this.opts.frontmatter) return [];
		const esc = (v: string) => v.replace(/"/g, '\\"');
		return ['---', 'mwb: true', `week: "${esc(week.dateRangeLabel)}"`, `year: ${year}`, '---', ''];
	}

	issueFolderName(mwb: Mwb): string {
		this.lang = mwb.lang;
		const m = /^(\d{4})(\d{2})\d{2}$/.exec(mwb.issueTagNumber);
		const month = m ? Number(m[2]) : undefined;
		const valid = month !== undefined && month >= 1 && month <= 12 ? month : undefined;
		return this.sanitizeName(this.text.mwbFolder(mwb.year, valid));
	}

	/** The workbook strings of this language. Only languages that carry them
	 *  get this far — MwbParser refuses every other one. */
	private get text(): Required<Pick<NoteStrings, 'mwbFolder' | 'mwbDuration' | 'mwbSong' | 'mwbPrayer' | 'mwbIntroWords' | 'mwbClosingWords'>> {
		const t = this.t;
		const de = NL.de;
		return {
			mwbFolder: t.mwbFolder ?? de.mwbFolder!,
			mwbDuration: t.mwbDuration ?? de.mwbDuration!,
			mwbSong: t.mwbSong ?? de.mwbSong!,
			mwbPrayer: t.mwbPrayer ?? de.mwbPrayer!,
			mwbIntroWords: t.mwbIntroWords ?? de.mwbIntroWords!,
			mwbClosingWords: t.mwbClosingWords ?? de.mwbClosingWords!,
		};
	}

	buildNotes(mwb: Mwb): MwbBuildResult {
		this.lang = mwb.lang;
		const notes: GeneratedMwbNote[] = [];
		const attachments: GeneratedMwbAttachment[] = [];

		mwb.weeks.forEach((week, index) => {
			// Zero-padded like NoteBuilder's congress item notes, so the file
			// explorer's default alphabetical sort matches chronological order —
			// the raw date-range text alone doesn't (e.g. "10.-16. AUGUST" sorts
			// before "3.-9. AUGUST", and "AUGUST" before "JULI").
			const number = String(index + 1).padStart(2, '0');
			const baseName = `${number}. ${this.sanitizeName(week.dateRangeLabel)}`;

			let coverImageFilename: string | undefined;
			if (week.coverImage) {
				coverImageFilename = `${number}. ${this.t.coverImageBase}${this.extensionFor(week.coverImage.mimeType, week.coverImage.filename)}`;
				attachments.push({ filename: coverImageFilename, data: week.coverImage.data, regenerate: true });
			}

			notes.push({
				filename: `${baseName}.md`,
				content: this.renderWeekNote(week, mwb.year, coverImageFilename),
			});
		});

		if (mwb.memorialReading) {
			notes.push({
				// Uses the parsed title verbatim (already includes the year, e.g.
				// "Bibelleseprogramm für das Gedächtnismahl 2026") as the filename,
				// so Obsidian's own inline note title (derived from the filename)
				// carries the full title — no separate in-body heading needed.
				filename: `${this.sanitizeName(mwb.memorialReading.title)}.md`,
				content: this.renderMemorialReadingNote(mwb.memorialReading),
			});
		}

		return { issueFolder: this.issueFolderName(mwb), notes, attachments };
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

	// Deliberately no "# <dateRangeLabel>" heading here: the note's FILENAME
	// already carries that exact text, and Obsidian shows it as the note's own
	// inline title — an in-body heading with the same text just duplicated it
	// (confirmed by real-world screenshot: "3.-9. AUGUST" appearing twice).
	private renderWeekNote(week: MwbWeek, year: number, coverImageFilename: string | undefined): string {
		const lines: string[] = [];
		lines.push(...this.frontmatterLines(week, year));

		pushMarked(lines, 'header', () => {
			if (coverImageFilename) {
				lines.push(`![[${coverImageFilename}]]`);
				lines.push('');
			}
			const reading = week.bibleReading.length > 0 ? ` ${this.scriptureListText(week.bibleReading)}` : '';
			lines.push(`**${this.t.weeklyBibleReadingLabel}:** ${week.bibleReadingLabel}${reading}`);
			lines.push('');
			lines.push(this.songLine(week.openingSong));
		});
		lines.push('');

		const sections: MwbSection[] = ['treasures', 'ministry', 'living'];
		for (const section of sections) {
			const items = week.items.filter(i => i.section === section);
			if (items.length === 0) continue;

			lines.push(`## ${this.sectionHeading(section)}`);
			lines.push('');

			if (section === 'living' && week.midWeekSong) {
				pushMarked(lines, 'midweek-song', () => {
					lines.push(this.songLine(week.midWeekSong!));
				});
				lines.push('');
			}

			for (const item of items) {
				const markerId = item.isCongregationBibleStudy ? 'cbs' : `item-${item.number}`;
				pushMarked(lines, markerId, () => {
					lines.push(`### ${item.number}. ${item.title}`);
					if (this.opts.showDurationField && item.durationMin) {
						lines.push(`**${this.t.durationLabel}:** ${this.text.mwbDuration(item.durationMin)}`);
					}
					for (const paragraph of item.paragraphs) {
						const text = this.renderSegments(paragraph);
						if (text) lines.push(text);
					}
					for (const question of item.subQuestions) {
						lines.push(`- ${this.renderSegments(question)}`);
					}
				});
				lines.push(this.noteSpace());
			}
		}

		pushMarked(lines, 'footer', () => {
			lines.push(`**${this.text.mwbClosingWords}** | ${this.songLine(week.closingSong)}`);
		});
		lines.push('');

		return lines.join('\n').trim() + '\n';
	}

	private renderMemorialReadingNote(schedule: NonNullable<Mwb['memorialReading']>): string {
		const lines: string[] = [];

		pushMarked(lines, 'header', () => {
			if (schedule.intro) lines.push(`*${schedule.intro}*`);
		});
		lines.push('');

		schedule.days.forEach((day, dayIndex) => {
			lines.push(`## ${day.dayLabel}`);
			pushMarked(lines, `day-${dayIndex + 1}`, () => {
				for (const reading of day.readings) {
					const link = this.scriptureText(reading.scripture);
					const citation = reading.sourceCitation ? ` (${reading.sourceCitation})` : '';
					lines.push(`- [ ] ${link}${citation}`);
				}
			});
			lines.push(this.noteSpace());
		});

		return lines.join('\n').trim() + '\n';
	}

	private sectionHeading(section: MwbSection): string {
		switch (section) {
			case 'treasures': return this.t.treasuresLabel ?? '';
			case 'ministry': return this.t.ministryLabel ?? '';
			case 'living': return this.t.livingLabel ?? '';
		}
	}

	/** Renders one item paragraph's segments (see models/mwb.ts's
	 *  MwbTextSegment doc comment) into a single markdown string — scripture
	 *  references respect settings.mwbScriptureLinks, source-material
	 *  citations respect settings.mwbShowSourceCitationField (link vs. plain
	 *  label), plain text/bold/italic passes through as already-rendered
	 *  markdown from MwbParser. */
	private renderSegments(segments: MwbTextSegment[]): string {
		return segments.map(seg => {
			if (seg.type === 'text') return seg.markdown;
			if (seg.type === 'scripture') return this.scriptureText(seg.scripture);
			// citation
			if (!this.opts.showSourceCitationField || seg.docid === undefined) return seg.label;
			const url = `https://www.jw.org/finder?srcid=jwlshare&wtlocale=${ScriptureNormalizer.wtlocale(this.lang)}&prefer=lang&docid=${seg.docid}`;
			return `[${seg.label}](${url})`;
		}).join('');
	}

	private scriptureText(s: Scripture): string {
		if (this.opts.scriptureLinks) return ScriptureNormalizer.toMarkdownLink(s, this.lang);
		return ScriptureNormalizer.format(s, this.lang);
	}

	private scriptureListText(scriptures: Scripture[]): string {
		return scriptures.map(s => this.scriptureText(s)).join('; ');
	}

	// Same jw.org/finder deep-link shape and songDocid-over-table preference as
	// NoteBuilder.songLink() — see that method's doc comment for why this exact
	// URL form (not jwlibrary://) is the one confirmed to work, and
	// SONG_DOC_IDS for why the id is read rather than computed. A song in
	// neither stays unlinked here too.
	private songLine(song: MwbSong): string {
		const { mwbSong, mwbPrayer, mwbIntroWords } = this.text;
		const url = songFinderUrl(song.songNumber, this.lang, song.songDocid);
		const label = mwbSong(song.songNumber);
		const link = url === undefined ? label : `[${label}](${url})`;
		const suffix = [
			song.includesIntroWords ? `${mwbPrayer} | ${mwbIntroWords}` : song.includesPrayer ? mwbPrayer : undefined,
		].filter(Boolean).join(' ');
		return suffix ? `${link} ${suffix}` : link;
	}

	private noteSpace(): string {
		return '\n\n\n';
	}

	// Same forbidden-character handling as NoteBuilder.sanitizeFolderName()/slugify().
	private static readonly FS_CHAR_MAP: Record<string, string> = {
		'<': '‹', '>': '›', ':': '꞉', '"': 'ʺ', '/': '⁄', '\\': '＼', '|': '｜', '*': '＊', '?': '？',
	};

	private sanitizeName(text: string): string {
		return text
			.replace(/[<>:"/\\|?*]/g, ch => MwbNoteBuilder.FS_CHAR_MAP[ch] ?? '')
			.replace(/\s+/g, ' ')
			.trim();
	}
}
