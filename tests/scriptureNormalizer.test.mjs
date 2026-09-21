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
	const s = { book: 54, chapter: 4, verseStart: 12, extraVerses: [{ start: 15 }] };
	assert.equal(ScriptureNormalizer.format(s, 'de'), '1. Timotheus 4:12, 15');
});

test('format appends gapped verses after a leading range', () => {
	const s = { book: 40, chapter: 5, verseStart: 3, verseEnd: 5, extraVerses: [{ start: 9 }] };
	assert.equal(ScriptureNormalizer.format(s, 'de'), 'Matthäus 5:3-5, 9');
});

test('format writes a gapped range with a hyphen, like the leading one', () => {
	const s = { book: 54, chapter: 4, verseStart: 12, extraVerses: [{ start: 15, end: 17 }] };
	assert.equal(ScriptureNormalizer.format(s, 'de'), '1. Timotheus 4:12, 15-17');
});

test('format applies the two-adjacent-verses comma rule to a gapped run as well', () => {
	const s = { book: 54, chapter: 4, verseStart: 12, extraVerses: [{ start: 15, end: 16 }] };
	assert.equal(ScriptureNormalizer.format(s, 'de'), '1. Timotheus 4:12, 15, 16');
});

// A comma-separated bible= list does NOT work: JW Library opens and closes
// again (confirmed against a real install, 17.09.2026). Only one verse or one
// range per link — these tests exist to keep the comma from creeping back in.
test('toJwLibraryLink never writes a comma, covering only the leading stretch', () => {
	const s = { book: 54, chapter: 4, verseStart: 12, extraVerses: [{ start: 15, end: 17 }] };
	const href = ScriptureNormalizer.toJwLibraryLink(s);
	assert.equal(
		href,
		'jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=54004012&pub=nwtsty',
	);
	assert.ok(!href.includes(','));
});

test('toMarkdownLink renders a gapped citation as one link per stretch', () => {
	const s = { book: 54, chapter: 4, verseStart: 12, extraVerses: [{ start: 15, end: 17 }] };
	assert.equal(
		ScriptureNormalizer.toMarkdownLink(s, 'de'),
		'[1. Timotheus 4:12](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=54004012&pub=nwtsty)'
		+ ', [15-17](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=54004015-54004017&pub=nwtsty)',
	);
});

test('toMarkdownLink keeps the leading range in its own link', () => {
	const s = { book: 40, chapter: 5, verseStart: 3, verseEnd: 5, extraVerses: [{ start: 9 }] };
	assert.equal(
		ScriptureNormalizer.toMarkdownLink(s, 'de'),
		'[Matthäus 5:3-5](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=40005003-40005005&pub=nwtsty)'
		+ ', [9](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=40005009&pub=nwtsty)',
	);
});

test('toMarkdownLink uses a caller-supplied prefix so a typed abbreviation is kept', () => {
	const s = { book: 54, chapter: 4, verseStart: 12, extraVerses: [{ start: 14, end: 16 }] };
	const markdown = ScriptureNormalizer.toMarkdownLink(s, 'de', '1. Tim. 4:');
	assert.ok(markdown.startsWith('[1. Tim. 4:12]('));
	assert.ok(markdown.includes('), [14-16]('));
});

test('no link of a gapped citation carries a comma in its bible= parameter', () => {
	const s = { book: 54, chapter: 4, verseStart: 12, extraVerses: [{ start: 15, end: 17 }, { start: 20 }] };
	for (const href of ScriptureNormalizer.toMarkdownLink(s, 'de').matchAll(/\((jwlibrary:[^)]+)\)/g)) {
		assert.ok(!new URL(href[1]).searchParams.get('bible').includes(','), href[1]);
	}
});

test('fromRtf reads a comma-separated verse list back into extraVerses', () => {
	assert.deepEqual(
		ScriptureNormalizer.fromRtf('54004012,54004015'),
		{ book: 54, chapter: 4, verseStart: 12, extraVerses: [{ start: 15 }] },
	);
});

test('fromRtf reads a gapped range back as a run with its own end', () => {
	assert.deepEqual(
		ScriptureNormalizer.fromRtf('54004012,54004015-54004017'),
		{ book: 54, chapter: 4, verseStart: 12, extraVerses: [{ start: 15, end: 17 }] },
	);
});

test('fromRtf reads a range followed by gapped verses back', () => {
	assert.deepEqual(
		ScriptureNormalizer.fromRtf('40005003-40005005,40005009'),
		{ book: 40, chapter: 5, verseStart: 3, verseEnd: 5, extraVerses: [{ start: 9 }] },
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

// widens() decides whether the popup offers to bring the note's reference up
// to the passage on display — it must say yes only to a genuine widening of
// the same passage, never to a verse navigated to.
test('widens recognises a passage widened forwards, backwards and both ways', () => {
	const original = { book: 50, chapter: 4, verseStart: 6, verseEnd: 7 };
	assert.equal(ScriptureNormalizer.widens({ ...original, verseEnd: 9 }, original), true);
	assert.equal(ScriptureNormalizer.widens({ ...original, verseStart: 4 }, original), true);
	assert.equal(ScriptureNormalizer.widens({ ...original, verseStart: 1, verseEnd: 23 }, original), true);
});

test('widens recognises a single verse widened into a range', () => {
	const original = { book: 19, chapter: 1, verseStart: 1 };
	assert.equal(ScriptureNormalizer.widens({ ...original, verseEnd: 3 }, original), true);
});

test('widens rejects the unchanged passage, so the offer only appears after widening', () => {
	const original = { book: 50, chapter: 4, verseStart: 6, verseEnd: 7 };
	assert.equal(ScriptureNormalizer.widens({ ...original }, original), false);
	assert.equal(ScriptureNormalizer.widens({ book: 19, chapter: 1, verseStart: 1 }, { book: 19, chapter: 1, verseStart: 1 }), false);
});

test('widens rejects a narrower or shifted passage', () => {
	const original = { book: 50, chapter: 4, verseStart: 6, verseEnd: 9 };
	assert.equal(ScriptureNormalizer.widens({ ...original, verseEnd: 7 }, original), false);
	assert.equal(ScriptureNormalizer.widens({ ...original, verseStart: 8, verseEnd: 12 }, original), false);
});

test('widens rejects another book or chapter — a cross-reference is not a widening', () => {
	const original = { book: 50, chapter: 4, verseStart: 6, verseEnd: 7 };
	assert.equal(ScriptureNormalizer.widens({ book: 19, chapter: 4, verseStart: 1, verseEnd: 20 }, original), false);
	assert.equal(ScriptureNormalizer.widens({ book: 50, chapter: 3, verseStart: 1, verseEnd: 20 }, original), false);
});

test('widens rejects cross-chapter and gapped citations rather than guessing', () => {
	const crossChapter = { book: 58, chapter: 5, verseStart: 13, verseEnd: 1, chapterEnd: 6 };
	assert.equal(ScriptureNormalizer.widens({ ...crossChapter, verseEnd: 5 }, crossChapter), false);
	const gapped = { book: 54, chapter: 4, verseStart: 12, extraVerses: [{ start: 15 }] };
	assert.equal(ScriptureNormalizer.widens({ book: 54, chapter: 4, verseStart: 12, verseEnd: 20 }, gapped), false);
	assert.equal(ScriptureNormalizer.widens({ ...gapped, verseEnd: 13 }, gapped), false);
});

test('fromRtf still reads the comma form written by a 1.19.0 development build', () => {
	// No longer written (JW Library rejects it), but such links already sit in
	// real notes — a click on one must still open the popup on every verse it
	// names rather than silently dropping the tail.
	assert.deepEqual(
		ScriptureNormalizer.fromRtf('54004012,54004014-54004016'),
		{ book: 54, chapter: 4, verseStart: 12, extraVerses: [{ start: 14, end: 16 }] },
	);
});
