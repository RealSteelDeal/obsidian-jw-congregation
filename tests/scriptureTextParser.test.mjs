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
