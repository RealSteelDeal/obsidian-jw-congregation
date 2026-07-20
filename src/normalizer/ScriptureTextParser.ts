import { Scripture } from '../models/congress';
import { SupportedLang, lookupBookNumber } from './bookNames';

export interface ScriptureTextMatch {
	/** Offset into the input string where the matched reference starts. */
	start: number;
	/** Offset into the input string where the matched reference ends (exclusive) — always `text.length`, since this only matches a reference ending at the very end of the given text. */
	end: number;
	scripture: Scripture;
}

// chapter:verse[-verseEnd], anchored to the end of the string so it only
// matches once the reference has been fully typed (see ScriptureEditorSuggest,
// which runs this against the text immediately before the cursor on every
// keystroke). Same-chapter ranges only — a cross-chapter reference typed as
// plain text (e.g. "Mark 1:21-3:19") is rare enough in free-form notes that
// it's left for a later iteration rather than guessed at.
const TRAILING_CHAPTER_VERSE_RE = /(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/;

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
	const numMatch = TRAILING_CHAPTER_VERSE_RE.exec(text);
	if (!numMatch || !/\s/.test(text[numMatch.index - 1] ?? '')) return null;

	const chapter = Number(numMatch[1]);
	const verseStart = Number(numMatch[2]);
	if (chapter < 1 || verseStart < 1) return null;

	let verseEnd: number | undefined;
	if (numMatch[3] !== undefined) {
		verseEnd = Number(numMatch[3]);
		if (verseEnd <= verseStart) return null;
	}

	const beforeNumbers = text.slice(0, numMatch.index).replace(/\s+$/, '');
	const words = Array.from(beforeNumbers.matchAll(/\S+/g));
	if (words.length === 0) return null;

	for (let take = Math.min(MAX_BOOK_NAME_WORDS, words.length); take >= 1; take--) {
		const firstWord = words[words.length - take]!;
		const candidateText = beforeNumbers.slice(firstWord.index);
		const book = lookupBookNumber(candidateText, lang);
		if (!book) continue;

		const scripture: Scripture = { book, chapter, verseStart };
		if (verseEnd !== undefined) scripture.verseEnd = verseEnd;
		return { start: firstWord.index, end: text.length, scripture };
	}
	return null;
}
