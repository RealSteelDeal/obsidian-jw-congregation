import { Scripture } from './congress';

/** Internal section keys, language-independent — the visible heading text
 *  (SCHÄTZE AUS GOTTES WORT / UNS IM DIENST VERBESSERN / UNSER LEBEN ALS
 *  CHRIST for German) lives in NoteStrings (treasuresLabel/ministryLabel/livingLabel). */
export type MwbSection = 'treasures' | 'ministry' | 'living';

export interface MwbSong {
	songNumber: number;
	/** The real jw.org/finder docid for this song, read straight out of the
	 *  jwpub file's own "jwpub://p/<lang>:<docid>/" link — not derivable from
	 *  songNumber by formula (same caveat as ProgramItem.songDocid). */
	songDocid?: number;
	/** True for the opening song ("Lied N und Gebet | Einleitende Worte") and
	 *  the closing song ("Schlussworte … | Lied N und Gebet") — false/undefined
	 *  for the plain mid-week song heading. */
	includesPrayer?: boolean;
	includesIntroWords?: boolean;
}

export interface MwbItem {
	/** Taken verbatim from the source "N. Title" heading, never recomputed. */
	number: number;
	section: MwbSection;
	title: string;
	/** Parsed from a trailing "(N Min.)" duration marker. */
	durationMin?: number;
	/** Raw, verbatim ALL-CAPS assignment-type label (e.g. "VON HAUS ZU HAUS"),
	 *  if present — deliberately not a closed enum, see MwbParser's doc comment. */
	assignmentType?: string;
	/** Visible text of the item's own source-material citation link, e.g. "lmd Lektion 2 Punkt 3". */
	sourceCitation?: string;
	scriptures: Scripture[];
	/** Discussion/sub-question text pulled from any nested <li>, with <textarea>
	 *  answer-placeholder content stripped out first. */
	subQuestions: string[];
	/** True for the always-last item of the "living" section ("Versammlungsbibelstudium"). */
	isCongregationBibleStudy: boolean;
}

export interface MwbWeek {
	/** Raw h1 text, e.g. "5.-11. JANUAR" — kept verbatim, not decomposed into
	 *  structured start/end dates (see plan's open-risk note on folder sorting). */
	dateRangeLabel: string;
	/** Raw weekly-Bible-reading h2 text, e.g. "JESAJA 17-20". */
	bibleReadingLabel: string;
	bibleReading: Scripture[];
	openingSong: MwbSong;
	/** Absent when a week's document unexpectedly has only 2 song headings
	 *  instead of the usual 3 — degrades gracefully rather than failing the
	 *  whole week (see MwbParser). */
	midWeekSong?: MwbSong;
	closingSong: MwbSong;
	/** All numbered items, across all 3 sections, in source order. */
	items: MwbItem[];
}

export interface MemorialReadingDay {
	/** Raw h2 text, e.g. "FREITAG, 27. MÄRZ". */
	dayLabel: string;
	readings: { scripture: Scripture; sourceCitation?: string }[];
}

/** The "Bibelleseprogramm für das Gedächtnismahl" insert document that
 *  appears in the Memorial-season issue — structurally unrelated to a normal
 *  week (per-day checklist of readings, no 3-section program). */
export interface MemorialReadingSchedule {
	title: string;
	intro?: string;
	days: MemorialReadingDay[];
}

export interface Mwb {
	/** e.g. "mwb26". */
	symbol: string;
	year: number;
	/** Raw "20260100" — kept opaque, not decomposed into a month range. */
	issueTagNumber: string;
	weeks: MwbWeek[];
	memorialReading?: MemorialReadingSchedule;
	/** v1 only ever produces 'de' — MwbParser rejects any other detected
	 *  MepsLanguageIndex with a clear ParseError rather than misinterpreting
	 *  unverified section-heading/duration text in another language. */
	lang: 'de';
}
