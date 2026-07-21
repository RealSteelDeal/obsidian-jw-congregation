import { NoteStrings } from '../i18n';

/**
 * Heuristic fallback for notes that predate the invisible-marker mechanism
 * (see noteMerge.ts) — plugin versions before 1.9.0 wrote no markers at all,
 * so mergeNoteContent() always bails to null for them and they're reported
 * as "needs a full re-import" without ever being touched. This module offers
 * a much more conservative second chance: NoteBuilder always writes four
 * fields as a single, complete `**Label:** value` line (day/time/scriptures/
 * next — see NoteBuilder.ts), so a line starting with exactly one of those
 * (localized) labels can be safely swapped for the freshly rendered line,
 * AS LONG AS the label occurs exactly once in both the existing and the
 * fresh note. Zero or multiple occurrences means the anchor is not safely
 * unambiguous (e.g. a symposium note repeats "**Bibeltexte:**" once per
 * part) — that field is silently skipped for that note rather than guessed
 * at, exactly like mergeNoteContent()'s own "bail rather than guess" rule.
 *
 * Deliberately excludes the Speaker field: NoteBuilder never writes a value
 * after "**Redner:**" (see NoteBuilder.ts) — it's intentional writing space,
 * so there is nothing generated to compare against and thus nothing to
 * correct there.
 *
 * Callers MUST additionally check noteMerge.hasNoMarkers(existingContent)
 * before using this module — it has no way to tell "no markers" apart from
 * "markers present but corrupted", and must never be used as a substitute
 * for mergeNoteContent() on a note that has (even broken) markers.
 */

export type LegacyFieldKind = 'day' | 'time' | 'scriptures' | 'next';

export interface LegacyFieldCorrection {
	field: LegacyFieldKind;
	lineIndex: number;
	oldLine: string;
	newLine: string;
}

// NoteStrings key for each field's label — labels come from the CONGRESS's
// own language (NL[congress.lang]), not the plugin's UI language, since
// that's the language the note itself was actually written in. Narrowed to
// exactly these four (all plain `string` fields on NoteStrings) rather than
// `keyof NoteStrings`, so `t[...]` below is known to be a string, not one of
// NoteStrings' function-typed fields (e.g. `song`, `reviewHintCA`).
type LabelKey = 'dayLabel' | 'timeLabel' | 'scripturesLabel' | 'nextLabel';
const FIELD_LABEL_KEYS: Record<LegacyFieldKind, LabelKey> = {
	day: 'dayLabel',
	time: 'timeLabel',
	scriptures: 'scripturesLabel',
	next: 'nextLabel',
};

/** Index of the single line starting with `prefix` in `lines`, or 'absent'/'ambiguous'. */
function findUniqueLabelLine(lines: string[], prefix: string): number | 'absent' | 'ambiguous' {
	let found: number | null = null;
	for (let i = 0; i < lines.length; i++) {
		if (!lines[i]!.startsWith(prefix)) continue;
		if (found !== null) return 'ambiguous';
		found = i;
	}
	return found === null ? 'absent' : found;
}

export function findLegacyCorrections(existingContent: string, freshContent: string, t: NoteStrings): LegacyFieldCorrection[] {
	const existingLines = existingContent.split('\n');
	const freshLines = freshContent.split('\n');
	const corrections: LegacyFieldCorrection[] = [];

	for (const field of Object.keys(FIELD_LABEL_KEYS) as LegacyFieldKind[]) {
		const prefix = `**${t[FIELD_LABEL_KEYS[field]]}:**`;
		const existingIndex = findUniqueLabelLine(existingLines, prefix);
		if (existingIndex === 'absent' || existingIndex === 'ambiguous') continue;
		const freshIndex = findUniqueLabelLine(freshLines, prefix);
		if (freshIndex === 'absent' || freshIndex === 'ambiguous') continue;

		const oldLine = existingLines[existingIndex]!;
		const newLine = freshLines[freshIndex]!;
		if (oldLine === newLine) continue;

		corrections.push({ field, lineIndex: existingIndex, oldLine, newLine });
	}

	return corrections;
}

/**
 * Applies an accepted subset of corrections to `content` — each is a 1-for-1
 * whole-line replacement, so the line count never changes and plain index
 * assignment is safe (no splice/backwards-iteration needed, unlike
 * mergeNoteContent()'s multi-line marker-block splices). Re-verifies
 * `lines[lineIndex] === oldLine` immediately before writing each one and
 * silently skips any that no longer match — the caller is expected to pass
 * freshly-read (not stale, cached-at-detection-time) content, but this stays
 * safe even if it doesn't.
 */
export function applyLegacyCorrections(content: string, accepted: LegacyFieldCorrection[]): string {
	const lines = content.split('\n');
	for (const correction of accepted) {
		if (lines[correction.lineIndex] !== correction.oldLine) continue;
		lines[correction.lineIndex] = correction.newLine;
	}
	return lines.join('\n');
}
