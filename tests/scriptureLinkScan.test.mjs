import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jiti } from './_setup.mjs';

const { findLineWithScripture, findScriptureLinkInText, parseScriptureFromHref } =
	await jiti.import('../src/util/scriptureLinkScan.ts');

const PSALM_1_1_LINK = '[Psalm 1:1](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=19001001&pub=nwtsty)';
const MATTHEW_5_1_HTML_LINK = '<a href="jwlibrary:///finder?srcid=jwlshare&wtlocale=X&prefer=lang&bible=40005001&pub=nwtsty">Matthäus 5:1</a>';

test('parseScriptureFromHref reads the bible= param of a jwlibrary link', () => {
	const href = 'jwlibrary:///finder?srcid=jwlshare&wtlocale=X&bible=19001001&pub=nwtsty';
	assert.deepEqual(parseScriptureFromHref(href), { book: 19, chapter: 1, verseStart: 1 });
});

test('findScriptureLinkInText finds a markdown-form link covering the given offset', () => {
	const text = `Siehe ${PSALM_1_1_LINK} für mehr.`;
	const offset = text.indexOf('Psalm');
	const found = findScriptureLinkInText(text, offset);
	assert.ok(found);
	assert.deepEqual(found.scripture, { book: 19, chapter: 1, verseStart: 1 });
});

test('findLineWithScripture finds the line whose markdown link matches the target scripture', () => {
	const lines = [
		'Bibeltexte: (Matthäus 12:1-14)',
		'Redner:',
		'',
		'',
		'',
		PSALM_1_1_LINK,
	];
	const line = findLineWithScripture(lines, { book: 19, chapter: 1, verseStart: 1 });
	assert.equal(line, 5);
});

test('findLineWithScripture also finds the raw-HTML link form used by the overview note', () => {
	const lines = ['## Vormittag', `- **9:40** – ${MATTHEW_5_1_HTML_LINK}`];
	const line = findLineWithScripture(lines, { book: 40, chapter: 5, verseStart: 1 });
	assert.equal(line, 1);
});

test('findLineWithScripture returns undefined when no link matches the target scripture', () => {
	const lines = [PSALM_1_1_LINK];
	const line = findLineWithScripture(lines, { book: 40, chapter: 5, verseStart: 1 });
	assert.equal(line, undefined);
});

test('findLineWithScripture does not match a link for a different verse range of the same book/chapter', () => {
	const lines = ['[Psalm 1:1-3](jwlibrary:///finder?srcid=jwlshare&wtlocale=X&bible=19001001-19001003&pub=nwtsty)'];
	const line = findLineWithScripture(lines, { book: 19, chapter: 1, verseStart: 1 });
	assert.equal(line, undefined);
});
