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
	lang: 'de' | 'en';
}
