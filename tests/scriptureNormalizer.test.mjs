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

test('fromRtf drops verseEnd when the range crosses chapters (book:chapter differ)', () => {
	// 40:005:003 - 40:007:029 → Matthäus 5:3-7:29 crosses chapters; verseEnd is
	// only meaningful within the same chapter, so it's intentionally dropped.
	assert.deepEqual(ScriptureNormalizer.fromRtf('40005003-40007029'), { book: 40, chapter: 5, verseStart: 3 });
});

test('format renders a single verse', () => {
	const s = { book: 40, chapter: 5, verseStart: 1 };
	assert.equal(ScriptureNormalizer.format(s, 'de'), 'Matthäus 5:1');
});

test('format renders a verse range with a plain hyphen (not an en dash)', () => {
	const s = { book: 44, chapter: 20, verseStart: 34, verseEnd: 35 };
	assert.equal(ScriptureNormalizer.format(s, 'de'), 'Apostelgeschichte 20:34-35');
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
		'[Psalmen 16:11](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=19016011&pub=nwtsty)',
	);
});
