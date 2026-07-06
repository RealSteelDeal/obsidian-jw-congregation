export type CongressType = 'CO' | 'CA-copgm' | 'CA-brpgm';

export type ItemType =
	| 'talk'
	| 'talk-series'
	| 'bible-drama'
	| 'baptism'
	| 'interview'
	| 'song'
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
}

export interface Session {
	name: string;        // "Vormittag" | "Nachmittag"
	items: ProgramItem[];
}

export interface Day {
	name: string;        // "Freitag" | "Samstag" | "Sonntag"
	weekday: string;
	date?: string;       // ISO-8601 if available
	sessions: Session[];
}

export interface Congress {
	type: CongressType;
	theme: string;
	themeScripture?: Scripture;
	year: number;
	season?: string;
	days: Day[];
}
