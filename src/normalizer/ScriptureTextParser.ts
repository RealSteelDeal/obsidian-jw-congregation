import { Scripture } from '../models/congress';
import { SupportedLang, lookupBookNumber } from './bookNames';

export interface ScriptureTextMatch {
	/** Offset into the input string where the matched reference starts. */
	start: number;
	/** Offset into the input string where the matched reference ends (exclusive) — always `text.length`, since this only matches a reference ending at the very end of the given text. */
	end: number;
	scripture: Scripture;
}

// chapter:<spec>, anchored to the end of the string so it only matches once the
// reference has been fully typed (see ScriptureEditorSuggest, which runs this
// against the text immediately before the cursor on every keystroke).
//
// <spec> is the full citation tail and covers every form that occurs in real
// note-taking, all of which users reported as unlinkable while only the plain
// "verse[-verse]" form was recognised:
//   14        single verse
//   3-16      same-chapter range
//   13-6:1    range running into a later chapter (Hebr. 5:13-6:1)
//   14,15     two adjacent verses — the official comma spelling of a range
//   12,15     two or more verses that are NOT adjacent
//   3-5,9     a range plus a further single verse
// An en dash is accepted alongside the hyphen because format() itself writes
// one for cross-chapter citations, so the plugin's own output is recognised
// again when it is typed or pasted back.
const TRAILING_REFERENCE_RE = /(\d{1,3}):(\d{1,3}(?:\s*[-–]\s*(?:\d{1,3}:)?\d{1,3})?(?:\s*,\s*\d{1,3})*)$/;

// The leading part of <spec>, before any comma: a verse, a same-chapter range,
// or a range whose end carries its own chapter.
const SPEC_HEAD_RE = /^(\d{1,3})(?:\s*[-–]\s*(?:(\d{1,3}):)?(\d{1,3}))?$/;

// How many whitespace-separated words before the chapter:verse to consider as
// part of the book name — covers the longest real book names ("Song of
// Solomon", 3 words) with a little headroom.
const MAX_BOOK_NAME_WORDS = 4;

/**
 * Looks for a scripture reference ending exactly at the end of `text` (e.g.
 * "Psalm 12:1", "1 Mose 1:1-3") and, if a book-name candidate right before the
 * chapter:verse resolves to a real book (see lookupBookNumber), returns its
 * span and parsed Scripture.
 *
 * The candidate is found by progressively trimming leading words (e.g. for
 * "as it says in Psalm 12:1", trying "as it says in Psalm", then "it says in
 * Psalm", … down to "Psalm") until one resolves — mirroring how JW Library
 * Linker resolves the same ambiguity, since a plain regex anchored only at the
 * end would otherwise greedily swallow whatever prose precedes the reference
 * and give up entirely when THAT doesn't resolve to a book. Returns null for
 * anything that isn't a real book name — safe by construction, since text like
 * "see page 12:30" never has "page" resolve to a book.
 */
export function findScriptureReferenceAtEnd(text: string, lang: SupportedLang): ScriptureTextMatch | null {
	const numMatch = TRAILING_REFERENCE_RE.exec(text);
	if (!numMatch || !/\s/.test(text[numMatch.index - 1] ?? '')) return null;

	const chapter = Number(numMatch[1]);
	if (chapter < 1) return null;
	const verses = parseVerseSpec(chapter, numMatch[2] ?? '');
	if (!verses) return null;

	const beforeNumbers = text.slice(0, numMatch.index).replace(/\s+$/, '');
	const words = Array.from(beforeNumbers.matchAll(/\S+/g));
	if (words.length === 0) return null;

	for (let take = Math.min(MAX_BOOK_NAME_WORDS, words.length); take >= 1; take--) {
		const firstWord = words[words.length - take]!;
		const candidateText = beforeNumbers.slice(firstWord.index);
		const book = lookupBookNumber(candidateText, lang);
		if (!book) continue;

		return { start: firstWord.index, end: text.length, scripture: { book, ...verses } };
	}
	return null;
}

/**
 * Turns the citation tail after "chapter:" into the verse-bearing fields of a
 * Scripture, or null if it doesn't describe a sane citation.
 *
 * Rejected rather than guessed at: any non-ascending sequence ("12:5-3",
 * "4:15,12"), a range running back into an earlier chapter, and a comma part
 * that is itself a range ("4:12,15-17") — the last one has no representation
 * in Scripture, and silently linking only part of what the user wrote would be
 * worse than leaving the whole reference unlinked.
 *
 * A leading run of CONTIGUOUS verses always collapses into verseStart/verseEnd
 * rather than becoming extraVerses, so the common comma spellings ("2:14,15")
 * produce exactly the same single, known-good `bible=BB…-BB…` link that the
 * hyphen spelling has always produced — extraVerses is reserved for genuine
 * gaps (see Scripture.extraVerses).
 */
function parseVerseSpec(chapter: number, spec: string): Omit<Scripture, 'book'> | null {
	const parts = spec.split(',').map(part => part.trim());
	const headMatch = SPEC_HEAD_RE.exec(parts[0] ?? '');
	if (!headMatch) return null;

	const verseStart = Number(headMatch[1]);
	if (verseStart < 1) return null;

	// A range whose end names its own chapter (Hebr. 5:13-6:1). The verse ids
	// of the chapters in between are only resolvable against a real Bible file
	// (see BibleReader), so nothing here may be expanded into a verse list —
	// which is also why a further comma part cannot be combined with it.
	if (headMatch[2] !== undefined) {
		const chapterEnd = Number(headMatch[2]);
		const verseEnd = Number(headMatch[3]);
		if (chapterEnd <= chapter || verseEnd < 1) return null;
		if (parts.length > 1) return null;
		return { chapter, verseStart, verseEnd, chapterEnd };
	}

	const cited: number[] = [verseStart];
	if (headMatch[3] !== undefined) {
		const verseEnd = Number(headMatch[3]);
		if (verseEnd <= verseStart) return null;
		for (let v = verseStart + 1; v <= verseEnd; v++) cited.push(v);
	}

	for (const part of parts.slice(1)) {
		if (!/^\d{1,3}$/.test(part)) return null;
		const verse = Number(part);
		if (verse <= cited[cited.length - 1]!) return null;
		cited.push(verse);
	}

	let run = 1;
	while (run < cited.length && cited[run] === cited[run - 1]! + 1) run++;

	const scripture: Omit<Scripture, 'book'> = { chapter, verseStart };
	if (run > 1) scripture.verseEnd = cited[run - 1];
	const extraVerses = cited.slice(run);
	if (extraVerses.length > 0) scripture.extraVerses = extraVerses;
	return scripture;
}
