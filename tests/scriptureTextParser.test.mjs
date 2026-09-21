import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { findScriptureReferenceAtEnd } = await jiti.import('../src/normalizer/ScriptureTextParser.ts');

test('recognizes a plain German book name and single verse', () => {
	const text = 'Wie in Psalm 12:1';
	const match = findScriptureReferenceAtEnd(text, 'de');
	assert.ok(match);
	assert.equal(text.slice(match.start, match.end), 'Psalm 12:1');
	assert.deepEqual(match.scripture, { book: 19, chapter: 12, verseStart: 1 });
});

test('recognizes an English book name and single verse', () => {
	const text = 'as it says in Psalm 12:1';
	const match = findScriptureReferenceAtEnd(text, 'en');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 19, chapter: 12, verseStart: 1 });
});

test('recognizes a same-chapter verse range', () => {
	const match = findScriptureReferenceAtEnd('Matthäus 5:3-16', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 40, chapter: 5, verseStart: 3, verseEnd: 16 });
});

test('recognizes a book name with a numeric volume prefix ("1. Mose")', () => {
	const match = findScriptureReferenceAtEnd('1. Mose 1:1', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 1, chapter: 1, verseStart: 1 });
});

test('recognizes a book name with a numeric volume prefix without a period ("1 Korinther")', () => {
	const match = findScriptureReferenceAtEnd('1 Korinther 13:4', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 46, chapter: 13, verseStart: 4 });
});

test('returns null when the leading word is not a real book name', () => {
	assert.equal(findScriptureReferenceAtEnd('siehe Seite 12:30', 'de'), null);
});

test('returns null for incomplete input (still typing the chapter/verse)', () => {
	assert.equal(findScriptureReferenceAtEnd('Psalm 12:', 'de'), null);
	assert.equal(findScriptureReferenceAtEnd('Psalm 12', 'de'), null);
	assert.equal(findScriptureReferenceAtEnd('Psalm', 'de'), null);
});

test('returns null for a book name in the wrong language', () => {
	assert.equal(findScriptureReferenceAtEnd('Genesis 1:1', 'de'), null);
});

test('rejects a nonsensical descending verse range', () => {
	assert.equal(findScriptureReferenceAtEnd('Psalm 12:5-3', 'de'), null);
});

test('recognizes a truncated abbreviation with a trailing period ("Matth.")', () => {
	const match = findScriptureReferenceAtEnd('Matth. 5:2-4', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 40, chapter: 5, verseStart: 2, verseEnd: 4 });
});

test('recognizes a short unambiguous abbreviation without a period ("Ps")', () => {
	const match = findScriptureReferenceAtEnd('Ps 12:1', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 19, chapter: 12, verseStart: 1 });
});

test('recognizes an abbreviation with a numeric volume prefix ("1 Mo")', () => {
	const match = findScriptureReferenceAtEnd('1 Mo 1:1', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 1, chapter: 1, verseStart: 1 });
});

test('rejects an ambiguous abbreviation that prefixes more than one book ("Jo")', () => {
	// "Jo" prefixes Johannes, Joel and Jona — must not silently guess.
	assert.equal(findScriptureReferenceAtEnd('Jo 1:1', 'de'), null);
});

// The comma and cross-chapter forms below were all reported from real
// note-taking as references the plugin refused to link.

test('recognizes two adjacent verses written with a comma as a plain range ("Röm. 2:14,15")', () => {
	const match = findScriptureReferenceAtEnd('Röm. 2:14,15', 'de');
	assert.ok(match);
	// Collapsed into a range on purpose: same verses, and it keeps the single
	// known-good "bible=45002014-45002015" link the hyphen spelling produces.
	assert.deepEqual(match.scripture, { book: 45, chapter: 2, verseStart: 14, verseEnd: 15 });
});

test('recognizes two verses cited across a gap as extraVerses ("1. Tim. 4:12,15")', () => {
	const match = findScriptureReferenceAtEnd('1. Tim. 4:12,15', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 54, chapter: 4, verseStart: 12, extraVerses: [{ start: 15 }] });
});

test('accepts a space after the comma, as the citation convention writes it', () => {
	const match = findScriptureReferenceAtEnd('1. Tim. 4:12, 15', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 54, chapter: 4, verseStart: 12, extraVerses: [{ start: 15 }] });
});

test('recognizes three or more verses cited across gaps', () => {
	const match = findScriptureReferenceAtEnd('1. Tim. 4:12,15,20', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 54, chapter: 4, verseStart: 12, extraVerses: [{ start: 15 }, { start: 20 }] });
});

test('collapses a whole run of adjacent verses, however it is spelled', () => {
	const match = findScriptureReferenceAtEnd('Matthäus 5:3,4,5', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 40, chapter: 5, verseStart: 3, verseEnd: 5 });
});

test('recognizes a range followed by a further single verse ("Matthäus 5:3-5,9")', () => {
	const match = findScriptureReferenceAtEnd('Matthäus 5:3-5,9', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 40, chapter: 5, verseStart: 3, verseEnd: 5, extraVerses: [{ start: 9 }] });
});

test('recognizes a further range after a gap ("1. Tim. 4:12,15-17")', () => {
	const match = findScriptureReferenceAtEnd('1. Tim. 4:12,15-17', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 54, chapter: 4, verseStart: 12, extraVerses: [{ start: 15, end: 17 }] });
});

test('recognizes a leading range and a further range ("Matthäus 5:3-5,9-11")', () => {
	const match = findScriptureReferenceAtEnd('Matthäus 5:3-5,9-11', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 40, chapter: 5, verseStart: 3, verseEnd: 5, extraVerses: [{ start: 9, end: 11 }] });
});

test('recognizes a range and a single verse after it ("1. Tim. 4:12,15-17,20")', () => {
	const match = findScriptureReferenceAtEnd('1. Tim. 4:12,15-17,20', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, {
		book: 54, chapter: 4, verseStart: 12, extraVerses: [{ start: 15, end: 17 }, { start: 20 }],
	});
});

test('merges a comma part that continues the range without a gap ("Matthäus 5:3-5,6")', () => {
	// Derived from the verses named, not from how they were written — 3 to 6
	// runs unbroken, so it is one range and keeps the single known-good link.
	const match = findScriptureReferenceAtEnd('Matthäus 5:3-5,6', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 40, chapter: 5, verseStart: 3, verseEnd: 6 });
});

test('recognizes a range running into a later chapter ("Hebräer 5:13-6:1")', () => {
	const match = findScriptureReferenceAtEnd('Hebräer 5:13-6:1', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 58, chapter: 5, verseStart: 13, verseEnd: 1, chapterEnd: 6 });
});

test('recognizes a cross-chapter range written with an en dash, as format() writes it', () => {
	const match = findScriptureReferenceAtEnd('Hebräer 5:13–6:1', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 58, chapter: 5, verseStart: 13, verseEnd: 1, chapterEnd: 6 });
});

test('rejects a descending comma list rather than reordering it', () => {
	assert.equal(findScriptureReferenceAtEnd('1. Tim. 4:15,12', 'de'), null);
	assert.equal(findScriptureReferenceAtEnd('1. Tim. 4:12,12', 'de'), null);
});

test('rejects a range running back into an earlier chapter', () => {
	assert.equal(findScriptureReferenceAtEnd('Hebräer 6:1-5:13', 'de'), null);
});

test('recognizes "Phil. 4:6,7", the abbreviation publications actually print', () => {
	// Reported from real note-taking: this was refused because "phil" prefixes
	// Philemon as well, so the book had to be typed out in full.
	const match = findScriptureReferenceAtEnd('Phil. 4:6,7', 'de');
	assert.ok(match);
	assert.deepEqual(match.scripture, { book: 50, chapter: 4, verseStart: 6, verseEnd: 7 });
});

test('rejects a citation that overlaps itself rather than merging it silently', () => {
	assert.equal(findScriptureReferenceAtEnd('1. Tim. 4:12-14,13', 'de'), null);
	assert.equal(findScriptureReferenceAtEnd('1. Tim. 4:12,15-14', 'de'), null);
});
