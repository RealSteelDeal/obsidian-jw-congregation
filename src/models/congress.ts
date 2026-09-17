import { CongressLang } from '../normalizer/bookNames';

export type CongressType = 'CO' | 'CA-copgm' | 'CA-brpgm';

export type ItemType =
	| 'talk'
	| 'talk-series'
	| 'bible-drama'
	| 'baptism'
	| 'interview'
	| 'song'
	| 'aside'
	| 'other';

export interface Scripture {
	book: number;        // 1–66 canonical book number
	chapter: number;
	verseStart: number;
	verseEnd?: number;
	/** Set only when the citation spans chapters (e.g. Mark 1:21–3:19), and only
	 *  differs from `chapter` in that case — `verseEnd` then refers to a verse
	 *  number WITHIN `chapterEnd`, not `chapter`. Real bible-drama scripture
	 *  lists cite exactly this shape. Absent (or equal to `chapter`) for an
	 *  ordinary single-chapter reference/range. */
	chapterEnd?: number;
	/** Further single verses of the SAME chapter cited alongside the leading
	 *  verse/range, in the order written — the comma form of a citation, e.g.
	 *  "1. Tim. 4:12, 15" → verseStart 12, extraVerses [15]. Only for verses
	 *  that are NOT contiguous with what comes before them: exactly two
	 *  adjacent verses ("Röm. 2:14, 15") are the official comma spelling of a
	 *  two-verse RANGE and stay verseStart/verseEnd, so that they keep
	 *  producing the single, known-good `bible=BB…-BB…` link (see
	 *  ScriptureNormalizer.format(), which renders that range back with a
	 *  comma). Absent for every ordinary reference — nothing in the jwpub/RTF
	 *  import path produces it, only free-text recognition does
	 *  (ScriptureTextParser). */
	extraVerses?: number[];
}

export interface ProgramItem {
	time: string;        // "HH:MM"
	itemType: ItemType;
	title: string;
	subtitle?: string;
	scriptures: Scripture[];
	bulletPoints: string[];
	parts?: ProgramItem[];  // only for talk-series
	songNumber?: number;    // only for itemType 'song'
	songDocid?: number;     // only for itemType 'song', jwpub source only — the real
	                        // jw.org/finder docid for this exact song, read straight out of
	                        // the jwpub file's own "jwpub://p/X:<docid>/" link. Not derivable
	                        // from songNumber by formula (docid isn't a linear function of
	                        // song number), so this is the only reliable source.
}

export interface Session {
	name: string;        // "Vormittag" | "Nachmittag"
	items: ProgramItem[];
}

export interface CoverImage {
	data: Uint8Array;
	filename: string;    // original filename from the jwpub zip (used to derive the extension)
	mimeType: string;
}

export interface Day {
	name: string;        // "Freitag" | "Samstag" | "Sonntag"
	weekday: string;
	date?: string;       // ISO-8601 if available
	theme?: string;      // day's motto quote, e.g. „Geben macht glücklicher als Empfangen“
	themeScripture?: Scripture;
	sessions: Session[];
	coverImage?: CoverImage;
}

export interface Congress {
	type: CongressType;
	theme: string;
	themeScripture?: Scripture;
	year: number;
	season?: string;
	days: Day[];
	/** Language of the source programme file (JwpubParser: detected from the
	 *  publication's MepsLanguageIndex; RtfParser: always 'de', German RTF
	 *  exports are the only ones it understands). Drives the language of all
	 *  generated notes — labels, file and folder names — independently of the
	 *  plugin's UI language setting. */
	lang: CongressLang;
}
