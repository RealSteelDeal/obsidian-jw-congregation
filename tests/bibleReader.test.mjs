/**
 * Unit tests for BibleReader's chapter-HTML segment extraction and verse-id
 * resolution. Uses hand-written, fictional markup/data shaped like the real
 * jwpub structure — never actual Bible text, to keep copyrighted content out
 * of the repo (same convention as jwpubParser.test.mjs).
 *
 * Private methods/fields are reached via bracket notation (TypeScript's
 * `private` is compile-time only).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { jiti } from './_setup.mjs';

const { BibleReader } = await jiti.import('../src/bible/BibleReader.ts');

const sqlWasmBinary = readFileSync(
	fileURLToPath(new URL('../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url)),
);
const SQL = await initSqlJs({ wasmBinary: sqlWasmBinary });

function reader() {
	// sqlWasmBinary/db/key/iv are only needed by load()/decrypting methods;
	// extractVerseContent() only ever touches the DOM it's given.
	return new BibleReader(new Uint8Array());
}

function parseHtml(html) {
	return new DOMParser().parseFromString(html, 'text/html');
}

/**
 * A minimal in-memory SQLite DB with just the two columns/tables
 * resolveVerseId()/chapterBounds() actually touch — no encryption, no
 * decryptBlob() involved, since Label/FirstVerseId/LastVerseId aren't
 * encrypted columns in a real jwpub file either.
 */
function fakeDb(chapters, verses) {
	const db = new SQL.Database();
	db.run('CREATE TABLE BibleChapter (BookNumber INTEGER, ChapterNumber INTEGER, FirstVerseId INTEGER, LastVerseId INTEGER)');
	db.run('CREATE TABLE BibleVerse (BibleVerseId INTEGER, Label TEXT)');
	for (const c of chapters) {
		db.run('INSERT INTO BibleChapter VALUES (?, ?, ?, ?)', [c.book, c.chapter, c.firstVerseId, c.lastVerseId]);
	}
	for (const v of verses) {
		db.run('INSERT INTO BibleVerse VALUES (?, ?)', [v.id, v.label]);
	}
	return db;
}

test('extractVerseContent joins a single-span verse without adding a leading space', () => {
	const dom = parseHtml(`
		<span id="v1-1-1-1" class="v">
			<span class="cl"><strong>1</strong> <span class="tt cl">1</span></span>
			Fictional opening line of the chapter.
		</span>
	`);
	const r = reader();
	const { segments, isChapterStart } = r['extractVerseContent'](dom, 1, 1, 1);
	assert.equal(isChapterStart, true);
	const text = segments.map(s => s.text).join('').replace(/\s+/g, ' ').trim();
	assert.equal(text, 'Fictional opening line of the chapter.');
});

// Real poetic verses (e.g. Psalm 1:1) split their text across several
// continuation spans, one per printed line, with no whitespace character of
// their own separating them — the line break itself was the separator in the
// source. Confirmed against a real nwtsty file: before this fix, adjacent
// lines were concatenated with no space at all ("...folgtund nicht...").
test('extractVerseContent inserts a space between poetic-line continuation spans', () => {
	const dom = parseHtml(`
		<span id="v19-1-1-1" class="v">
			<span class="cl"><strong>1</strong> <span class="tt cl">1</span></span>
			Fictional first line
		</span>
		<span id="v19-1-1-2" class="v">fictional second line</span>
		<span id="v19-1-1-3" class="v">fictional third line.</span>
	`);
	const r = reader();
	const { segments } = r['extractVerseContent'](dom, 19, 1, 1);
	const text = segments.map(s => s.text).join('');
	assert.equal(text.replace(/\s+/g, ' ').trim(), 'Fictional first line fictional second line fictional third line.');
});

test('extractVerseContent separates a continuation span even when the previous span ended in a marker', () => {
	const dom = parseHtml(`
		<span id="v19-1-1-1" class="v">Fictional line ending in a cross-reference<span data-mid="1" class="m">a<span class="tt"></span></span></span>
		<span id="v19-1-1-2" class="v">fictional continuation line.</span>
	`);
	const r = reader();
	const { segments } = r['extractVerseContent'](dom, 19, 1, 1);
	const text = segments.filter(s => s.kind === 'text').map(s => s.text).join('');
	assert.equal(text.replace(/\s+/g, ' ').trim(), 'Fictional line ending in a cross-reference fictional continuation line.');
});

// Real psalms with a superscription (e.g. Psalm 15's "Ein Psalm Davids.")
// store it as an extra BibleVerse row BEFORE verse 1, with an empty Label —
// it occupies the chapter's FirstVerseId slot without being a numbered verse.
// Naive `firstVerseId + verse - 1` arithmetic resolved Psalm 15:2 to the
// superscription+verse-1 row instead of verse 2 (confirmed against a real
// nwtsty file: the popup showed verse 1's text and "15" as the verse number
// for every verse of the chapter). chapterBounds() now detects this from the
// row's own Label — never a hardcoded list of which psalms have one.
test('resolveVerseId skips a psalm superscription row when resolving a numbered verse', () => {
	const db = fakeDb(
		[{ book: 19, chapter: 15, firstVerseId: 1000, lastVerseId: 1005 }],
		[
			{ id: 1000, label: '' }, // superscription — not a numbered verse
			{ id: 1001, label: '1' },
			{ id: 1002, label: '2' },
			{ id: 1003, label: '3' },
			{ id: 1004, label: '4' },
			{ id: 1005, label: '5' },
		],
	);
	const r = reader();
	r['db'] = db;

	assert.equal(r['resolveVerseId'](19, 15, 1), 1001);
	assert.equal(r['resolveVerseId'](19, 15, 2), 1002);
	assert.equal(r.chapterVerseCount(19, 15), 5);
});

// getVerses()/getVerseDetails() are the only two entry points every db.exec()
// call in this class is ultimately reached through — none of the private
// helpers below them handle a query failure on their own. A schema mismatch
// (e.g. a plain `nwt` file missing the VerseCommentary/VerseCommentaryMap
// tables `resolveStudyNotes()` queries, which were found investigating a
// `nwtsty` file specifically) must not reach the caller as an unhandled
// rejection — every caller already treats `undefined` as "nothing to show".
test('getVerses returns undefined (not a rejected promise) when a query throws', async () => {
	const r = reader();
	r['db'] = { exec: () => { throw new Error('no such table: BibleChapter'); } };
	r['key'] = new Uint8Array(16);
	r['iv'] = new Uint8Array(16);

	const result = await r.getVerses({ book: 19, chapter: 15, verseStart: 1 });
	assert.equal(result, undefined);
});

test('getVerseDetails returns undefined (not a rejected promise) when a query throws', async () => {
	const r = reader();
	r['db'] = { exec: () => { throw new Error('no such table: BibleChapter'); } };
	r['key'] = new Uint8Array(16);
	r['iv'] = new Uint8Array(16);

	const result = await r.getVerseDetails({ book: 19, chapter: 15, verseStart: 1 });
	assert.equal(result, undefined);
});

test('resolveVerseId treats a chapter with no superscription unchanged (regression check)', () => {
	const db = fakeDb(
		[{ book: 19, chapter: 1, firstVerseId: 2000, lastVerseId: 2005 }],
		[
			{ id: 2000, label: '1' }, // no superscription — verse 1 IS the first row
			{ id: 2001, label: '2' },
			{ id: 2002, label: '3' },
			{ id: 2003, label: '4' },
			{ id: 2004, label: '5' },
			{ id: 2005, label: '6' },
		],
	);
	const r = reader();
	r['db'] = db;

	assert.equal(r['resolveVerseId'](19, 1, 1), 2000);
	assert.equal(r['resolveVerseId'](19, 1, 2), 2001);
	assert.equal(r.chapterVerseCount(19, 1), 6);
});
