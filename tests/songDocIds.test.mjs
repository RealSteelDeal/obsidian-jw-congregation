/**
 * Tests for the song table (src/normalizer/songDocIds.ts).
 *
 * Every id asserted here was read out of the official songbook jwpub with
 * scripts/dump-song-docids.mjs, and cross-checked against the convention
 * programmes of three languages — never computed. The point of the table is
 * precisely that computing is wrong for some songs, so a test that computed
 * its own expectations would prove nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { SONG_DOC_IDS, songFinderUrl, findSongNumberAtEnd } =
	await jiti.import('../src/normalizer/songDocIds.ts');

test('the table holds every song of the songbook, without gaps', () => {
	const numbers = Object.keys(SONG_DOC_IDS).map(Number).sort((a, b) => a - b);
	assert.equal(numbers[0], 1);
	assert.equal(numbers[numbers.length - 1], 163);
	assert.equal(numbers.length, 163);
});

test('the four ids confirmed from real shared links are the ones in the table', () => {
	// These four predate the table: they were recorded in NoteBuilder.songLink
	// from links that had actually been shared out of JW Library, and were the
	// yardstick the songbook file had to meet before any of this was built.
	assert.equal(SONG_DOC_IDS[14], 1102016814);
	assert.equal(SONG_DOC_IDS[54], 1102016854);
	assert.equal(SONG_DOC_IDS[94], 1102016894);
	assert.equal(SONG_DOC_IDS[160], 1102022960);
});

test('the formula the table replaced is wrong for twelve songs, Lied 160 among them', () => {
	// The reason the table exists at all. If this ever came out as zero, the
	// table would be pointless and a formula would do.
	const wrong = Object.entries(SONG_DOC_IDS).filter(([n, id]) => id !== 1102016800 + Number(n));
	assert.equal(wrong.length, 12);
	assert.equal(1102016800 + 160, 1102016960); // what the formula predicted
	assert.equal(SONG_DOC_IDS[160], 1102022960); // what JW Library really uses
});

test('a song link carries the language in wtlocale, not in the id', () => {
	// Established across the German, English and Russian programmes: the same
	// song has the same id in all three. One table therefore serves all seven
	// languages, and only the locale parameter differs.
	const de = songFinderUrl(45, 'de');
	const en = songFinderUrl(45, 'en');
	assert.match(de, /docid=1102016845/);
	assert.match(en, /docid=1102016845/);
	assert.notEqual(de, en);
	assert.match(de, /wtlocale=X/);
	assert.match(en, /wtlocale=E/);
});

test('an id read from the file itself wins over the table', () => {
	// The jwpub import path reads the real id out of the programme; the table
	// is for the RTF path, which has none to read.
	assert.match(songFinderUrl(45, 'de', 1102099999), /docid=1102099999/);
});

test('a song the songbook does not contain gets no link at all', () => {
	// Better no link than one that opens the wrong publication — the same rule
	// the note builders follow.
	assert.equal(songFinderUrl(164, 'de'), undefined);
	assert.equal(songFinderUrl(999, 'de'), undefined);
});

test('a typed song number is recognised at the end of a line', () => {
	const hit = findSongNumberAtEnd('Wir singen Lied 45');
	assert.equal(hit.songNumber, 45);
	assert.equal('Wir singen Lied 45'.slice(hit.start, hit.end), 'Lied 45');
});

test('a typed song number is recognised in each language that writes it differently', () => {
	// The wording, including the "No."/"no"/"№" infix that only some languages
	// use, comes from NoteBuilder.splitSongTitle — verified there against real
	// programme files of all seven.
	for (const text of ['Song No. 45', 'Song 45', 'Cantique no 45', 'Cantico 45', 'Cântico 45', 'Canción 45', 'Песня 45']) {
		assert.equal(findSongNumberAtEnd(text)?.songNumber, 45, text);
	}
});

test('a song number the table does not know is not offered', () => {
	// There would be no link to make, so announcing it would promise something
	// that cannot follow.
	assert.equal(findSongNumberAtEnd('Lied 164'), undefined);
	assert.equal(findSongNumberAtEnd('Lied 900'), undefined);
});

test('ordinary prose and half-typed numbers are left alone', () => {
	assert.equal(findSongNumberAtEnd('Wir haben gesungen'), undefined);
	assert.equal(findSongNumberAtEnd('Lied'), undefined);
	assert.equal(findSongNumberAtEnd('45'), undefined);
	// Not mid-word: "Abschiedslied 45" is not a song reference.
	assert.equal(findSongNumberAtEnd('Abschiedslied 45'), undefined);
});

test('the recognised span covers only the reference, not the text before it', () => {
	const text = 'Danach folgt Lied 120';
	const hit = findSongNumberAtEnd(text);
	assert.equal(text.slice(hit.start, hit.end), 'Lied 120');
	assert.equal(hit.songNumber, 120);
});
