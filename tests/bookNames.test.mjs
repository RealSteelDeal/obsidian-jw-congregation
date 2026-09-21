import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { lookupBookNumber, findBooksByPrefix, getBookName } = await jiti.import('../src/normalizer/bookNames.ts');

const LANGS = ['de', 'en', 'fr', 'it', 'pt', 'ru', 'es'];

/** The first `count` letters/digits of a name, keeping its punctuation. */
function truncate(name, count) {
	let taken = 0, out = '';
	for (const ch of name) {
		out += ch;
		if (/[\p{L}\p{N}]/u.test(ch)) taken++;
		if (taken === count) break;
	}
	return out;
}

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

test('the three corrected German names resolve, including as a typed prefix', () => {
	// All three were wrong against the Bible file's own titles until
	// 21.09.2026 — "Zefanja", "Ester", "Hoheslied". The Zephanja case was
	// found by a user typing "Zephan" and getting no completion.
	assert.equal(lookupBookNumber('Zephanja', 'de'), 36);
	assert.equal(lookupBookNumber('Zeph.', 'de'), 36);
	assert.equal(lookupBookNumber('Esther', 'de'), 17);
	assert.equal(lookupBookNumber('Hohes Lied', 'de'), 22);
	assert.deepEqual(findBooksByPrefix('Zephan', 'de').map(m => m.name), ['Zephanja']);
	assert.deepEqual(findBooksByPrefix('Esth', 'de').map(m => m.name), ['Esther']);
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

test('every book in every language completes from the start of its own name', () => {
	// The guarantee the completion is supposed to give, asserted for all
	// 7 × 66 rather than spot-checked: this is exactly what silently failed
	// for Zephanja, where the stored name did not match how the book is
	// actually spelled.
	for (const lang of LANGS) {
		for (let book = 1; book <= 66; book++) {
			const name = getBookName(book, lang);
			const significant = name.replace(/[^\p{L}\p{N}]/gu, '').length;
			// A name of three characters or fewer is already complete once
			// typed — there is nothing to offer, by design.
			if (significant <= 3) continue;
			const typed = truncate(name, 3);
			const offered = findBooksByPrefix(typed, lang).some(m => m.book === book);
			assert.ok(offered, `${lang}: "${typed}" offers nothing for "${name}"`);
		}
	}
});

test('findBooksByPrefix completes a partly typed book name', () => {
	assert.deepEqual(findBooksByPrefix('Apo', 'de'), [{ book: 44, name: 'Apostelgeschichte' }]);
});

test('findBooksByPrefix offers every match, in canonical order', () => {
	// Several matches are a normal result here — unlike lookupBookNumber(),
	// which refuses an ambiguous prefix, the point is to let the user pick.
	assert.deepEqual(findBooksByPrefix('Phil', 'de').map(m => m.name), ['Philipper', 'Philemon']);
	assert.deepEqual(findBooksByPrefix('Ko', 'de').map(m => m.name), ['Kolosser']);
});

test('a numbered book is reached through its ordinal, not the plain word', () => {
	// "1. Johannes" normalises to "1johannes", so "Joh" does not reach it —
	// the same property lookupBookNumber() has, kept deliberately rather than
	// special-cased, so both resolve a typed name the same way.
	assert.deepEqual(findBooksByPrefix('Joh', 'de').map(m => m.book), [43]);
	assert.deepEqual(findBooksByPrefix('1. Joh', 'de').map(m => m.book), [62]);
});

test('findBooksByPrefix reaches a numbered book through its ordinal', () => {
	for (const typed of ['1. Kor', '1 Kor', '1.Kor']) {
		assert.deepEqual(findBooksByPrefix(typed, 'de').map(m => m.book), [46], typed);
	}
});

test('findBooksByPrefix offers nothing once the name is complete', () => {
	// Nothing left to complete; offering back the finished word would be the
	// single biggest source of noise.
	assert.deepEqual(findBooksByPrefix('Apostelgeschichte', 'de'), []);
	assert.deepEqual(findBooksByPrefix('Psalm', 'de'), []);
});

test('findBooksByPrefix returns nothing for a word that is no book at all', () => {
	assert.deepEqual(findBooksByPrefix('Wanderung', 'de'), []);
	assert.deepEqual(findBooksByPrefix('', 'de'), []);
});

test('full names and unambiguous truncations keep working', () => {
	assert.equal(lookupBookNumber('Philipper', 'de'), 50);
	assert.equal(lookupBookNumber('Matth.', 'de'), 40);
	assert.equal(lookupBookNumber('Ps', 'de'), 19);
	assert.equal(lookupBookNumber('1 Mo', 'de'), 1);
});
