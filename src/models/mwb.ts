import { CoverImage, Scripture } from './congress';

/** Internal section keys, language-independent — the visible heading text
 *  (SCHÄTZE AUS GOTTES WORT / UNS IM DIENST VERBESSERN / UNSER LEBEN ALS
 *  CHRIST for German) lives in NoteStrings (treasuresLabel/ministryLabel/livingLabel). */
export type MwbSection = 'treasures' | 'ministry' | 'living';

/**
 * One piece of an item's descriptive paragraph text, in source order — lets
 * MwbNoteBuilder render the item's REAL instructional text (not just
 * extracted metadata) while still respecting settings.mwbScriptureLinks and
 * always linking source-material citations to their real jw.org/finder docid
 * (read straight out of the jwpub file's own "jwpub://p/<lang>:<docid>/…"
 * link, same mechanism as MwbSong.songDocid).
 */
export type MwbTextSegment =
	| { type: 'text'; markdown: string }
	| { type: 'scripture'; scripture: Scripture }
	| { type: 'citation'; label: string; docid?: number };

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
	 *  if present — deliberately not a closed enum, see MwbParser's doc comment.
	 *  Kept as structured metadata; MwbNoteBuilder shows it in bold INSIDE the
	 *  rendered paragraph text below rather than as a separate line, since
	 *  `paragraphs` already contains it once (MwbParser strips/re-bolds it in
	 *  place rather than duplicating it). */
	assignmentType?: string;
	/** The item's own descriptive text from the workbook — one entry per
	 *  source `<p>` (excluding a standalone "(N Min.)"-only paragraph and any
	 *  paragraph that belongs to a nested sub-question list instead, see
	 *  `subQuestions`). Rendered by MwbNoteBuilder as the item's actual body
	 *  text, not just a scripture/citation summary line. */
	paragraphs: MwbTextSegment[][];
	/** Discussion/sub-question text pulled from any nested <li>, with <textarea>
	 *  answer-placeholder content stripped out first — same segment shape as
	 *  `paragraphs`, so an embedded scripture/citation inside a discussion
	 *  question (e.g. "Jes 20:2 – … (w06 …)") is just as clickable as one in
	 *  the item's main text. */
	subQuestions: MwbTextSegment[][];
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
	/** The week's own document-level thumbnail — resolved via the
	 *  DocumentMultimedia/Multimedia tables, CategoryType 9 with a null
	 *  BeginParagraphOrdinal (a whole-document image, not tied to any specific
	 *  paragraph). NOT the same CategoryType congress days use (8) — for a
	 *  meeting-workbook week, CategoryType 8 is used repeatedly for each
	 *  numbered item's own inline illustration, not a single week banner;
	 *  confirmed against real files (CategoryType 9 appears exactly once per
	 *  week document, at document level). */
	coverImage?: CoverImage;
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
