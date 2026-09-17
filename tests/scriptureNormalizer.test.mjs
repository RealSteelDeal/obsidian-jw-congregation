import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { ScriptureNormalizer } = await jiti.import('../src/normalizer/ScriptureNormalizer.ts');

test('fromJwpub parses a single verse', () => {
	assert.deepEqual(ScriptureNormalizer.fromJwpub('40:5:1'), { book: 40, chapter: 5, verseStart: 1 });
});

test('fromJwpub parses a same-chapter range', () => {
	assert.deepEqual(ScriptureNormalizer.fromJwpub('40:5:3-40:5:16'), {
		book: 40, chapter: 5, verseStart: 3, verseEnd: 16,
	});
});

test('fromRtf parses an 8-digit BBCCCVVV code', () => {
	assert.deepEqual(ScriptureNormalizer.fromRtf('40005001'), { book: 40, chapter: 5, verseStart: 1 });
});

test('fromRtf captures the end chapter when a range crosses chapters (book:chapter differ)', () => {
	// 40:005:003 - 40:007:029 → Matthäus 5:3–7:29 crosses chapters; chapterEnd
	// captures the end segment's own chapter so the full range is preserved.
	assert.deepEqual(ScriptureNormalizer.fromRtf('40005003-40007029'), {
		book: 40, chapter: 5, verseStart: 3, verseEnd: 29, chapterEnd: 7,
	});
});

test('format renders a single verse', () => {
	const s = { book: 40, chapter: 5, verseStart: 1 };
	assert.equal(ScriptureNormalizer.format(s, 'de'), 'Matthäus 5:1');
});

test('format renders exactly two consecutive verses with a comma, not a hyphen', () => {
	const s = { book: 44, chapter: 20, verseStart: 34, verseEnd: 35 };
	assert.equal(ScriptureNormalizer.format(s, 'de'), 'Apostelgeschichte 20:34, 35');
});

test('format renders a range of three or more verses with a plain hyphen (not an en dash)', () => {
	const s = { book: 44, chapter: 20, verseStart: 34, verseEnd: 36 };
	assert.equal(ScriptureNormalizer.format(s, 'de'), 'Apostelgeschichte 20:34-36');
});

test('format respects the requested language', () => {
	const s = { book: 40, chapter: 5, verseStart: 1 };
	assert.equal(ScriptureNormalizer.format(s, 'en'), 'Matthew 5:1');
});

test('toJwLibraryLink encodes a single verse as one BBCCCVVV code', () => {
	const s = { book: 19, chapter: 16, verseStart: 11 };
	assert.equal(
		ScriptureNormalizer.toJwLibraryLink(s),
		'jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=19016011&pub=nwtsty',
	);
});

test('toJwLibraryLink encodes a range as start-end codes', () => {
	const s = { book: 44, chapter: 20, verseStart: 34, verseEnd: 35 };
	assert.equal(
		ScriptureNormalizer.toJwLibraryLink(s),
		'jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=44020034-44020035&pub=nwtsty',
	);
});

test('toMarkdownLink combines the readable label and the deeplink', () => {
	const s = { book: 19, chapter: 16, verseStart: 11 };
	assert.equal(
		ScriptureNormalizer.toMarkdownLink(s, 'de'),
		'[Psalm 16:11](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=19016011&pub=nwtsty)',
	);
});

test('toJwLibraryLink carries the language-matching wtlocale (X for German, E for English)', () => {
	const s = { book: 19, chapter: 16, verseStart: 11 };
	assert.ok(ScriptureNormalizer.toJwLibraryLink(s, 'de').includes('wtlocale=X'));
	assert.ok(ScriptureNormalizer.toJwLibraryLink(s, 'en').includes('wtlocale=E'));
	// Callers without a language context (default) keep the German locale.
	assert.ok(ScriptureNormalizer.toJwLibraryLink(s).includes('wtlocale=X'));
});

test('fromJwpub captures the full cross-chapter range (book:chapter differ)', () => {
	// Real citation from a bible-drama scripture list: "Markus 1:21–3:19".
	// Earlier bugs either mixed up the chapters (nonsensical "Markus 1:21-19")
	// or dropped the end segment entirely (just "Markus 1:21") — chapterEnd
	// now preserves the full cited passage.
	assert.deepEqual(
		ScriptureNormalizer.fromJwpub('41:1:21-41:3:19'),
		{ book: 41, chapter: 1, verseStart: 21, verseEnd: 19, chapterEnd: 3 },
	);
});

test('format renders a cross-chapter range with an en dash between chapter:verse pairs', () => {
	const s = { book: 41, chapter: 1, verseStart: 21, verseEnd: 19, chapterEnd: 3 };
	assert.equal(ScriptureNormalizer.format(s, 'de'), 'Markus 1:21–3:19');
});

test('toJwLibraryLink encodes a cross-chapter range as two full BBCCCVVV codes', () => {
	const s = { book: 41, chapter: 1, verseStart: 21, verseEnd: 19, chapterEnd: 3 };
	assert.equal(
		ScriptureNormalizer.toJwLibraryLink(s),
		'jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=41001021-41003019&pub=nwtsty',
	);
});

test('format separates verses cited across a gap with a comma', () => {
	const s = { book: 54, chapter: 4, verseStart: 12, extraVerses: [15] };
	assert.equal(ScriptureNormalizer.format(s, 'de'), '1. Timotheus 4:12, 15');
});

test('format appends gapped verses after a leading range', () => {
	const s = { book: 40, chapter: 5, verseStart: 3, verseEnd: 5, extraVerses: [9] };
	assert.equal(ScriptureNormalizer.format(s, 'de'), 'Matthäus 5:3-5, 9');
});

// The comma-separated bible= list is this project's one UNVERIFIED link shape —
// see the warning on ScriptureNormalizer.bibleParam(). These tests pin down what
// is emitted so a later correction is a single, visible change.
test('toJwLibraryLink appends gapped verses to bible= as further BBCCCVVV codes', () => {
	const s = { book: 54, chapter: 4, verseStart: 12, extraVerses: [15] };
	assert.equal(
		ScriptureNormalizer.toJwLibraryLink(s),
		'jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=54004012,54004015&pub=nwtsty',
	);
});

test('toJwLibraryLink keeps the range form as the head of a gapped citation', () => {
	const s = { book: 40, chapter: 5, verseStart: 3, verseEnd: 5, extraVerses: [9] };
	assert.equal(
		ScriptureNormalizer.toJwLibraryLink(s),
		'jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=40005003-40005005,40005009&pub=nwtsty',
	);
});

test('fromRtf reads a comma-separated verse list back into extraVerses', () => {
	assert.deepEqual(
		ScriptureNormalizer.fromRtf('54004012,54004015'),
		{ book: 54, chapter: 4, verseStart: 12, extraVerses: [15] },
	);
});

test('fromRtf reads a range followed by gapped verses back', () => {
	assert.deepEqual(
		ScriptureNormalizer.fromRtf('40005003-40005005,40005009'),
		{ book: 40, chapter: 5, verseStart: 3, verseEnd: 5, extraVerses: [9] },
	);
});

test('fromRtf drops a tail code from another book or chapter rather than guessing', () => {
	// Not a shape toJwLibraryLink ever writes — same defensive handling as a
	// foreign end segment in fromJwpub().
	assert.deepEqual(
		ScriptureNormalizer.fromRtf('54004012,55004015'),
		{ book: 54, chapter: 4, verseStart: 12 },
	);
	assert.deepEqual(
		ScriptureNormalizer.fromRtf('54004012,54005015'),
		{ book: 54, chapter: 4, verseStart: 12 },
	);
});

test('a gapped citation survives the full link round-trip', () => {
	const s = { book: 54, chapter: 4, verseStart: 12, extraVerses: [15, 20] };
	const bible = new URL(ScriptureNormalizer.toJwLibraryLink(s)).searchParams.get('bible');
	assert.deepEqual(ScriptureNormalizer.fromRtf(bible), s);
});
