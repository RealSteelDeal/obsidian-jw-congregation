import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { lookupBookNumber } = await jiti.import('../src/normalizer/bookNames.ts');

// Every abbreviation asserted here was read off a real publication (see
// BOOK_ABBREVIATIONS and scripts/dump-book-abbreviations.mjs), not chosen.

test('resolves an abbreviation that skips letters instead of truncating', () => {
	// No prefix rule can reach these: "apg" is not the start of
	// "apostelgeschichte", nor "offb" of "offenbarung".
	assert.equal(lookupBookNumber('Apg.', 'de'), 44);
	assert.equal(lookupBookNumber('Offb.', 'de'), 66);
	assert.equal(lookupBookNumber('Klg', 'de'), 25);
	assert.equal(lookupBookNumber('Jas.', 'en'), 59);
});

test('resolves "Phil." to Philipper, the way publications use it', () => {
	// The reported case: "phil" prefixes both Philipper and Philemon, so the
	// prefix rule refused it and the book had to be written out in full.
	assert.equal(lookupBookNumber('Phil.', 'de'), 50);
});

test('resolves an abbreviation spelled differently from the name we write', () => {
	// Publications print "Zeph."; this project writes the book as "Zefanja".
	assert.equal(lookupBookNumber('Zeph.', 'de'), 36);
});

test('abbreviations ignore capitalisation and punctuation', () => {
	for (const written of ['Apg.', 'Apg', 'apg', 'APG.', ' apg. ']) {
		assert.equal(lookupBookNumber(written, 'de'), 44, written);
	}
});

test('an abbreviation belongs to its own language only', () => {
	// "Jas." is English; German must not silently accept it.
	assert.equal(lookupBookNumber('Jas.', 'de'), undefined);
	assert.equal(lookupBookNumber('Offb.', 'en'), undefined);
});

test('the singular form of a plural book name resolves where publications use it', () => {
	assert.equal(lookupBookNumber('Salmo', 'it'), 19);
	assert.equal(lookupBookNumber('Псалом', 'ru'), 19);
});

test('Philemon has no table entry but still resolves by prefix', () => {
	// No file checked cites Philemon, so its own "Phlm." is deliberately
	// absent rather than invented — a truncation still gets there.
	assert.equal(lookupBookNumber('Philem.', 'de'), 57);
	assert.equal(lookupBookNumber('Philemon', 'de'), 57);
	assert.equal(lookupBookNumber('Phlm.', 'de'), undefined);
});

test('the table does not loosen the rule against guessing at an ambiguous prefix', () => {
	// "Jo" still prefixes Johannes, Joel and Jona, and no publication settles
	// it, so it stays refused.
	assert.equal(lookupBookNumber('Jo', 'de'), undefined);
});

test('full names and unambiguous truncations keep working', () => {
	assert.equal(lookupBookNumber('Philipper', 'de'), 50);
	assert.equal(lookupBookNumber('Matth.', 'de'), 40);
	assert.equal(lookupBookNumber('Ps', 'de'), 19);
	assert.equal(lookupBookNumber('1 Mo', 'de'), 1);
});
