import { Mwb, MwbSection, MwbSong, MwbWeek } from '../models/mwb';
import { Scripture } from '../models/congress';
import { ScriptureNormalizer } from '../normalizer/ScriptureNormalizer';
import { NL } from '../i18n';
import { pushMarked } from '../util/noteMerge';

export interface MwbBuilderOptions {
	scriptureLinks: boolean;
	showDurationField: boolean;
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

export interface MwbBuildResult {
	issueFolder: string;
	notes: GeneratedMwbNote[];
}

const GERMAN_MONTH_ABBR = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

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
 * German-only for v1 (Mwb.lang is typed 'de' — see MwbParser's class doc
 * comment), so this class hardcodes NL.de instead of switching on a `lang`
 * field the way NoteBuilder does for congress's 7 supported languages.
 */
export class MwbNoteBuilder {

	private readonly t = NL.de;

	constructor(private readonly opts: MwbBuilderOptions) {}

	private frontmatterLines(week: MwbWeek, year: number): string[] {
		if (!this.opts.frontmatter) return [];
		const esc = (v: string) => v.replace(/"/g, '\\"');
		return ['---', 'mwb: true', `week: "${esc(week.dateRangeLabel)}"`, `year: ${year}`, '---', ''];
	}

	issueFolderName(mwb: Mwb): string {
		return this.sanitizeName(`Leben und Dienst ${this.issueLabel(mwb)}`);
	}

	private issueLabel(mwb: Mwb): string {
		const m = /^(\d{4})(\d{2})\d{2}$/.exec(mwb.issueTagNumber);
		if (!m) return String(mwb.year);
		const monthIndex = Number(m[2]) - 1;
		const first = GERMAN_MONTH_ABBR[monthIndex];
		if (monthIndex < 0 || monthIndex > 11 || !first) return String(mwb.year);
		const second = GERMAN_MONTH_ABBR[(monthIndex + 1) % 12];
		return `${mwb.year} ${first}/${second}`;
	}

	buildNotes(mwb: Mwb): MwbBuildResult {
		const notes: GeneratedMwbNote[] = [];

		for (const week of mwb.weeks) {
			notes.push({
				filename: `${this.sanitizeName(week.dateRangeLabel)}.md`,
				content: this.renderWeekNote(week, mwb.year),
			});
		}

		if (mwb.memorialReading) {
			notes.push({
				filename: `${this.t.memorialReadingBase}.md`,
				content: this.renderMemorialReadingNote(mwb.memorialReading),
			});
		}

		return { issueFolder: this.issueFolderName(mwb), notes };
	}

	private renderWeekNote(week: MwbWeek, year: number): string {
		const lines: string[] = [];
		lines.push(...this.frontmatterLines(week, year));

		pushMarked(lines, 'header', () => {
			lines.push(`# ${week.dateRangeLabel}`);
			lines.push('');
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
					if (item.assignmentType) lines.push(`*${item.assignmentType}*`);
					if (this.opts.showDurationField && item.durationMin) {
						lines.push(`**${this.t.durationLabel}:** ${item.durationMin} Min.`);
					}
					if (item.scriptures.length > 0) {
						lines.push(`**${this.t.scripturesLabel}:** ${this.scriptureListText(item.scriptures)}`);
					}
					if (this.opts.showSourceCitationField && item.sourceCitation) {
						lines.push(`**${this.t.sourceMaterialLabel}:** ${item.sourceCitation}`);
					}
					for (const question of item.subQuestions) {
						lines.push(`- ${question}`);
					}
				});
				lines.push(this.noteSpace());
			}
		}

		pushMarked(lines, 'footer', () => {
			lines.push(`**Schlussworte** | ${this.songLine(week.closingSong)}`);
		});
		lines.push('');

		return lines.join('\n').trim() + '\n';
	}

	private renderMemorialReadingNote(schedule: NonNullable<Mwb['memorialReading']>): string {
		const lines: string[] = [];

		pushMarked(lines, 'header', () => {
			lines.push(`# ${schedule.title}`);
			if (schedule.intro) {
				lines.push('');
				lines.push(`*${schedule.intro}*`);
			}
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

	private scriptureText(s: Scripture): string {
		if (this.opts.scriptureLinks) return ScriptureNormalizer.toMarkdownLink(s, 'de');
		return ScriptureNormalizer.format(s, 'de');
	}

	private scriptureListText(scriptures: Scripture[]): string {
		return scriptures.map(s => this.scriptureText(s)).join('; ');
	}

	// Same jw.org/finder deep-link shape and songDocid-over-formula preference
	// as NoteBuilder.songLink() — see that method's doc comment for why this
	// exact URL form (not jwlibrary://) is the one confirmed to work.
	private songLine(song: MwbSong): string {
		const docid = song.songDocid ?? 1102016800 + song.songNumber;
		const url = `https://www.jw.org/finder?srcid=jwlshare&wtlocale=${ScriptureNormalizer.wtlocale('de')}&prefer=lang&docid=${docid}`;
		const link = `[Lied ${song.songNumber}](${url})`;
		const suffix = [
			song.includesIntroWords ? 'und Gebet | Einleitende Worte' : song.includesPrayer ? 'und Gebet' : undefined,
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
